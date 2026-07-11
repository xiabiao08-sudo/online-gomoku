import { PublicPlayer, Stone } from "../shared/game";

interface Props {
  player: PublicPlayer | null;
  color: Stone;
  label: string;
}

export function PlayerPanel({ player, color, label }: Props) {
  const state = !player ? "空位" : player.left ? "已离开" : player.online ? "在线" : "离线";
  return (
    <aside className="player-panel">
      <span className={`mini-stone ${color}`} aria-hidden="true" />
      <div>
        <p className="panel-label">{label}</p>
        <strong>{player?.nickname ?? "等待加入"}</strong>
        <p className={`player-state ${player?.online && !player.left ? "online-state" : "offline-state"}`}>{state}</p>
      </div>
    </aside>
  );
}
