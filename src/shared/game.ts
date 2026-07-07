export const BOARD_SIZE = 19;

export type Stone = "black" | "white";
export type Cell = Stone | null;
export type Board = Cell[][];
export type GameStatus = "waiting" | "playing" | "finished";

export interface Point {
  x: number;
  y: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  color: Stone;
  online: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  color: Stone;
  text: string;
  createdAt: number;
}

export interface PublicRoomState {
  id: string;
  players: {
    black: PublicPlayer | null;
    white: PublicPlayer | null;
  };
  board: Board;
  currentTurn: Stone;
  status: GameStatus;
  winner: Stone | null;
  winningLine: Point[];
  lastMove: Point | null;
  restartReady: Record<Stone, boolean>;
  chatMessages: ChatMessage[];
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
    point.x < BOARD_SIZE &&
    point.y >= 0 &&
    point.y < BOARD_SIZE
  );
}

export function placeStone(board: Board, point: Point, stone: Stone): Board {
  if (!isInsideBoard(point)) {
    throw new Error("POINT_OUT_OF_RANGE");
  }
  if (board[point.y][point.x] !== null) {
    throw new Error("CELL_OCCUPIED");
  }
  return board.map((row, y) =>
    row.map((cell, x) => (x === point.x && y === point.y ? stone : cell))
  );
}

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 }
];

export function findWinningLine(
  board: Board,
  lastMove: Point,
  stone: Stone
): Point[] | null {
  for (const direction of DIRECTIONS) {
    const line = collectLine(board, lastMove, stone, direction);
    if (line.length >= 5) {
      return line.slice(0, 5);
    }
  }
  return null;
}

function collectLine(
  board: Board,
  origin: Point,
  stone: Stone,
  direction: Point
): Point[] {
  const backward = collectDirection(board, origin, stone, {
    x: -direction.x,
    y: -direction.y
  }).reverse();
  const forward = collectDirection(board, origin, stone, direction);
  return [...backward, origin, ...forward];
}

function collectDirection(
  board: Board,
  origin: Point,
  stone: Stone,
  direction: Point
): Point[] {
  const points: Point[] = [];
  let cursor = { x: origin.x + direction.x, y: origin.y + direction.y };
  while (isInsideBoard(cursor) && board[cursor.y][cursor.x] === stone) {
    points.push(cursor);
    cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y };
  }
  return points;
}

export function oppositeTurn(stone: Stone): Stone {
  return stone === "black" ? "white" : "black";
}
