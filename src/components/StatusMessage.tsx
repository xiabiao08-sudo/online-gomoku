import { PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  error: string;
}

export function StatusMessage({ room, myColor, error }: Props) {
  if (error) {
    return <p className="status-text warning" role="status">{error}</p>;
  }
  if (room.status === "waiting") {
    return <p className="status-text" role="status">等待好友加入。</p>;
  }
  if (room.status === "finished") {
    return (
      <p className="status-text strong" role="status">
        {room.winner === "black" ? "黑棋" : "白棋"}获胜，可以请求重开。
      </p>
    );
  }
  const blackOnline = room.players.black?.online;
  const whiteOnline = room.players.white?.online;
  if (!blackOnline || !whiteOnline) {
    return <p className="status-text warning" role="status">对方离线，等待重连。</p>;
  }
  if (myColor === room.currentTurn) {
    return (
      <p className="status-text strong" role="status">
        轮到你落子：{myColor === "black" ? "黑棋" : "白棋"}。
      </p>
    );
  }
  return <p className="status-text" role="status">等待对方落子。</p>;
}
