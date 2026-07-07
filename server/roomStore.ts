import crypto from "node:crypto";
import {
  Board,
  ChatMessage,
  MoveRecord,
  PendingUndoRequest,
  Point,
  PublicPlayer,
  PublicRoomState,
  Stone,
  createEmptyBoard,
  findWinningLine,
  oppositeTurn,
  placeStone
} from "../src/shared/game";

interface InternalPlayer extends PublicPlayer {
  token: string;
  socketId: string | null;
  joinedAt: number;
  lastSeenAt: number;
}

interface InternalRoom {
  id: string;
  players: {
    black: InternalPlayer | null;
    white: InternalPlayer | null;
  };
  board: Board;
  currentTurn: Stone;
  status: "waiting" | "playing" | "finished";
  winner: Stone | null;
  winningLine: Point[];
  lastMove: Point | null;
  moveHistory: MoveRecord[];
  restartReady: Record<Stone, boolean>;
  undoRequest: PendingUndoRequest | null;
  chatMessages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface JoinResult {
  room: PublicRoomState;
  playerToken: string;
  color: Stone;
}

interface RoomStoreOptions {
  now?: () => number;
  inactiveRoomMs?: number;
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const rooms = new Map<string, InternalRoom>();
  const now = options.now ?? Date.now;
  const inactiveRoomMs = options.inactiveRoomMs ?? 30 * 60 * 1000;

  function createRoom(nickname: string, socketId: string | null = null): JoinResult {
    const timestamp = now();
    const player = createPlayer(nickname, "black", timestamp, socketId);
    const room: InternalRoom = {
      id: createUniqueRoomId(rooms),
      players: { black: player, white: null },
      board: createEmptyBoard(),
      currentTurn: "black",
      status: "waiting",
      winner: null,
      winningLine: [],
      lastMove: null,
      moveHistory: [],
      restartReady: { black: false, white: false },
      undoRequest: null,
      chatMessages: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    rooms.set(room.id, room);
    return { room: toPublicRoom(room), playerToken: player.token, color: "black" };
  }

  function joinRoom(roomId: string, nickname: string, socketId: string | null = null): JoinResult {
    const room = requireRoom(roomId);
    if (room.players.white) {
      throw new Error("ROOM_FULL");
    }
    const player = createPlayer(nickname, "white", now(), socketId);
    room.players.white = player;
    room.status = "playing";
    room.updatedAt = now();
    return { room: toPublicRoom(room), playerToken: player.token, color: "white" };
  }

  function reconnect(roomId: string, token: string, socketId: string | null = null): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    player.online = true;
    player.socketId = socketId;
    player.lastSeenAt = now();
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function markOffline(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    markPlayerOffline(room, player);
    return toPublicRoom(room);
  }

  function markOfflineBySocket(socketId: string): PublicRoomState[] {
    const changedRooms: PublicRoomState[] = [];
    for (const room of rooms.values()) {
      const player = [room.players.black, room.players.white].find(
        (candidate) => candidate?.socketId === socketId
      );
      if (player) {
        markPlayerOffline(room, player);
        changedRooms.push(toPublicRoom(room));
      }
    }
    return changedRooms;
  }

  function place(roomId: string, token: string, point: Point): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    if (room.status !== "playing") {
      throw new Error("GAME_NOT_PLAYING");
    }
    requireBothPlayersOnline(room);
    if (player.color !== room.currentTurn) {
      throw new Error("NOT_YOUR_TURN");
    }

    room.board = placeStone(room.board, point, player.color);
    room.moveHistory.push({ point, color: player.color });
    room.lastMove = point;
    const winningLine = findWinningLine(room.board, point, player.color);
    if (winningLine) {
      room.status = "finished";
      room.winner = player.color;
      room.winningLine = winningLine;
    } else {
      room.currentTurn = oppositeTurn(player.color);
    }
    room.restartReady = { black: false, white: false };
    room.undoRequest = null;
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function requestUndo(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    requireBothPlayersOnline(room);
    const lastMove = room.moveHistory.at(-1);
    if (!lastMove) {
      throw new Error("NO_MOVE_TO_UNDO");
    }
    if (lastMove.color !== player.color) {
      throw new Error("ONLY_LAST_MOVER_CAN_REQUEST_UNDO");
    }
    room.undoRequest = {
      requestedBy: player.color,
      move: lastMove,
      createdAt: now()
    };
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function approveUndo(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    requireBothPlayersOnline(room);
    const request = room.undoRequest;
    if (!request) {
      throw new Error("NO_UNDO_REQUEST");
    }
    if (request.requestedBy === player.color) {
      throw new Error("OPPONENT_APPROVAL_REQUIRED");
    }
    const removed = room.moveHistory.pop();
    if (!removed) {
      throw new Error("NO_MOVE_TO_UNDO");
    }
    room.board = room.board.map((row, y) =>
      row.map((cell, x) => (x === removed.point.x && y === removed.point.y ? null : cell))
    );
    const previousMove = room.moveHistory.at(-1);
    room.lastMove = previousMove?.point ?? null;
    room.currentTurn = removed.color;
    room.status = room.players.white ? "playing" : "waiting";
    room.winner = null;
    room.winningLine = [];
    room.restartReady = { black: false, white: false };
    room.undoRequest = null;
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function setRestartReady(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    room.restartReady[player.color] = true;
    if (room.restartReady.black && room.restartReady.white) {
      resetGame(room);
    }
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function addChatMessage(roomId: string, token: string, text: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    const trimmedText = text.replace(/\s+/g, " ").trim();
    if (!trimmedText) {
      throw new Error("CHAT_MESSAGE_REQUIRED");
    }
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
      text: trimmedText.slice(0, 160),
      createdAt: now()
    };
    room.chatMessages = [...room.chatMessages, message].slice(-50);
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function deleteInactiveRooms(): number {
    let deleted = 0;
    const cutoff = now() - inactiveRoomMs;
    for (const [roomId, room] of rooms.entries()) {
      const nobodyOnline = !room.players.black?.online && !room.players.white?.online;
      if (nobodyOnline && room.updatedAt < cutoff) {
        rooms.delete(roomId);
        deleted += 1;
      }
    }
    return deleted;
  }

  function getRoom(roomId: string): PublicRoomState {
    return toPublicRoom(requireRoom(roomId));
  }

  return {
    createRoom,
    joinRoom,
    reconnect,
    markOffline,
    markOfflineBySocket,
    placeStone: place,
    requestUndo,
    approveUndo,
    setRestartReady,
    addChatMessage,
    deleteInactiveRooms,
    getRoom
  };

  function requireRoom(roomId: string): InternalRoom {
    const room = rooms.get(roomId.trim().toUpperCase());
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    return room;
  }

  function requirePlayerByToken(room: InternalRoom, token: string): InternalPlayer {
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    return player;
  }

  function requireBothPlayersOnline(room: InternalRoom): void {
    if (!room.players.black?.online || !room.players.white?.online) {
      throw new Error("PLAYER_OFFLINE");
    }
  }

  function markPlayerOffline(room: InternalRoom, player: InternalPlayer): void {
    player.online = false;
    player.socketId = null;
    player.lastSeenAt = now();
    room.updatedAt = now();
  }
}

function resetGame(room: InternalRoom): void {
  room.board = createEmptyBoard();
  room.currentTurn = "black";
  room.status = room.players.white ? "playing" : "waiting";
  room.winner = null;
  room.winningLine = [];
  room.lastMove = null;
  room.moveHistory = [];
  room.restartReady = { black: false, white: false };
  room.undoRequest = null;
}

function createPlayer(
  nickname: string,
  color: Stone,
  timestamp: number,
  socketId: string | null
): InternalPlayer {
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) {
    throw new Error("NICKNAME_REQUIRED");
  }
  return {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(16).toString("hex"),
    nickname: trimmedNickname.slice(0, 16),
    color,
    online: true,
    socketId,
    joinedAt: timestamp,
    lastSeenAt: timestamp
  };
}

function createUniqueRoomId(rooms: Map<string, InternalRoom>): string {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const candidate = crypto.randomBytes(3).toString("hex").toUpperCase();
    if (!rooms.has(candidate)) {
      return candidate;
    }
  }
  throw new Error("ROOM_ID_EXHAUSTED");
}

function findPlayerByToken(room: InternalRoom, token: string): InternalPlayer | null {
  for (const player of [room.players.black, room.players.white]) {
    if (player?.token === token) {
      return player;
    }
  }
  return null;
}

function toPublicPlayer(player: InternalPlayer | null): PublicPlayer | null {
  if (!player) {
    return null;
  }
  return {
    id: player.id,
    nickname: player.nickname,
    color: player.color,
    online: player.online
  };
}

function toPublicRoom(room: InternalRoom): PublicRoomState {
  const lastMove = room.moveHistory.at(-1) ?? null;
  return {
    id: room.id,
    players: {
      black: toPublicPlayer(room.players.black),
      white: toPublicPlayer(room.players.white)
    },
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    winningLine: room.winningLine,
    lastMove: room.lastMove,
    lastMoveColor: lastMove?.color ?? null,
    moveCount: room.moveHistory.length,
    restartReady: { ...room.restartReady },
    undoRequest: room.undoRequest ? { ...room.undoRequest } : null,
    chatMessages: [...room.chatMessages]
  };
}
