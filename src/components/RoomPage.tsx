import { FormEvent, useEffect, useState } from "react";
import { ackOrThrow, socket } from "../client/socketClient";
import { SavedSession, clearSession, loadSession, saveSession } from "../client/storage";
import { PublicRoomState } from "../shared/game";
import { Board } from "./Board";
import { ChatPanel } from "./ChatPanel";
import { requireColor, requireToken } from "./HomePage";
import { PlayerPanel } from "./PlayerPanel";
import { StatusMessage } from "./StatusMessage";

interface Props {
  roomId: string;
  onExit: () => void;
}

interface ShareInfo {
  currentOrigin: string | null;
  lanOrigins: string[];
}

export function RoomPage({ roomId, onExit }: Props) {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [shareOrigin, setShareOrigin] = useState(window.location.origin);
  const [copyLabel, setCopyLabel] = useState("复制链接");
  const [session, setSession] = useState<SavedSession | null>(() => loadSession());
  const myColor = session?.roomId === roomId ? session.color : null;

  useEffect(() => {
    fetch("/api/share-info")
      .then((response) => response.json() as Promise<ShareInfo>)
      .then((shareInfo) => {
        const currentHost = window.location.hostname;
        const isLocalHost = currentHost === "localhost" || currentHost === "127.0.0.1";
        if (isLocalHost && shareInfo.lanOrigins.length > 0) {
          setShareOrigin(shareInfo.lanOrigins[0]);
          return;
        }
        setShareOrigin(shareInfo.currentOrigin ?? window.location.origin);
      })
      .catch(() => {
        setShareOrigin(window.location.origin);
      });
  }, []);

  useEffect(() => {
    function handleRoomState(nextRoom: PublicRoomState) {
      if (nextRoom.id === roomId) {
        setRoom(nextRoom);
      }
    }

    socket.on("room:state", handleRoomState);
    if (session?.roomId === roomId) {
      ackOrThrow<PublicRoomState>("room:join", {
        roomId,
        playerToken: session.playerToken
      })
        .then((response) => {
          setRoom(response.room);
          setError("");
        })
        .catch(() => {
          clearSession();
          setSession(null);
          setError("身份已失效，请重新输入昵称加入。");
        });
    }
    return () => {
      socket.off("room:state", handleRoomState);
    };
  }, [roomId, session]);

  async function joinWithNickname(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await ackOrThrow<PublicRoomState>("room:join", {
        roomId,
        nickname
      });
      const nextSession = {
        roomId: result.room.id,
        playerToken: requireToken(result.playerToken),
        color: requireColor(result.color)
      };
      saveSession(nextSession);
      setSession(nextSession);
      setRoom(result.room);
      setError("");
    } catch {
      setError("无法加入房间：房间不存在、已满或昵称为空。");
    }
  }

  async function placeStone(x: number, y: number) {
    if (!session || session.roomId !== roomId) {
      setError("当前浏览器没有这个房间的玩家身份。");
      return;
    }
    try {
      await ackOrThrow<PublicRoomState>("game:placeStone", {
        roomId,
        playerToken: session.playerToken,
        point: { x, y }
      });
      setError("");
    } catch {
      setError("现在不能在这里落子。");
    }
  }

  async function sendChatMessage(text: string) {
    if (!session || session.roomId !== roomId) {
      setError("当前浏览器没有这个房间的玩家身份。");
      return;
    }
    try {
      await ackOrThrow<PublicRoomState>("chat:send", {
        roomId,
        playerToken: session.playerToken,
        text
      });
      setError("");
    } catch {
      setError("消息发送失败，请稍后再试。");
    }
  }

  async function restartReady() {
    if (!session || session.roomId !== roomId) {
      return;
    }
    await ackOrThrow<PublicRoomState>("game:restartReady", {
      roomId,
      playerToken: session.playerToken
    });
  }

  async function copyRoomUrl() {
    const roomUrl = `${shareOrigin}/room/${roomId}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(roomUrl);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = roomUrl;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopyLabel("已复制");
    window.setTimeout(() => setCopyLabel("复制链接"), 1600);
  }

  const roomUrl = `${shareOrigin}/room/${roomId}`;

  if (!session || session.roomId !== roomId) {
    return (
      <main className="room-shell">
        <section className="home-panel" aria-labelledby="join-title">
          <p className="eyebrow">加入好友房</p>
          <h1 id="join-title">房间 {roomId}</h1>
          <form onSubmit={joinWithNickname}>
            <label>
              昵称
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={16}
                autoComplete="nickname"
              />
            </label>
            <button type="submit">加入房间</button>
          </form>
          <p className={error ? "status-text warning" : "status-text"} role="status">
            {error || "输入昵称后加入这局五子棋。"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="room-shell">
      <section className="room-header">
        <button type="button" onClick={onExit}>返回首页</button>
        <div className="room-title">
          <p className="eyebrow">房间号</p>
          <h1>{roomId}</h1>
          <p className="share-url">{roomUrl}</p>
        </div>
        <button type="button" onClick={copyRoomUrl}>
          {copyLabel}
        </button>
      </section>

      {room ? (
        <section className="game-layout">
          <div className="side-stack">
            <PlayerPanel player={room.players.black} color="black" label="黑棋" />
            <PlayerPanel player={room.players.white} color="white" label="白棋" />
            <StatusMessage room={room} myColor={myColor} error={error} />
            {room.status === "finished" ? (
              <button type="button" className="primary-action" onClick={restartReady}>
                准备下一局
              </button>
            ) : null}
          </div>
          <Board room={room} myColor={myColor} onPlaceStone={placeStone} />
          <ChatPanel
            messages={room.chatMessages}
            disabled={!session || session.roomId !== roomId}
            onSend={sendChatMessage}
          />
        </section>
      ) : (
        <p className="status-text" role="status">正在连接房间...</p>
      )}
    </main>
  );
}
