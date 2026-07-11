import { ConnectionStatus } from "../client/useConnectionStatus";

interface Props {
  status: ConnectionStatus;
  elapsedSeconds: number;
}

export function ConnectionBanner({ status, elapsedSeconds }: Props) {
  if (status === "connected") {
    return (
      <div className="connection-banner connected" role="status">
        <span className="connection-dot" /> 游戏服务器已连接
      </div>
    );
  }

  const longWait = elapsedSeconds >= 10;
  return (
    <div className="connection-banner" role="status" aria-live="polite">
      <span className="connection-spinner" aria-hidden="true" />
      <span>
        {status === "error" ? "正在重新连接游戏服务器" : "正在连接游戏服务器"}
        {longWait ? "，免费服务器可能正在唤醒，请保持页面打开" : "…"}
      </span>
    </div>
  );
}
