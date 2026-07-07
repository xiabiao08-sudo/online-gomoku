import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as createClient, Socket as ClientSocket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoomStore } from "../server/roomStore";
import { registerSocketHandlers } from "../server/socketHandlers";

describe("socket handlers", () => {
  let io: Server;
  let url: string;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    const httpServer = createServer();
    io = new Server(httpServer);
    registerSocketHandlers(io, createRoomStore());
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.close());
    clients.length = 0;
    await io.close();
  });

  function connectClient(): Promise<ClientSocket> {
    return new Promise((resolve) => {
      const client = createClient(url);
      clients.push(client);
      client.on("connect", () => resolve(client));
    });
  }

  it("creates and joins a room", async () => {
    const black = await connectClient();
    const white = await connectClient();

    const created = await black.emitWithAck("room:create", { nickname: "黑棋" });
    expect(created.ok).toBe(true);
    expect(created.room.players.black.nickname).toBe("黑棋");

    const joined = await white.emitWithAck("room:join", {
      roomId: created.room.id,
      nickname: "白棋"
    });
    expect(joined.ok).toBe(true);
    expect(joined.room.status).toBe("playing");
    expect(joined.room.players.white.nickname).toBe("白棋");
  });

  it("broadcasts chat messages to room clients", async () => {
    const black = await connectClient();
    const white = await connectClient();

    const created = await black.emitWithAck("room:create", { nickname: "黑棋" });
    await white.emitWithAck("room:join", {
      roomId: created.room.id,
      nickname: "白棋"
    });

    const stateFromWhite = new Promise<any>((resolve) => {
      white.on("room:state", (room) => {
        if (room.chatMessages.length > 0) {
          resolve(room);
        }
      });
    });

    const sent = await black.emitWithAck("chat:send", {
      roomId: created.room.id,
      playerToken: created.playerToken,
      text: "开局吧"
    });
    const broadcastRoom = await stateFromWhite;

    expect(sent.ok).toBe(true);
    expect(sent.room.chatMessages[0].text).toBe("开局吧");
    expect(broadcastRoom.chatMessages[0].nickname).toBe("黑棋");
  });
});
