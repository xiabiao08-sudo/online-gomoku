import { PublicSpectator } from "../shared/game";

interface Props {
  spectators: PublicSpectator[];
  maxSpectators: number;
}

export function SpectatorPanel({ spectators, maxSpectators }: Props) {
  const onlineCount = spectators.filter((spectator) => spectator.online).length;
  return (
    <aside className="spectator-panel" aria-label="观众席">
      <div className="spectator-heading">
        <p className="panel-label">观众席</p>
        <span>{onlineCount}/{maxSpectators} 在线</span>
      </div>
      {spectators.length === 0 ? <p className="spectator-empty">暂无观众</p> : (
        <ul className="spectator-list">
          {spectators.map((spectator) => (
            <li key={spectator.id}>
              <span className={`online-dot ${spectator.online ? "online" : ""}`} aria-hidden="true" />
              <span>{spectator.nickname}</span>
              <small>{spectator.online ? "观众" : "离线"}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="spectator-note">观众可看棋和聊天，但不能补位或操作棋局。</p>
    </aside>
  );
}
