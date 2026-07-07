import { CSSProperties } from "react";
import { BOARD_SIZE, PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  onPlaceStone: (x: number, y: number) => void;
}

export function Board({ room, myColor, onPlaceStone }: Props) {
  const canPlay = room.status === "playing" && myColor === room.currentTurn;
  const winningKeys = new Set(room.winningLine.map((point) => `${point.x}:${point.y}`));
  const lastMoveKey = room.lastMove ? `${room.lastMove.x}:${room.lastMove.y}` : "";
  const boardStyle = {
    "--board-size": BOARD_SIZE,
    "--line-count": BOARD_SIZE - 1
  } as CSSProperties;

  return (
    <div className="board-wrap" aria-label={`${BOARD_SIZE} x ${BOARD_SIZE} 五子棋棋盘`}>
      <div className="board-grid" style={boardStyle}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const stone = room.board[y][x];
          const key = `${x}:${y}`;
          const stoneLabel = stone ? `${stone === "black" ? "黑" : "白"}棋` : "空位";
          return (
            <button
              key={key}
              type="button"
              className={`point ${stone ? "occupied" : ""} ${winningKeys.has(key) ? "winning" : ""}`}
              aria-label={`第 ${x + 1} 列，第 ${y + 1} 行，${stoneLabel}`}
              disabled={!canPlay || Boolean(stone)}
              onClick={() => onPlaceStone(x, y)}
            >
              {stone ? <span className={`stone ${stone}`} /> : <span className="preview-stone" />}
              {lastMoveKey === key ? <span className="last-move" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
