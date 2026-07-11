import { Server, Socket } from "socket.io";
import { ChatMessage, ParticipantRole, Point, PublicRoomState, Stone } from "../src/shared/game";
import { createRoomStore } from "./roomStore";

type RoomStore = ReturnType<typeof createRoomStore>;
type Ack = (response: AckResponse) => void;

type AckResponse =
  | {
      ok: true;
      room?: PublicRoomState;
      message?: ChatMessage;
      playerToken?: string;
      participantId?: string;
      role?: ParticipantRole;
      color?: Stone;
      closed?: boolean;
    }
  | { ok: false; error: string };

interface CreatePayload {
  nickname: string;
}

interface JoinPayload {
  roomId: string;
  nickname?: string;
  playerToken?: string;
}

interface MovePayload {
  roomId: string;
  playerToken: string;
  point: Point;
}

interface ChatPayload {
  roomId: string;
  playerToken: string;
  text: string;
}

export function registerSocketHandlers(io: Server, store: RoomStore): void {
  const activationTimers = new Map<string, NodeJS.Timeout>();

  function scheduleRoundActivation(room: PublicRoomState): void {
    if (!room.roundStartsAt) {
      return;
    }
    const current = activationTimers.get(room.id);
    if (current) {
      clearTimeout(current);
    }
    const timer = setTimeout(() => {
      activationTimers.delete(room.id);
      try {
        const nextRoom = store.activateRound(room.id);
        io.to(room.id).emit("room:state", nextRoom);
      } catch {
        // The room may have been explicitly closed before the timer fired.
      }
    }, Math.max(0, room.roundStartsAt - Date.now()) + 20);
    timer.unref();
    activationTimers.set(room.id, timer);
  }

  io.on("connection", (socket) => {
    socket.on("room:create", (payload: CreatePayload, ack: Ack) => {
      respond(ack, () => {
        const result = store.createRoom(payload.nickname, socket.id);
        socket.join(result.room.id);
        io.to(result.room.id).emit("room:state", result.room);
        return { ok: true, ...result };
      });
    });

    socket.on("room:join", (payload: JoinPayload, ack: Ack) => {
      respond(ack, () => {
        const result = payload.playerToken
          ? store.reconnect(payload.roomId, payload.playerToken, socket.id)
          : store.joinRoom(payload.roomId, payload.nickname ?? "", socket.id);
        socket.join(result.room.id);
        io.to(result.room.id).emit("room:state", result.room);
        scheduleRoundActivation(result.room);
        return { ok: true, ...result };
      });
    });

    socket.on("room:leave", (payload: { roomId: string; playerToken: string }, ack: Ack) => {
      respond(ack, () => {
        const result = store.leaveRoom(payload.roomId, payload.playerToken);
        if (result.closed) {
          const timer = activationTimers.get(payload.roomId);
          if (timer) {
            clearTimeout(timer);
            activationTimers.delete(payload.roomId);
          }
          io.to(payload.roomId).emit("room:closed", {
            roomId: payload.roomId,
            reason: "players_left"
          });
          socket.leave(payload.roomId);
          return { ok: true, closed: true };
        }
        io.to(payload.roomId).emit("room:state", result.room);
        socket.leave(payload.roomId);
        return { ok: true, room: result.room, closed: false };
      });
    });

    socket.on("game:placeStone", (payload: MovePayload, ack: Ack) => {
      respond(ack, () => {
        const room = store.placeStone(payload.roomId, payload.playerToken, payload.point);
        io.to(payload.roomId).emit("room:state", room);
        return { ok: true, room };
      });
    });

    socket.on("chat:send", (payload: ChatPayload, ack: Ack) => {
      respond(ack, () => {
        const message = store.addChatMessage(
          payload.roomId,
          payload.playerToken,
          payload.text ?? ""
        );
        io.to(payload.roomId).emit("chat:message", message);
        return { ok: true, message };
      });
    });

    socket.on(
      "game:undoRequest",
      (payload: { roomId: string; playerToken: string }, ack: Ack) => {
        respond(ack, () => {
          const room = store.requestUndo(payload.roomId, payload.playerToken);
          io.to(payload.roomId).emit("room:state", room);
          return { ok: true, room };
        });
      }
    );

    socket.on(
      "game:undoApprove",
      (payload: { roomId: string; playerToken: string }, ack: Ack) => {
        respond(ack, () => {
          const room = store.approveUndo(payload.roomId, payload.playerToken);
          io.to(payload.roomId).emit("room:state", room);
          return { ok: true, room };
        });
      }
    );

    socket.on(
      "game:undoReject",
      (payload: { roomId: string; playerToken: string }, ack: Ack) => {
        respond(ack, () => {
          const room = store.rejectUndo(payload.roomId, payload.playerToken);
          io.to(payload.roomId).emit("room:state", room);
          return { ok: true, room };
        });
      }
    );

    socket.on(
      "game:restartReady",
      (payload: { roomId: string; playerToken: string }, ack: Ack) => {
        respond(ack, () => {
          const room = store.setRestartReady(payload.roomId, payload.playerToken);
          io.to(payload.roomId).emit("room:state", room);
          scheduleRoundActivation(room);
          return { ok: true, room };
        });
      }
    );

    socket.on("disconnect", () => {
      for (const room of store.markOfflineBySocket(socket.id)) {
        io.to(room.id).emit("room:state", room);
      }
    });
  });
}

function respond(ack: Ack | undefined, action: () => AckResponse): void {
  try {
    ack?.(action());
  } catch (error) {
    ack?.({ ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
  }
}

export function emitAck<T extends { ok: boolean }>(
  socket: Socket,
  eventName: string,
  payload: unknown
): Promise<T> {
  return socket.emitWithAck(eventName, payload) as Promise<T>;
}
