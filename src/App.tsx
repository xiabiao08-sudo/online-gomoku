import { useMemo, useState } from "react";
import { HomePage } from "./components/HomePage";
import { RoomPage } from "./components/RoomPage";

export function App() {
  const initialRoomId = useMemo(() => {
    const match = window.location.pathname.match(/^\/room\/([^/]+)$/);
    return match?.[1] ?? null;
  }, []);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);

  function navigateToRoom(nextRoomId: string) {
    window.history.pushState(null, "", `/room/${nextRoomId}`);
    setRoomId(nextRoomId);
  }

  function goHome() {
    window.history.pushState(null, "", "/");
    setRoomId(null);
  }

  return roomId ? (
    <RoomPage roomId={roomId} onExit={goHome} />
  ) : (
    <HomePage onEnterRoom={navigateToRoom} />
  );
}
