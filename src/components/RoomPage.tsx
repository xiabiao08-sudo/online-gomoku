import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ackOrThrow, AckSuccess, socket } from "../client/socketClient";
import {
  SavedSession,
  clearSession,
  loadConfirmMovePreference,
  loadSession,
  saveConfirmMovePreference,
  saveSession
} from "../client/storage";
import { useConnectionStatus } from "../client/useConnectionStatus";
import { ChatMessage, ParticipantRole, PublicRoomState, Stone } from "../shared/game";
import { Board } from "./Board";
import { ChatPanel } from "./ChatPanel";
import { ConnectionBanner } from "./ConnectionBanner";
import { GameControls } from "./GameControls";
import { requireRoom, sessionFromAck } from "./HomePage";
import { PlayerPanel } from "./PlayerPanel";
import { SpectatorPanel } from "./SpectatorPanel";
import { StatusMessage } from "./StatusMessage";

interface Props {
  roomId: string;
  onExit: () => void;
}

export function RoomPage({ roomId, onExit }: Props) {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [shareLabel, setShareLabel] = useState("分享房间");
  const [session, setSession] = useState<SavedSession | null>(() => loadSession());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [requireConfirmation, setRequireConfirmation] = useState(loadConfirmMovePreference);
  const [roomClosed, setRoomClosed] = useState(false);
  const { status: connectionStatus, elapsedSeconds } = useConnectionStatus();
  const chatOpenRef = useRef(chatOpen);
  const participantIdRef = useRef(session?.participantId);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    participantIdRef.current = session?.participantId;
  }, [session?.participantId]);

  const myRole = room && session
    ? roleForParticipant(room, session.participantId)
    : session?.role ?? null;
  const myColor: Stone | null = myRole === "black" || myRole === "white" ? myRole : null;
  const roomUrl = `${window.location.origin}/room/${roomId}`;
  const opponent = useMemo(() => {
    if (!room || !myColor) {
      return null;
    }
    return myColor === "black" ? room.players.white : room.players.black;
  }, [myColor, room]);

  useEffect(() => {
    setChatMessages([]);
    setUnreadCount(0);
    setRoomClosed(false);

    function handleRoomState(nextRoom: PublicRoomState) {
      if (nextRoom.id === roomId) {
        setRoom(nextRoom);
      }
    }

    function handleChatMessage(message: ChatMessage) {
      setChatMessages((messages) => [...messages, message].slice(-100));
      if (!chatOpenRef.current && message.participantId !== participantIdRef.current) {
        setUnreadCount((count) => count + 1);
      }
    }

    function handleClosed(payload: { roomId: string }) {
      if (payload.roomId !== roomId) {
        return;
      }
      clearSession();
      setSession(null);
      setRoom(null);
      setRoomClosed(true);
      setChatMessages([]);
    }

    function clearTransientChat() {
      setChatMessages([]);
      setUnreadCount(0);
    }

    socket.on("room:state", handleRoomState);
    socket.on("chat:message", handleChatMessage);
    socket.on("room:closed", handleClosed);
    socket.on("disconnect", clearTransientChat);

    if (session?.roomId === roomId) {
      ackOrThrow<PublicRoomState>("room:join", {
        roomId,
        playerToken: session.playerToken
      })
        .then((response) => {
          applyJoinedSession(response);
          setRoom(requireRoom(response));
          setError("");
        })
        .catch(() => {
          clearSession();
          setSession(null);
          setError("身份或房间已失效，请重新输入昵称加入。服务器重启后旧房间会消失。");
        });
    }

    return () => {
      socket.off("room:state", handleRoomState);
      socket.off("chat:message", handleChatMessage);
      socket.off("room:closed", handleClosed);
      socket.off("disconnect", clearTransientChat);
    };
  }, [roomId]);

  useEffect(() => {
    if (!room || !session || session.roomId !== roomId) {
      return;
    }
    const currentRole = roleForParticipant(room, session.participantId);
    if (currentRole && currentRole !== session.role) {
      const nextSession = { ...session, role: currentRole };
      saveSession(nextSession);
      setSession(nextSession);
    }
  }, [room, roomId, session]);

  function applyJoinedSession(response: AckSuccess<PublicRoomState>) {
    const nextSession = sessionFromAck(response);
    saveSession(nextSession);
    setSession(nextSession);
  }

  async function joinWithNickname(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await ackOrThrow<PublicRoomState>("room:join", { roomId, nickname });
      applyJoinedSession(result);
      setRoom(requireRoom(result));
      setError("");
    } catch (joinError) {
      const code = joinError instanceof Error ? joinError.message : "";
      setError(
        code === "SPECTATOR_LIMIT_REACHED"
          ? "观众席已满，本房间最多5名观众。"
          : "无法加入棋局：房间可能不存在，或昵称为空。"
      );
    }
  }

  async function placeStone(x: number, y: number): Promise<boolean> {
    if (!session || session.roomId !== roomId || !myColor) {
      setError("观众不能落子，或当前浏览器没有棋手身份。");
      return false;
    }
    try {
      await ackOrThrow<PublicRoomState>("game:placeStone", {
        roomId,
        playerToken: session.playerToken,
        point: { x, y }
      });
      setError("");
      return true;
    } catch {
      setError("现在不能在这里落子，请确认轮次、网络和所选位置。");
      return false;
    }
  }

  async function sendChatMessage(text: string) {
    if (!session || session.roomId !== roomId) {
      setError("当前浏览器没有这个房间的身份。");
      return;
    }
    try {
      await ackOrThrow<PublicRoomState>("chat:send", {
        roomId,
        playerToken: session.playerToken,
        text
      });
      setError("");
    } catch (chatError) {
      const code = chatError instanceof Error ? chatError.message : "";
      setError(code === "CHAT_RATE_LIMITED" ? "发送太快，请两秒后再试。" : "消息发送失败，请稍后再试。");
    }
  }

  async function requestUndo() {
    if (!session || !myColor) {
      setError("观众不能申请悔棋。");
      return;
    }
    try {
      await ackOrThrow<PublicRoomState>("game:undoRequest", { roomId, playerToken: session.playerToken });
      setError("");
    } catch {
      setError("当前不能申请撤回上一手；棋局结束后只能再来一局。");
    }
  }

  async function respondUndo(approve: boolean) {
    if (!session || !myColor) {
      return;
    }
    try {
      await ackOrThrow<PublicRoomState>(approve ? "game:undoApprove" : "game:undoReject", {
        roomId,
        playerToken: session.playerToken
      });
      setError("");
    } catch {
      setError("当前没有可处理的悔棋申请。");
    }
  }

  async function restartReady() {
    if (!session || !myColor) {
      setError("观众不能请求再来一局。");
      return;
    }
    try {
      await ackOrThrow<PublicRoomState>("game:restartReady", { roomId, playerToken: session.playerToken });
      setError("");
    } catch {
      setError("只有棋局结束后才能请求再来一局。");
    }
  }

  async function shareRoom() {
    const shareData = {
      title: "棋者弈也｜好友五子棋",
      text: `来「棋者弈也」和我下一局五子棋\n房间号：${roomId}`,
      url: roomUrl
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareLabel("已打开分享");
      } else {
        await copyText(roomUrl);
        setShareLabel("链接已复制");
      }
    } catch {
      // Closing the native share sheet is not an application error.
    }
    window.setTimeout(() => setShareLabel("分享房间"), 1600);
  }

  async function copyRoomUrl() {
    await copyText(roomUrl);
    setShareLabel("链接已复制");
    window.setTimeout(() => setShareLabel("分享房间"), 1600);
  }

  function toggleConfirmation() {
    const next = !requireConfirmation;
    setRequireConfirmation(next);
    saveConfirmMovePreference(next);
  }

  function openChat() {
    setChatOpen(true);
    setUnreadCount(0);
  }

  async function leaveRoom() {
    const currentSession = session;
    if (currentSession?.roomId === roomId) {
      try {
        await ackOrThrow<PublicRoomState>("room:leave", {
          roomId,
          playerToken: currentSession.playerToken
        });
      } catch {
        // Local exit still succeeds if the server cannot acknowledge it.
      }
    }
    clearSession();
    setSession(null);
    setRoom(null);
    setChatMessages([]);
    onExit();
  }

  if (roomClosed) {
    return (
      <main className="room-shell">
        <section className="home-panel closed-panel">
          <p className="eyebrow">棋者弈也</p>
          <h1>本局已结束</h1>
          <p className="home-copy">双方棋手均已离开，该棋局已经关闭。</p>
          <button type="button" className="primary-action" onClick={onExit}>创建新棋局</button>
        </section>
      </main>
    );
  }

  if (!session || session.roomId !== roomId) {
    return (
      <main className="room-shell">
        <section className="home-panel" aria-labelledby="join-title">
          <p className="eyebrow">棋者弈也 · 加入好友棋局</p>
          <h1 id="join-title">房间 {roomId}</h1>
          <p className="home-copy">前两位用户对弈；棋手席已满时，后来者进入观众席（最多5人）。</p>
          <ConnectionBanner status={connectionStatus} elapsedSeconds={elapsedSeconds} />
          <form onSubmit={joinWithNickname}>
            <label>
              昵称
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={16} autoComplete="nickname" />
            </label>
            <button type="submit" className="primary-action" disabled={connectionStatus !== "connected"}>加入棋局</button>
          </form>
          <p className={error ? "status-text warning" : "status-text subtle"} role="status">
            {error || "输入昵称后加入。新加入者不会看到此前聊天记录。"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="room-shell has-mobile-bar">
      <header className="room-header">
        <button type="button" onClick={() => void leaveRoom()}>离开棋局</button>
        <div className="room-title">
          <p className="eyebrow">棋者弈也 · 房间号</p>
          <h1>{roomId}</h1>
          <p className="share-url">{roomUrl}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="primary-action" onClick={() => void shareRoom()}>{shareLabel}</button>
          <button type="button" onClick={() => void copyRoomUrl()}>复制链接</button>
        </div>
      </header>

      <ConnectionBanner status={connectionStatus} elapsedSeconds={elapsedSeconds} />

      {room ? (
        <>
          <section className="sticky-game-status" aria-label="当前对局状态">
            <span className={`mini-stone ${myColor ?? "spectator"}`} aria-hidden="true" />
            <strong>{myRole === "spectator" ? "你是观众" : `你执${myColor === "black" ? "黑" : "白"}`}</strong>
            <span>{renderTurnLabel(room, myColor, myRole === "spectator")}</span>
            <span className={opponent?.online && !opponent.left ? "online-state" : "offline-state"}>
              {myRole === "spectator" ? `${room.spectators.filter((item) => item.online).length}名观众在线` : opponent?.left ? "对手已离开" : opponent?.online ? "对手在线" : "对手离线"}
            </span>
            <button type="button" className="confirmation-toggle" onClick={toggleConfirmation} disabled={!myColor}>
              确认落子：{requireConfirmation ? "开" : "关"}
            </button>
          </section>

          {myRole === "spectator" ? (
            <p className="spectator-banner" role="status">你当前在观众席，可以查看棋局、缩放棋盘并参与实时聊天。</p>
          ) : null}

          <section className="game-layout">
            <div className="side-stack">
              <PlayerPanel player={room.players.black} color="black" label="黑棋" />
              <PlayerPanel player={room.players.white} color="white" label="白棋" />
              <StatusMessage room={room} myColor={myColor} isSpectator={myRole === "spectator"} error={error} />
              <GameControls
                room={room}
                myColor={myColor}
                onRequestUndo={requestUndo}
                onApproveUndo={() => respondUndo(true)}
                onRejectUndo={() => respondUndo(false)}
                onRestartReady={restartReady}
              />
              <SpectatorPanel spectators={room.spectators} maxSpectators={room.maxSpectators} />
            </div>

            <Board
              room={room}
              myColor={myColor}
              onPlaceStone={placeStone}
              requireConfirmation={requireConfirmation}
              onToggleConfirmation={toggleConfirmation}
              onOpenChat={openChat}
              unreadCount={unreadCount}
              onShare={() => void shareRoom()}
            />

            <ChatPanel
              messages={chatMessages}
              disabled={!session}
              onSend={sendChatMessage}
              open={chatOpen}
              onClose={() => setChatOpen(false)}
            />
          </section>

          {room.status === "finished" ? (
            <section className="result-card" aria-label="对局结果">
              <p className="eyebrow">对局结束</p>
              <h2>{room.isDraw ? "和棋" : `${room.winner === "black" ? "黑" : "白"}棋获胜`}</h2>
              <p>{room.isDraw ? "棋盘已满，双方未形成五连。" : "获胜连线已在棋盘上标出。"}</p>
              {myColor ? (
                <button type="button" className="primary-action" onClick={restartReady} disabled={room.restartReady[myColor]}>
                  {room.restartReady[myColor] ? "等待对方同意" : "再来一局"}
                </button>
              ) : (
                <p>等待双方决定是否再来一局。</p>
              )}
            </section>
          ) : null}
        </>
      ) : (
        <p className="status-text" role="status">正在进入房间并恢复身份…</p>
      )}
    </main>
  );
}

function roleForParticipant(room: PublicRoomState, participantId: string): ParticipantRole | null {
  if (room.players.black?.id === participantId) return "black";
  if (room.players.white?.id === participantId) return "white";
  if (room.spectators.some((spectator) => spectator.id === participantId)) return "spectator";
  return null;
}

function renderTurnLabel(room: PublicRoomState, myColor: Stone | null, spectator: boolean): string {
  if (room.status === "waiting") return "等待好友加入";
  if (room.status === "starting") return "正在分配黑白";
  if (room.status === "paused") return "对局已暂停";
  if (room.status === "finished") return "对局结束";
  if (spectator) return `轮到${room.currentTurn === "black" ? "黑" : "白"}棋`;
  return myColor === room.currentTurn ? "轮到你" : "等待对方";
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
