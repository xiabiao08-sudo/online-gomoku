import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatMessage } from "../shared/game";

interface Props {
  messages: ChatMessage[];
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
}

export function ChatPanel({ messages, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

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
    <aside className="chat-panel" aria-label="房间聊天">
      <div className="chat-header">
        <h2>聊天</h2>
        <span>{messages.length}/50</span>
      </div>
      <div className="chat-list" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="chat-empty">还没有消息。</p>
        ) : (
          messages.map((message) => (
            <article className="chat-message" key={message.id}>
              <div className="chat-meta">
                <span className={`mini-stone ${message.color}`} aria-hidden="true" />
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
          placeholder={disabled ? "加入房间后聊天" : "输入消息"}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || sending || !text.trim()}>
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
