import { FormEvent, useState } from "react";
import { ackOrThrow } from "../client/socketClient";
import { saveSession } from "../client/storage";
import { PublicRoomState, Stone } from "../shared/game";

interface Props {
  onEnterRoom: (roomId: string) => void;
}

export function HomePage({ onEnterRoom }: Props) {
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("输入昵称，创建房间或加入好友房。");

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await ackOrThrow<PublicRoomState>("room:create", { nickname });
      saveSession({
        roomId: result.room.id,
        playerToken: requireToken(result.playerToken),
        color: requireColor(result.color)
      });
      onEnterRoom(result.room.id);
    } catch {
      setMessage("昵称不能为空，或服务暂时不可用。");
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await ackOrThrow<PublicRoomState>("room:join", {
        roomId: roomId.trim().toUpperCase(),
        nickname
      });
      saveSession({
        roomId: result.room.id,
        playerToken: requireToken(result.playerToken),
        color: requireColor(result.color)
      });
      onEnterRoom(result.room.id);
    } catch {
      setMessage("无法加入房间：房间不存在、已满或昵称为空。");
    }
  }

  return (
    <main className="home-shell">
      <section className="home-panel" aria-labelledby="home-title">
        <p className="eyebrow">好友房 · 自由五子棋</p>
        <h1 id="home-title">在线联机五子棋</h1>
        <p className="home-copy">创建房间，把链接发给好友，两个人到齐即可开局。</p>
        <label>
          昵称
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={16}
            autoComplete="nickname"
          />
        </label>
        <div className="home-actions">
          <form onSubmit={createRoom}>
            <button type="submit">创建房间</button>
          </form>
          <form onSubmit={joinRoom} className="join-form">
            <input
              aria-label="房间号"
              placeholder="房间号"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
            />
            <button type="submit">加入房间</button>
          </form>
        </div>
        <p className="status-text" role="status">{message}</p>
      </section>
    </main>
  );
}

export function requireToken(token: string | undefined): string {
  if (!token) {
    throw new Error("TOKEN_MISSING");
  }
  return token;
}

export function requireColor(color: string | undefined): Stone {
  if (color !== "black" && color !== "white") {
    throw new Error("COLOR_MISSING");
  }
  return color;
}
