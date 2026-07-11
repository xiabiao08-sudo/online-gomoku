import { PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  isSpectator: boolean;
  error: string;
}

export function StatusMessage({ room, myColor, isSpectator, error }: Props) {
  if (error) return <p className="status-text warning" role="status">{error}</p>;
  if (room.status === "waiting") return <p className="status-text" role="status">等待好友加入棋手席。</p>;
  if (room.status === "starting") return <p className="status-text strong" role="status">正在随机分配黑白，请稍候…</p>;
  if (room.status === "paused") {
    const leftPlayer = room.players.black?.left || room.players.white?.left;
    return <p className="status-text warning" role="status">{leftPlayer ? "有棋手已离开，原席位不会由观众补充。" : "有棋手离线，对局暂停并等待原棋手重连。"}</p>;
  }
  if (room.status === "finished") {
    return <p className="status-text strong" role="status">{room.isDraw ? "本局和棋" : `${room.winner === "black" ? "黑棋" : "白棋"}获胜`}{isSpectator ? "，等待双方决定是否再来一局。" : "，可以请求再来一局。"}</p>;
  }
  if (room.undoRequest) return <p className="status-text warning" role="status">正在等待悔棋申请处理，暂时不能落子。</p>;
  if (isSpectator) return <p className="status-text" role="status">正在观战，当前轮到{room.currentTurn === "black" ? "黑棋" : "白棋"}。</p>;
  if (myColor === room.currentTurn) return <p className="status-text strong" role="status">轮到你落子：{myColor === "black" ? "黑棋" : "白棋"}。</p>;
  return <p className="status-text" role="status">等待对方落子。</p>;
}
