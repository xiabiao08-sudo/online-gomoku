import { useEffect, useState } from "react";
import { HomePage } from "./components/HomePage";
import { RoomPage } from "./components/RoomPage";

function roomIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/room\/([^/]+)$/);
  return match?.[1]?.toUpperCase() ?? null;
}

export function App() {
  const [roomId, setRoomId] = useState<string | null>(() =>
    roomIdFromPathname(window.location.pathname)
  );

  useEffect(() => {
    function handlePopState() {
      setRoomId(roomIdFromPathname(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigateToRoom(nextRoomId: string) {
    const normalized = nextRoomId.toUpperCase();
    window.history.pushState(null, "", `/room/${normalized}`);
    setRoomId(normalized);
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
