import { io } from "socket.io-client";
import { ChatMessage, ParticipantRole, Stone } from "../shared/game";

const configuredUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketUrl = configuredUrl || (import.meta.env.DEV ? "http://localhost:8788" : undefined);

export const socket = io(socketUrl, {
  autoConnect: true,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 8_000,
  randomizationFactor: 0.45,
  timeout: 12_000
});

export interface AckSuccess<T> {
  ok: true;
  room?: T;
  message?: ChatMessage;
  playerToken?: string;
  participantId?: string;
  role?: ParticipantRole;
  color?: Stone;
  closed?: boolean;
}

export interface AckFailure {
  ok: false;
  error: string;
}

export type AckResponse<T> = AckSuccess<T> | AckFailure;

export async function ackOrThrow<T>(
  eventName: string,
  payload: unknown
): Promise<AckSuccess<T>> {
  const response = (await socket.timeout(12_000).emitWithAck(
    eventName,
    payload
  )) as AckResponse<T>;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response;
}
