import { Stone } from "../shared/game";

const KEY = "online-gomoku-session";

export interface SavedSession {
  roomId: string;
  playerToken: string;
  color: Stone;
}

export function saveSession(session: SavedSession): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): SavedSession | null {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SavedSession;
  } catch {
    window.localStorage.removeItem(KEY);
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
