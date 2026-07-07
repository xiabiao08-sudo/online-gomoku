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
    expect(result.room.moveCount).toBe(0);
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
    expect(finished.moveCount).toBe(9);
  });

  it("undoes the last move only after opponent approval", () => {
    const store = createRoomStore({ now: () => 1234 });
    const black = store.createRoom("黑棋");
    const white = store.joinRoom(black.room.id, "白棋");
    const roomId = black.room.id;

    store.placeStone(roomId, black.playerToken, { x: 3, y: 3 });
    const requested = store.requestUndo(roomId, black.playerToken);
    expect(requested.undoRequest).toMatchObject({
      requestedBy: "black",
      move: { point: { x: 3, y: 3 }, color: "black" },
      createdAt: 1234
    });
    expect(() => store.approveUndo(roomId, black.playerToken)).toThrow(
      "OPPONENT_APPROVAL_REQUIRED"
    );

    const undone = store.approveUndo(roomId, white.playerToken);
    expect(undone.board[3][3]).toBe(null);
    expect(undone.currentTurn).toBe("black");
    expect(undone.lastMove).toBe(null);
    expect(undone.lastMoveColor).toBe(null);
    expect(undone.moveCount).toBe(0);
    expect(undone.undoRequest).toBe(null);
  });

  it("rejects undo requests from a player who did not make the last move", () => {
    const store = createRoomStore();
    const black = store.createRoom("黑棋");
    const white = store.joinRoom(black.room.id, "白棋");
    store.placeStone(black.room.id, black.playerToken, { x: 0, y: 0 });

    expect(() => store.requestUndo(black.room.id, white.playerToken)).toThrow(
      "ONLY_LAST_MOVER_CAN_REQUEST_UNDO"
    );
  });

  it("restarts the game after both players agree", () => {
    const store = createRoomStore();
    const black = store.createRoom("黑棋");
    const white = store.joinRoom(black.room.id, "白棋");
    const roomId = black.room.id;

    store.placeStone(roomId, black.playerToken, { x: 0, y: 0 });
    const waiting = store.setRestartReady(roomId, black.playerToken);
    expect(waiting.restartReady.black).toBe(true);
    expect(waiting.board[0][0]).toBe("black");

    const restarted = store.setRestartReady(roomId, white.playerToken);
    expect(restarted.board.flat().every((cell) => cell === null)).toBe(true);
    expect(restarted.currentTurn).toBe("black");
    expect(restarted.status).toBe("playing");
    expect(restarted.moveCount).toBe(0);
    expect(restarted.restartReady).toEqual({ black: false, white: false });
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
