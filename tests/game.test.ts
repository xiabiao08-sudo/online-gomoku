import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  createEmptyBoard,
  findWinningLine,
  placeStone
} from "../src/shared/game";

describe("shared game rules", () => {
  it("creates an empty board using the configured board size", () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(BOARD_SIZE);
    expect(board[0]).toHaveLength(BOARD_SIZE);
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });

  it("places a stone immutably", () => {
    const board = createEmptyBoard();
    const next = placeStone(board, { x: 7, y: 7 }, "black");
    expect(board[7][7]).toBe(null);
    expect(next[7][7]).toBe("black");
  });

  it("detects horizontal five in a row", () => {
    let board = createEmptyBoard();
    for (let x = 3; x <= 7; x += 1) {
      board = placeStone(board, { x, y: 6 }, "black");
    }
    expect(findWinningLine(board, { x: 7, y: 6 }, "black")).toEqual([
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 7, y: 6 }
    ]);
  });

  it("detects vertical and diagonal wins", () => {
    let vertical = createEmptyBoard();
    for (let y = 2; y <= 6; y += 1) {
      vertical = placeStone(vertical, { x: 9, y }, "white");
    }
    expect(findWinningLine(vertical, { x: 9, y: 6 }, "white")).toHaveLength(5);

    let diagonal = createEmptyBoard();
    for (let step = 0; step < 5; step += 1) {
      diagonal = placeStone(diagonal, { x: 4 + step, y: 4 + step }, "black");
    }
    expect(findWinningLine(diagonal, { x: 8, y: 8 }, "black")).toHaveLength(5);
  });

  it("does not report four in a row as a win", () => {
    let board = createEmptyBoard();
    for (let x = 1; x <= 4; x += 1) {
      board = placeStone(board, { x, y: 1 }, "black");
    }
    expect(findWinningLine(board, { x: 4, y: 1 }, "black")).toBe(null);
  });
});
