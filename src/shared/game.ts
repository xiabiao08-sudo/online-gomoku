export const BOARD_SIZE = 19;
export const MAX_SPECTATORS = 5;

export type Stone = "black" | "white";
export type ParticipantRole = Stone | "spectator";
export type Cell = Stone | null;
export type Board = Cell[][];
export type GameStatus = "waiting" | "starting" | "playing" | "paused" | "finished";

export interface Point {
  x: number;
  y: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  color: Stone;
  online: boolean;
  left: boolean;
}

export interface PublicSpectator {
  id: string;
  nickname: string;
  online: boolean;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  nickname: string;
  color: Stone | null;
  text: string;
  createdAt: number;
}

export interface MoveRecord {
  point: Point;
  color: Stone;
}

export interface PendingUndoRequest {
  requestedBy: Stone;
  move: MoveRecord;
  createdAt: number;
}

export interface PublicRoomState {
  id: string;
  players: {
    black: PublicPlayer | null;
    white: PublicPlayer | null;
  };
  spectators: PublicSpectator[];
  maxSpectators: number;
  board: Board;
  currentTurn: Stone;
  status: GameStatus;
  winner: Stone | null;
  isDraw: boolean;
  winningLine: Point[];
  lastMove: Point | null;
  lastMoveColor: Stone | null;
  moveCount: number;
  gameNumber: number;
  roundStartsAt: number | null;
  restartReady: Record<Stone, boolean>;
  undoRequest: PendingUndoRequest | null;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

export function isInsideBoard(point: Point): boolean {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < BOARD_SIZE &&
    point.y < BOARD_SIZE
  );
}

export function placeStone(board: Board, point: Point, color: Stone): Board {
  if (!isInsideBoard(point)) {
    throw new Error("POINT_OUT_OF_BOUNDS");
  }
  if (board[point.y][point.x] !== null) {
    throw new Error("POINT_OCCUPIED");
  }
  return board.map((row, y) =>
    row.map((cell, x) => (x === point.x && y === point.y ? color : cell))
  );
}

export function findWinningLine(
  board: Board,
  point: Point,
  color: Stone
): Point[] | null {
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];

  for (const direction of directions) {
    const line = [point];
    collect(board, point, color, direction, line);
    collect(
      board,
      point,
      color,
      { x: -direction.x, y: -direction.y },
      line,
      true
    );
    if (line.length >= 5) {
      return line.sort((left, right) => left.x - right.x || left.y - right.y);
    }
  }
  return null;
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export function oppositeTurn(color: Stone): Stone {
  return color === "black" ? "white" : "black";
}

function collect(
  board: Board,
  point: Point,
  color: Stone,
  direction: Point,
  line: Point[],
  prepend = false
): void {
  for (let step = 1; step < BOARD_SIZE; step += 1) {
    const candidate = {
      x: point.x + direction.x * step,
      y: point.y + direction.y * step
    };
    if (!isInsideBoard(candidate) || board[candidate.y][candidate.x] !== color) {
      break;
    }
    if (prepend) {
      line.unshift(candidate);
    } else {
      line.push(candidate);
    }
  }
}
