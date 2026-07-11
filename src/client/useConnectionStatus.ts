import { useEffect, useState } from "react";
import { socket } from "./socketClient";

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(
    socket.connected ? "connected" : "connecting"
  );
  const [startedAt] = useState(Date.now);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onError = () => setStatus("error");
    const onAttempt = () => setStatus("connecting");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.io.on("reconnect_attempt", onAttempt);

    return () => {
      window.clearInterval(timer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.io.off("reconnect_attempt", onAttempt);
    };
  }, [startedAt]);

  return { status, elapsedSeconds };
}
