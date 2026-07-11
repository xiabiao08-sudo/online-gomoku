import { ParticipantRole } from "../shared/game";

const SESSION_KEY = "qizheyiy-gomoku-session";
const CONFIRM_MOVE_KEY = "qizheyiy-confirm-move";

export interface SavedSession {
  roomId: string;
  playerToken: string;
  participantId: string;
  role: ParticipantRole;
}

export function saveSession(session: SavedSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): SavedSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<SavedSession>;
    if (
      typeof value.roomId !== "string" ||
      typeof value.playerToken !== "string" ||
      typeof value.participantId !== "string" ||
      !isRole(value.role)
    ) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      roomId: value.roomId,
      playerToken: value.playerToken,
      participantId: value.participantId,
      role: value.role
    };
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function loadConfirmMovePreference(): boolean {
  const raw = window.localStorage.getItem(CONFIRM_MOVE_KEY);
  return raw === null ? true : raw !== "false";
}

export function saveConfirmMovePreference(enabled: boolean): void {
  window.localStorage.setItem(CONFIRM_MOVE_KEY, String(enabled));
}

function isRole(value: unknown): value is ParticipantRole {
  return value === "black" || value === "white" || value === "spectator";
}
