import { FormEvent, useState } from "react";
import { useConnectionStatus } from "../client/useConnectionStatus";
import { ackOrThrow } from "../client/socketClient";
import { SavedSession, saveSession } from "../client/storage";
import { ParticipantRole, PublicRoomState } from "../shared/game";
import { ConnectionBanner } from "./ConnectionBanner";

interface Props {
  onEnterRoom: (roomId: string) => void;
}

export function HomePage({ onEnterRoom }: Props) {
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("无需注册，创建棋局后把链接发给好友。");
  const { status, elapsedSeconds } = useConnectionStatus();
  const connected = status === "connected";

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!connected) {
      setMessage("游戏服务器仍在连接，请保持页面打开。");
      return;
    }
    try {
      const result = await ackOrThrow<PublicRoomState>("room:create", { nickname });
      saveSession(sessionFromAck(result));
      onEnterRoom(requireRoom(result).id);
    } catch {
      setMessage("昵称不能为空，或服务暂时不可用。");
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!connected) {
      setMessage("游戏服务器仍在连接，请保持页面打开。");
      return;
    }
    try {
      const result = await ackOrThrow<PublicRoomState>("room:join", {
        roomId: roomId.trim().toUpperCase(),
        nickname
      });
      saveSession(sessionFromAck(result));
      onEnterRoom(requireRoom(result).id);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(
        code === "SPECTATOR_LIMIT_REACHED"
          ? "观众席已满，本房间最多容纳5名观众。"
          : "无法加入棋局：请检查房间号、昵称或网络连接。"
      );
    }
  }

  return (
    <main className="home-shell">
      <section className="home-panel hero-panel" aria-labelledby="home-title">
        <div className="brand-mark" aria-hidden="true">弈</div>
        <p className="eyebrow">好友五子棋 · ONLINE GOMOKU</p>
        <h1 id="home-title">棋者弈也</h1>
        <p className="home-copy">
          19×19 自由五子棋。无需注册，创建棋局，邀请好友即刻对弈。
        </p>
        <ConnectionBanner status={status} elapsedSeconds={elapsedSeconds} />
        <label>
          你的昵称
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={16}
            autoComplete="nickname"
            placeholder="最多16个字"
          />
        </label>
        <div className="home-actions">
          <form onSubmit={createRoom}>
            <button type="submit" className="primary-action" disabled={!connected}>
              创建棋局
            </button>
          </form>
          <form onSubmit={joinRoom} className="join-form">
            <input
              aria-label="房间号"
              placeholder="输入房间号"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              maxLength={6}
            />
            <button type="submit" disabled={!connected}>加入棋局</button>
          </form>
        </div>
        <p className="status-text subtle" role="status">{message}</p>
        <p className="rule-summary">无禁手 · 五子及以上获胜 · 满盘判和 · 首局随机黑白</p>
      </section>
    </main>
  );
}

export function sessionFromAck(result: {
  room?: PublicRoomState;
  playerToken?: string;
  participantId?: string;
  role?: ParticipantRole;
}): SavedSession {
  const room = requireRoom(result);
  return {
    roomId: room.id,
    playerToken: requireString(result.playerToken, "TOKEN_MISSING"),
    participantId: requireString(result.participantId, "PARTICIPANT_ID_MISSING"),
    role: requireRole(result.role)
  };
}

export function requireRoom(result: { room?: PublicRoomState }): PublicRoomState {
  if (!result.room) {
    throw new Error("ROOM_MISSING");
  }
  return result.room;
}

function requireString(value: string | undefined, error: string): string {
  if (!value) {
    throw new Error(error);
  }
  return value;
}

function requireRole(role: ParticipantRole | undefined): ParticipantRole {
  if (role !== "black" && role !== "white" && role !== "spectator") {
    throw new Error("ROLE_MISSING");
  }
  return role;
}
