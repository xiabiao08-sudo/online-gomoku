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
    registerSocketHandlers(io, createRoomStore({ random: () => 1, startingDelayMs: 0, chatCooldownMs: 0 }));
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

  it("creates and joins a room with server-assigned colors", async () => {
    const black = await connectClient();
    const white = await connectClient();
    const created = await black.emitWithAck("room:create", { nickname: "黑棋" });
    const joined = await white.emitWithAck("room:join", { roomId: created.room.id, nickname: "白棋" });
    expect(created.ok).toBe(true);
    expect(joined.ok).toBe(true);
    expect(joined.room.players.white.nickname).toBe("白棋");
    expect(["starting", "playing"]).toContain(joined.room.status);
  });

  it("broadcasts chat as an ephemeral chat event", async () => {
    const black = await connectClient();
    const white = await connectClient();
    const created = await black.emitWithAck("room:create", { nickname: "黑棋" });
    await white.emitWithAck("room:join", { roomId: created.room.id, nickname: "白棋" });
    const received = new Promise<any>((resolve) => white.once("chat:message", resolve));
    const sent = await black.emitWithAck("chat:send", { roomId: created.room.id, playerToken: created.playerToken, text: "开局吧" });
    const message = await received;
    expect(sent.ok).toBe(true);
    expect(sent.message.text).toBe("开局吧");
    expect(message.nickname).toBe("黑棋");
    expect(sent.room).toBeUndefined();
  });

  it("notifies the room when both players explicitly leave", async () => {
    const black = await connectClient();
    const white = await connectClient();
    const created = await black.emitWithAck("room:create", { nickname: "黑棋" });
    const joined = await white.emitWithAck("room:join", { roomId: created.room.id, nickname: "白棋" });
    await black.emitWithAck("room:leave", { roomId: created.room.id, playerToken: created.playerToken });
    const closedEvent = new Promise<any>((resolve) => white.once("room:closed", resolve));
    const left = await white.emitWithAck("room:leave", { roomId: created.room.id, playerToken: joined.playerToken });
    const payload = await closedEvent;
    expect(left.closed).toBe(true);
    expect(payload.roomId).toBe(created.room.id);
  });
});
