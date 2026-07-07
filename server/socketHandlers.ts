import { Server, Socket } from "socket.io";
import { Point } from "../src/shared/game";
import { createRoomStore } from "./roomStore";

type RoomStore = ReturnType<typeof createRoomStore>;
type Ack = (response: AckResponse) => void;

type AckResponse =
  | { ok: true; room: unknown; playerToken?: string; color?: string }
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
          ? {
              room: store.reconnect(payload.roomId, payload.playerToken, socket.id),
              playerToken: payload.playerToken
            }
          : store.joinRoom(payload.roomId, payload.nickname ?? "", socket.id);
        socket.join(result.room.id);
        io.to(result.room.id).emit("room:state", result.room);
        return { ok: true, ...result };
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
        const room = store.addChatMessage(
          payload.roomId,
          payload.playerToken,
          payload.text ?? ""
        );
        io.to(payload.roomId).emit("room:state", room);
        return { ok: true, room };
      });
    });

    socket.on(
      "game:restartReady",
      (payload: { roomId: string; playerToken: string }, ack: Ack) => {
        respond(ack, () => {
          const room = store.setRestartReady(payload.roomId, payload.playerToken);
          io.to(payload.roomId).emit("room:state", room);
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
