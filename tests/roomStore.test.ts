import { describe, expect, it } from "vitest";
import { createRoomStore } from "../server/roomStore";

describe("room store", () => {
  it("creates a room with black player", () => {
    const store = createRoomStore();
    const result = store.createRoom("主人");
    expect(result.room.players.black?.nickname).toBe("主人");
    expect(result.room.players.white).toBe(null);
    expect(result.room.status).toBe("waiting");
    expect(result.playerToken).toHaveLength(32);
    expect(result.room.chatMessages).toEqual([]);
  });

  it("joins a second player as white and starts the game", () => {
    const store = createRoomStore();
    const created = store.createRoom("黑棋");
    const joined = store.joinRoom(created.room.id, "白棋");
    expect(joined.room.players.white?.nickname).toBe("白棋");
    expect(joined.room.status).toBe("playing");
    expect(joined.room.currentTurn).toBe("black");
  });

  it("rejects a third player", () => {
    const store = createRoomStore();
    const created = store.createRoom("黑棋");
    store.joinRoom(created.room.id, "白棋");
    expect(() => store.joinRoom(created.room.id, "第三人")).toThrow("ROOM_FULL");
  });

  it("places moves, switches turns, and finishes on five in a row", () => {
    const store = createRoomStore();
    const black = store.createRoom("黑棋");
    const white = store.joinRoom(black.room.id, "白棋");
    const roomId = black.room.id;
    const blackToken = black.playerToken;
    const whiteToken = white.playerToken;

    store.placeStone(roomId, blackToken, { x: 0, y: 0 });
    store.placeStone(roomId, whiteToken, { x: 0, y: 1 });
    store.placeStone(roomId, blackToken, { x: 1, y: 0 });
    store.placeStone(roomId, whiteToken, { x: 1, y: 1 });
    store.placeStone(roomId, blackToken, { x: 2, y: 0 });
    store.placeStone(roomId, whiteToken, { x: 2, y: 1 });
    store.placeStone(roomId, blackToken, { x: 3, y: 0 });
    store.placeStone(roomId, whiteToken, { x: 3, y: 1 });
    const finished = store.placeStone(roomId, blackToken, { x: 4, y: 0 });

    expect(finished.status).toBe("finished");
    expect(finished.winner).toBe("black");
    expect(finished.winningLine).toHaveLength(5);
  });

  it("adds chat messages from a room player", () => {
    const store = createRoomStore({ now: () => 1234 });
    const created = store.createRoom("黑棋");
    const room = store.addChatMessage(created.room.id, created.playerToken, "  你好   好友  ");

    expect(room.chatMessages).toHaveLength(1);
    expect(room.chatMessages[0]).toMatchObject({
      nickname: "黑棋",
      color: "black",
      text: "你好 好友",
      createdAt: 1234
    });
  });

  it("rejects empty chat messages", () => {
    const store = createRoomStore();
    const created = store.createRoom("黑棋");

    expect(() => store.addChatMessage(created.room.id, created.playerToken, "   ")).toThrow(
      "CHAT_MESSAGE_REQUIRED"
    );
  });

  it("keeps only the latest 50 chat messages", () => {
    const store = createRoomStore();
    const created = store.createRoom("黑棋");
    let room = created.room;

    for (let index = 0; index < 55; index += 1) {
      room = store.addChatMessage(created.room.id, created.playerToken, `消息 ${index}`);
    }

    expect(room.chatMessages).toHaveLength(50);
    expect(room.chatMessages[0].text).toBe("消息 5");
    expect(room.chatMessages[49].text).toBe("消息 54");
  });

  it("reconnects a player by token", () => {
    const store = createRoomStore();
    const created = store.createRoom("黑棋");
    store.markOffline(created.room.id, created.playerToken);
    const reconnected = store.reconnect(created.room.id, created.playerToken);
    expect(reconnected.players.black?.online).toBe(true);
  });

  it("deletes inactive rooms after the configured timeout", () => {
    let currentTime = 1_000;
    const store = createRoomStore({
      now: () => currentTime,
      inactiveRoomMs: 30 * 60 * 1000
    });
    const created = store.createRoom("黑棋");
    store.markOffline(created.room.id, created.playerToken);

    currentTime += 31 * 60 * 1000;
    const deleted = store.deleteInactiveRooms();

    expect(deleted).toBe(1);
    expect(() => store.getRoom(created.room.id)).toThrow("ROOM_NOT_FOUND");
  });
});
