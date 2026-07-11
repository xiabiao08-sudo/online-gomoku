import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatMessage } from "../shared/game";

interface Props {
  messages: ChatMessage[];
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ messages, disabled, onSend, open, onClose }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextText = text.trim();
    if (!nextText || sending || disabled) {
      return;
    }
    setSending(true);
    try {
      await onSend(nextText);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className={`chat-panel ${open ? "open" : ""}`} aria-label="房间聊天">
      <div className="chat-header">
        <div>
          <h2>房间聊天</h2>
          <span>仅显示本次在线期间收到的消息</span>
        </div>
        <button type="button" className="chat-close" onClick={onClose}>关闭</button>
      </div>
      <div className="chat-list" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="chat-empty">暂无新消息。新加入、刷新或重连后不会补发历史聊天。</p>
        ) : (
          messages.map((message) => (
            <article className="chat-message" key={message.id}>
              <div className="chat-meta">
                <span className={message.color ? `mini-stone ${message.color}` : "spectator-badge"} aria-hidden="true">{message.color ? "" : "观"}</span>
                <strong>{message.nickname}</strong>
                <time>{formatTime(message.createdAt)}</time>
              </div>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={160}
          placeholder={disabled ? "加入房间后聊天" : "输入消息（每2秒最多一条）"}
          disabled={disabled}
        />
        <button type="submit" className="primary-action" disabled={disabled || sending || !text.trim()}>
          发送
        </button>
      </form>
    </aside>
  );
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
