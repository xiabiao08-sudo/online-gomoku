import { PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  onRequestUndo: () => Promise<void>;
  onApproveUndo: () => Promise<void>;
  onRejectUndo: () => Promise<void>;
  onRestartReady: () => Promise<void>;
}

export function GameControls({
  room,
  myColor,
  onRequestUndo,
  onApproveUndo,
  onRejectUndo,
  onRestartReady
}: Props) {
  const opponentColor = myColor ? (myColor === "black" ? "white" : "black") : null;
  const bothOnline = Boolean(
    room.players.black?.online && room.players.white?.online &&
    !room.players.black.left && !room.players.white.left
  );
  const canRequestUndo = Boolean(myColor) && room.status === "playing" && room.moveCount > 0 && !room.undoRequest && bothOnline;
  const canRespondUndo = Boolean(myColor) && Boolean(room.undoRequest) && room.undoRequest?.requestedBy === opponentColor;
  const myRestartReady = myColor ? room.restartReady[myColor] : false;
  const opponentRestartReady = opponentColor ? room.restartReady[opponentColor] : false;
  const restartLabel = opponentRestartReady ? "同意再来一局" : myRestartReady ? "等待对方同意" : "再来一局";

  return (
    <section className="game-controls" aria-label="对局操作">
      <button type="button" onClick={onRequestUndo} disabled={!canRequestUndo}>申请撤回上一手</button>
      {canRespondUndo ? (
        <div className="control-pair">
          <button type="button" className="primary-action" onClick={onApproveUndo}>同意撤回</button>
          <button type="button" onClick={onRejectUndo}>拒绝</button>
        </div>
      ) : null}
      <button type="button" onClick={onRestartReady} disabled={!myColor || room.status !== "finished" || myRestartReady}>
        {restartLabel}
      </button>
      <p>{renderUndoText(room, myColor)}</p>
      <p>{renderRestartText(room, myColor)}</p>
    </section>
  );
}

function renderUndoText(room: PublicRoomState, myColor: Stone | null) {
  if (!myColor) return "观众不能申请或处理悔棋。";
  if (room.status === "finished") return "棋局结束后不能悔棋，只能再来一局。";
  if (!room.undoRequest) return room.moveCount === 0 ? "还没有可撤回的落子。" : "双方同意后，只撤回棋盘上的最新一颗。";
  const requester = room.undoRequest.requestedBy === "black" ? "黑棋" : "白棋";
  return room.undoRequest.requestedBy === myColor
    ? `已申请撤回上一手，等待对方处理。`
    : `${requester}申请撤回上一手，对局暂时停止。`;
}

function renderRestartText(room: PublicRoomState, myColor: Stone | null) {
  if (!myColor) return "观众不能请求再来一局。";
  if (room.status !== "finished") return "胜负或和棋产生后，可以请求再来一局。";
  const opponentColor = myColor === "black" ? "white" : "black";
  if (room.restartReady[opponentColor]) return "对方已同意；你确认后双方交换黑白。";
  if (room.restartReady[myColor]) return "已请求再来一局，等待对方同意。";
  return "双方同意后自动交换黑白，新黑棋先行。";
}
