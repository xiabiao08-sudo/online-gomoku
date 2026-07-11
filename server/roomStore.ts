import crypto from "node:crypto";
import {
  BOARD_SIZE,
  Board,
  ChatMessage,
  GameStatus,
  MAX_SPECTATORS,
  MoveRecord,
  ParticipantRole,
  PendingUndoRequest,
  Point,
  PublicPlayer,
  PublicRoomState,
  PublicSpectator,
  Stone,
  createEmptyBoard,
  findWinningLine,
  isBoardFull,
  oppositeTurn,
  placeStone
} from "../src/shared/game";

interface InternalPlayer extends PublicPlayer {
  token: string;
  socketId: string | null;
  joinedAt: number;
  lastSeenAt: number;
  lastChatAt: number;
}

interface InternalSpectator extends PublicSpectator {
  token: string;
  socketId: string | null;
  joinedAt: number;
  lastSeenAt: number;
  lastChatAt: number;
}

type InternalParticipant = InternalPlayer | InternalSpectator;
type ResumableStatus = Exclude<GameStatus, "paused">;

interface InternalRoom {
  id: string;
  players: {
    black: InternalPlayer | null;
    white: InternalPlayer | null;
  };
  spectators: InternalSpectator[];
  board: Board;
  currentTurn: Stone;
  status: GameStatus;
  pausedFrom: ResumableStatus | null;
  winner: Stone | null;
  isDraw: boolean;
  winningLine: Point[];
  lastMove: Point | null;
  moveHistory: MoveRecord[];
  gameNumber: number;
  roundStartsAt: number | null;
  restartReady: Record<Stone, boolean>;
  undoRequest: PendingUndoRequest | null;
  createdAt: number;
  updatedAt: number;
}

export interface JoinResult {
  room: PublicRoomState;
  playerToken: string;
  participantId: string;
  role: ParticipantRole;
  color?: Stone;
}

export type LeaveResult =
  | { closed: true; roomId: string }
  | { closed: false; room: PublicRoomState };

interface RoomStoreOptions {
  now?: () => number;
  random?: () => number;
  inactiveRoomMs?: number;
  spectatorLimit?: number;
  startingDelayMs?: number;
  chatCooldownMs?: number;
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const rooms = new Map<string, InternalRoom>();
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const inactiveRoomMs = options.inactiveRoomMs ?? 30 * 60 * 1000;
  const spectatorLimit = options.spectatorLimit ?? MAX_SPECTATORS;
  const startingDelayMs = options.startingDelayMs ?? 1_000;
  const chatCooldownMs = options.chatCooldownMs ?? 2_000;

  function createRoom(nickname: string, socketId: string | null = null): JoinResult {
    const timestamp = now();
    const player = createPlayer(nickname, "black", timestamp, socketId);
    const room: InternalRoom = {
      id: createUniqueRoomId(rooms),
      players: { black: player, white: null },
      spectators: [],
      board: createEmptyBoard(),
      currentTurn: "black",
      status: "waiting",
      pausedFrom: null,
      winner: null,
      isDraw: false,
      winningLine: [],
      lastMove: null,
      moveHistory: [],
      gameNumber: 1,
      roundStartsAt: null,
      restartReady: { black: false, white: false },
      undoRequest: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    rooms.set(room.id, room);
    return joinResult(room, player, "black");
  }

  function joinRoom(roomId: string, nickname: string, socketId: string | null = null): JoinResult {
    const room = requireRoom(roomId);
    const timestamp = now();

    if (!room.players.white) {
      const player = createPlayer(nickname, "white", timestamp, socketId);
      room.players.white = player;
      randomizeFirstRoundColors(room);
      beginRound(room);
      room.updatedAt = timestamp;
      return joinResult(room, player, getParticipantRole(room, player));
    }

    if (room.spectators.length >= spectatorLimit) {
      throw new Error("SPECTATOR_LIMIT_REACHED");
    }

    const spectator = createSpectator(nickname, timestamp, socketId);
    room.spectators.push(spectator);
    room.updatedAt = timestamp;
    return joinResult(room, spectator, "spectator");
  }

  function reconnect(roomId: string, token: string, socketId: string | null = null): JoinResult {
    const room = requireRoom(roomId);
    const participant = requireParticipantByToken(room, token);
    participant.online = true;
    participant.socketId = socketId;
    participant.lastSeenAt = now();
    if (isPlayer(participant)) {
      participant.left = false;
      resumeRoomIfPossible(room);
    }
    room.updatedAt = now();
    const role = getParticipantRole(room, participant);
    return joinResult(room, participant, role);
  }

  function markOffline(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const participant = requireParticipantByToken(room, token);
    markParticipantOffline(room, participant);
    return toPublicRoom(room);
  }

  function markOfflineBySocket(socketId: string): PublicRoomState[] {
    const changedRooms: PublicRoomState[] = [];
    for (const room of rooms.values()) {
      const participant = allParticipants(room).find(
        (candidate) => candidate.socketId === socketId
      );
      if (participant) {
        markParticipantOffline(room, participant);
        changedRooms.push(toPublicRoom(room));
      }
    }
    return changedRooms;
  }

  function activateRound(roomId: string): PublicRoomState {
    const room = requireRoom(roomId);
    if (room.roundStartsAt && now() < room.roundStartsAt) {
      return toPublicRoom(room);
    }

    if (room.status === "starting") {
      room.status = bothPlayersAvailable(room) ? "playing" : "paused";
      room.pausedFrom = room.status === "paused" ? "playing" : null;
      room.roundStartsAt = null;
      room.updatedAt = now();
    } else if (room.status === "paused" && room.pausedFrom === "starting") {
      room.pausedFrom = "playing";
      room.roundStartsAt = null;
      room.updatedAt = now();
    }
    return toPublicRoom(room);
  }

  function place(roomId: string, token: string, point: Point): PublicRoomState {
    const room = requireRoom(roomId);
    activateRoundIfDue(room);
    const player = requirePlayerByToken(room, token);
    if (room.status !== "playing") {
      throw new Error("GAME_NOT_PLAYING");
    }
    requireBothPlayersAvailable(room);
    if (room.undoRequest) {
      throw new Error("UNDO_PENDING");
    }
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
      room.isDraw = false;
      room.winningLine = winningLine;
    } else if (isBoardFull(room.board)) {
      room.status = "finished";
      room.winner = null;
      room.isDraw = true;
      room.winningLine = [];
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
    activateRoundIfDue(room);
    const player = requirePlayerByToken(room, token);
    if (room.status !== "playing") {
      throw new Error("UNDO_NOT_AVAILABLE");
    }
    requireBothPlayersAvailable(room);
    const lastMove = room.moveHistory.at(-1);
    if (!lastMove) {
      throw new Error("NO_MOVE_TO_UNDO");
    }
    if (room.undoRequest) {
      throw new Error("UNDO_ALREADY_PENDING");
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
    if (room.status !== "playing") {
      throw new Error("UNDO_NOT_AVAILABLE");
    }
    requireBothPlayersAvailable(room);
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
    room.winner = null;
    room.isDraw = false;
    room.winningLine = [];
    room.restartReady = { black: false, white: false };
    room.undoRequest = null;
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function rejectUndo(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    const request = room.undoRequest;
    if (!request) {
      throw new Error("NO_UNDO_REQUEST");
    }
    if (request.requestedBy === player.color) {
      throw new Error("OPPONENT_RESPONSE_REQUIRED");
    }
    room.undoRequest = null;
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function setRestartReady(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = requirePlayerByToken(room, token);
    if (room.status !== "finished") {
      throw new Error("GAME_NOT_FINISHED");
    }
    room.restartReady[player.color] = true;
    if (room.restartReady.black && room.restartReady.white) {
      resetGameAndSwapColors(room);
      beginRound(room);
    }
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function addChatMessage(roomId: string, token: string, text: string): ChatMessage {
    const room = requireRoom(roomId);
    const participant = requireParticipantByToken(room, token);
    if (!participant.online || (isPlayer(participant) && participant.left)) {
      throw new Error("PARTICIPANT_OFFLINE");
    }
    const timestamp = now();
    if (timestamp - participant.lastChatAt < chatCooldownMs) {
      throw new Error("CHAT_RATE_LIMITED");
    }
    const trimmedText = text.replace(/\s+/g, " ").trim();
    if (!trimmedText) {
      throw new Error("CHAT_MESSAGE_REQUIRED");
    }
    participant.lastChatAt = timestamp;
    room.updatedAt = timestamp;
    const role = getParticipantRole(room, participant);
    return {
      id: crypto.randomUUID(),
      participantId: participant.id,
      nickname: participant.nickname,
      color: role === "spectator" ? null : role,
      text: trimmedText.slice(0, 160),
      createdAt: timestamp
    };
  }

  function leaveRoom(roomId: string, token: string): LeaveResult {
    const room = requireRoom(roomId);
    const participant = requireParticipantByToken(room, token);

    if (!isPlayer(participant)) {
      room.spectators = room.spectators.filter((candidate) => candidate.id !== participant.id);
      room.updatedAt = now();
      return { closed: false, room: toPublicRoom(room) };
    }

    participant.left = true;
    participant.online = false;
    participant.socketId = null;
    participant.lastSeenAt = now();

    if (room.players.black?.left && room.players.white?.left) {
      rooms.delete(room.id);
      return { closed: true, roomId: room.id };
    }

    pauseRoom(room);
    room.updatedAt = now();
    return { closed: false, room: toPublicRoom(room) };
  }

  function deleteInactiveRooms(): number {
    let deleted = 0;
    const cutoff = now() - inactiveRoomMs;
    for (const [roomId, room] of rooms.entries()) {
      const nobodyOnline = allParticipants(room).every((participant) => !participant.online);
      if (nobodyOnline && room.updatedAt < cutoff) {
        rooms.delete(roomId);
        deleted += 1;
      }
    }
    return deleted;
  }

  function getRoom(roomId: string): PublicRoomState {
    const room = requireRoom(roomId);
    activateRoundIfDue(room);
    return toPublicRoom(room);
  }

  return {
    createRoom,
    joinRoom,
    reconnect,
    markOffline,
    markOfflineBySocket,
    activateRound,
    placeStone: place,
    requestUndo,
    approveUndo,
    rejectUndo,
    setRestartReady,
    addChatMessage,
    leaveRoom,
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
      if (room.spectators.some((spectator) => spectator.token === token)) {
        throw new Error("SPECTATOR_ACTION_NOT_ALLOWED");
      }
      throw new Error("INVALID_TOKEN");
    }
    if (player.left) {
      throw new Error("PLAYER_LEFT");
    }
    return player;
  }

  function requireParticipantByToken(room: InternalRoom, token: string): InternalParticipant {
    const participant = findParticipantByToken(room, token);
    if (!participant) {
      throw new Error("INVALID_TOKEN");
    }
    return participant;
  }

  function requireBothPlayersAvailable(room: InternalRoom): void {
    if (!bothPlayersAvailable(room)) {
      throw new Error("PLAYER_OFFLINE");
    }
  }

  function activateRoundIfDue(room: InternalRoom): void {
    if (room.roundStartsAt && now() >= room.roundStartsAt) {
      if (room.status === "starting") {
        room.status = bothPlayersAvailable(room) ? "playing" : "paused";
        room.pausedFrom = room.status === "paused" ? "playing" : null;
      } else if (room.status === "paused" && room.pausedFrom === "starting") {
        room.pausedFrom = "playing";
      }
      room.roundStartsAt = null;
      room.updatedAt = now();
    }
  }

  function markParticipantOffline(room: InternalRoom, participant: InternalParticipant): void {
    participant.online = false;
    participant.socketId = null;
    participant.lastSeenAt = now();
    if (isPlayer(participant)) {
      pauseRoom(room);
    }
    room.updatedAt = now();
  }

  function beginRound(room: InternalRoom): void {
    room.status = "starting";
    room.pausedFrom = null;
    room.roundStartsAt = now() + startingDelayMs;
    if (!bothPlayersAvailable(room)) {
      room.pausedFrom = "starting";
      room.status = "paused";
    }
  }

  function resumeRoomIfPossible(room: InternalRoom): void {
    if (room.status !== "paused" || !bothPlayersAvailable(room)) {
      return;
    }
    activateRoundIfDue(room);
    if (room.status !== "paused") {
      return;
    }
    const nextStatus = room.pausedFrom ?? "playing";
    room.status = nextStatus;
    room.pausedFrom = null;
  }

  function pauseRoom(room: InternalRoom): void {
    if (room.status === "starting" || room.status === "playing") {
      room.pausedFrom = room.status;
      room.status = "paused";
    }
  }

  function randomizeFirstRoundColors(room: InternalRoom): void {
    const creator = room.players.black;
    const joiner = room.players.white;
    if (!creator || !joiner) {
      return;
    }
    if (random() < 0.5) {
      creator.color = "white";
      joiner.color = "black";
      room.players = { black: joiner, white: creator };
    }
  }
}

function resetGameAndSwapColors(room: InternalRoom): void {
  const previousBlack = room.players.black;
  const previousWhite = room.players.white;

  if (previousBlack && previousWhite) {
    previousBlack.color = "white";
    previousWhite.color = "black";
    room.players = {
      black: previousWhite,
      white: previousBlack
    };
  }

  room.board = createEmptyBoard();
  room.currentTurn = "black";
  room.status = "starting";
  room.pausedFrom = null;
  room.winner = null;
  room.isDraw = false;
  room.winningLine = [];
  room.lastMove = null;
  room.moveHistory = [];
  room.gameNumber += 1;
  room.roundStartsAt = null;
  room.restartReady = { black: false, white: false };
  room.undoRequest = null;
}

function createPlayer(
  nickname: string,
  color: Stone,
  timestamp: number,
  socketId: string | null
): InternalPlayer {
  const base = createParticipantBase(nickname, timestamp, socketId);
  return { ...base, color, left: false };
}

function createSpectator(
  nickname: string,
  timestamp: number,
  socketId: string | null
): InternalSpectator {
  return createParticipantBase(nickname, timestamp, socketId);
}

function createParticipantBase(
  nickname: string,
  timestamp: number,
  socketId: string | null
) {
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) {
    throw new Error("NICKNAME_REQUIRED");
  }
  return {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(16).toString("hex"),
    nickname: trimmedNickname.slice(0, 16),
    online: true,
    socketId,
    joinedAt: timestamp,
    lastSeenAt: timestamp,
    lastChatAt: Number.NEGATIVE_INFINITY
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

function allParticipants(room: InternalRoom): InternalParticipant[] {
  return [room.players.black, room.players.white, ...room.spectators].filter(
    (participant): participant is InternalParticipant => Boolean(participant)
  );
}

function findPlayerByToken(room: InternalRoom, token: string): InternalPlayer | null {
  for (const player of [room.players.black, room.players.white]) {
    if (player?.token === token) {
      return player;
    }
  }
  return null;
}

function findParticipantByToken(room: InternalRoom, token: string): InternalParticipant | null {
  return allParticipants(room).find((participant) => participant.token === token) ?? null;
}

function getParticipantRole(
  room: InternalRoom,
  participant: InternalParticipant
): ParticipantRole {
  if (room.players.black?.id === participant.id) {
    return "black";
  }
  if (room.players.white?.id === participant.id) {
    return "white";
  }
  return "spectator";
}

function joinResult(
  room: InternalRoom,
  participant: InternalParticipant,
  role: ParticipantRole
): JoinResult {
  return {
    room: toPublicRoom(room),
    playerToken: participant.token,
    participantId: participant.id,
    role,
    ...(role === "spectator" ? {} : { color: role })
  };
}

function toPublicPlayer(player: InternalPlayer | null): PublicPlayer | null {
  if (!player) {
    return null;
  }
  return {
    id: player.id,
    nickname: player.nickname,
    color: player.color,
    online: player.online,
    left: player.left
  };
}

function toPublicSpectator(spectator: InternalSpectator): PublicSpectator {
  return {
    id: spectator.id,
    nickname: spectator.nickname,
    online: spectator.online
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
    spectators: room.spectators.map(toPublicSpectator),
    maxSpectators: MAX_SPECTATORS,
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    isDraw: room.isDraw,
    winningLine: room.winningLine,
    lastMove: room.lastMove,
    lastMoveColor: lastMove?.color ?? null,
    moveCount: room.moveHistory.length,
    gameNumber: room.gameNumber,
    roundStartsAt: room.roundStartsAt,
    restartReady: { ...room.restartReady },
    undoRequest: room.undoRequest ? { ...room.undoRequest } : null
  };
}

function bothPlayersAvailable(room: InternalRoom): boolean {
  return Boolean(
    room.players.black?.online &&
      room.players.white?.online &&
      !room.players.black.left &&
      !room.players.white.left
  );
}

function isPlayer(participant: InternalParticipant): participant is InternalPlayer {
  return "color" in participant;
}

export const ROOM_BOARD_CAPACITY = BOARD_SIZE * BOARD_SIZE;
