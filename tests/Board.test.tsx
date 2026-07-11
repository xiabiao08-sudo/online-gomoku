import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Board } from "../src/components/Board";
import { PublicRoomState, createEmptyBoard } from "../src/shared/game";

afterEach(cleanup);

function createRoom(): PublicRoomState {
  return {
    id: "ABC123",
    players: {
      black: { id: "black-id", nickname: "黑棋", color: "black", online: true, left: false },
      white: { id: "white-id", nickname: "白棋", color: "white", online: true, left: false }
    },
    spectators: [],
    maxSpectators: 5,
    board: createEmptyBoard(),
    currentTurn: "black",
    status: "playing",
    winner: null,
    isDraw: false,
    winningLine: [],
    lastMove: null,
    lastMoveColor: null,
    moveCount: 0,
    gameNumber: 1,
    roundStartsAt: null,
    restartReady: { black: false, white: false },
    undoRequest: null
  };
}

function renderBoard(overrides: Partial<React.ComponentProps<typeof Board>> = {}) {
  const onPlaceStone = vi.fn().mockResolvedValue(true);
  render(
    <Board
      room={createRoom()}
      myColor="black"
      onPlaceStone={onPlaceStone}
      requireConfirmation={true}
      onToggleConfirmation={vi.fn()}
      onOpenChat={vi.fn()}
      unreadCount={0}
      onShare={vi.fn()}
      {...overrides}
    />
  );
  return { onPlaceStone };
}

describe("Board", () => {
  it("previews a selected point and requires confirmation", async () => {
    const { onPlaceStone } = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "第 10 列，第 10 行，空位" }));
    expect(screen.getByText("候选位置：第 10 列，第 10 行")).toBeTruthy();
    expect(screen.getByLabelText("所选落子点的五乘五放大预览")).toBeTruthy();
    expect(onPlaceStone).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "确认落子" })[0]);
    await waitFor(() => expect(onPlaceStone).toHaveBeenCalledWith(9, 9));
  });

  it("places immediately when confirmation is disabled", async () => {
    const { onPlaceStone } = renderBoard({ requireConfirmation: false });
    fireEvent.click(screen.getByRole("button", { name: "第 4 列，第 4 行，空位" }));
    await waitFor(() => expect(onPlaceStone).toHaveBeenCalledWith(3, 3));
  });

  it("supports controlled zoom levels", () => {
    renderBoard();
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "放大棋盘" }));
    expect(screen.getByText("125%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "缩小棋盘" }));
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("keeps all intersections disabled for spectators", () => {
    renderBoard({ myColor: null });
    expect(screen.getByRole("button", { name: "第 1 列，第 1 行，空位" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/你正在观战/)).toBeTruthy();
  });
});
