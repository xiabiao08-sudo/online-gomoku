import { PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  onRequestUndo: () => Promise<void>;
  onApproveUndo: () => Promise<void>;
  onRestartReady: () => Promise<void>;
}

export function GameControls({
  room,
  myColor,
  onRequestUndo,
  onApproveUndo,
  onRestartReady
}: Props) {
  const opponentColor = myColor ? (myColor === "black" ? "white" : "black") : null;
  const canRequestUndo =
    Boolean(myColor) &&
    room.moveCount > 0 &&
    room.lastMoveColor === myColor &&
    !room.undoRequest &&
    room.players.black?.online &&
    room.players.white?.online;
  const canApproveUndo =
    Boolean(myColor) &&
    Boolean(room.undoRequest) &&
    room.undoRequest?.requestedBy === opponentColor;
  const myRestartReady = myColor ? room.restartReady[myColor] : false;
  const opponentRestartReady = opponentColor ? room.restartReady[opponentColor] : false;
  const restartLabel = opponentRestartReady ? "同意重开" : myRestartReady ? "等待对方同意" : "请求重开";
  const undoText = renderUndoText(room, myColor);
  const restartText = renderRestartText(room, myColor);

  return (
    <section className="game-controls" aria-label="对局操作">
      <button type="button" onClick={onRequestUndo} disabled={!canRequestUndo}>
        申请悔棋
      </button>
      <button type="button" onClick={onApproveUndo} disabled={!canApproveUndo}>
        同意悔棋
      </button>
      <button type="button" onClick={onRestartReady} disabled={!myColor || myRestartReady}>
        {restartLabel}
      </button>
      <p>{undoText}</p>
      <p>{restartText}</p>
    </section>
  );
}

function renderUndoText(room: PublicRoomState, myColor: Stone | null) {
  if (!room.undoRequest) {
    if (room.moveCount === 0) {
      return "还没有可悔棋的落子。";
    }
    if (room.lastMoveColor === myColor) {
      return "如果刚才点错位置，可以申请悔棋。";
    }
    return "只有刚落子的玩家可以申请悔棋。";
  }
  const requester = room.undoRequest.requestedBy === "black" ? "黑棋" : "白棋";
  if (room.undoRequest.requestedBy === myColor) {
    return `已向对方申请悔棋：${requester}最后一手。`;
  }
  return `${requester}申请悔棋，确认后会撤回最后一手。`;
}

function renderRestartText(room: PublicRoomState, myColor: Stone | null) {
  if (!myColor) {
    return "加入房间后可以请求重开。";
  }
  const opponentColor = myColor === "black" ? "white" : "black";
  if (room.restartReady.black && room.restartReady.white) {
    return "正在重开。";
  }
  if (room.restartReady[opponentColor]) {
    return "对方请求重开，同意后清空棋盘重新开始。";
  }
  if (room.restartReady[myColor]) {
    return "已请求重开，等待对方同意。";
  }
  return "双方同意后可立即清空棋盘重开。";
}
