import crypto from "node:crypto";
import {
  Board,
  ChatMessage,
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
  restartReady: Record<Stone, boolean>;
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
      restartReady: { black: false, white: false },
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
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    player.online = true;
    player.socketId = socketId;
    player.lastSeenAt = now();
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function markOffline(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
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
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    if (room.status !== "playing") {
      throw new Error("GAME_NOT_PLAYING");
    }
    if (!room.players.black?.online || !room.players.white?.online) {
      throw new Error("PLAYER_OFFLINE");
    }
    if (player.color !== room.currentTurn) {
      throw new Error("NOT_YOUR_TURN");
    }

    room.board = placeStone(room.board, point, player.color);
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
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function setRestartReady(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    room.restartReady[player.color] = true;
    if (room.restartReady.black && room.restartReady.white) {
      room.board = createEmptyBoard();
      room.currentTurn = "black";
      room.status = room.players.white ? "playing" : "waiting";
      room.winner = null;
      room.winningLine = [];
      room.lastMove = null;
      room.restartReady = { black: false, white: false };
    }
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function addChatMessage(roomId: string, token: string, text: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
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

  function markPlayerOffline(room: InternalRoom, player: InternalPlayer): void {
    player.online = false;
    player.socketId = null;
    player.lastSeenAt = now();
    room.updatedAt = now();
  }
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
    restartReady: { ...room.restartReady },
    chatMessages: [...room.chatMessages]
  };
}
