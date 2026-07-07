import { io } from "socket.io-client";

export const socket = io({
  autoConnect: true,
  transports: ["websocket", "polling"]
});

export interface AckSuccess<T> {
  ok: true;
  room: T;
  playerToken?: string;
  color?: string;
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
  const response = (await socket.emitWithAck(eventName, payload)) as AckResponse<T>;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response;
}
