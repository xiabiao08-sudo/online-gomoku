import { describe, expect, it } from "vitest";
import { createRoomStore } from "../server/roomStore";

function setupGame(options: Parameters<typeof createRoomStore>[0] = {}) {
  const store = createRoomStore({ random: () => 1, startingDelayMs: 0, ...options });
  const black = store.createRoom("黑棋");
  const white = store.joinRoom(black.room.id, "白棋");
  store.activateRound(black.room.id);
  return { store, black, white, roomId: black.room.id };
}

function finishBlackWin(store: ReturnType<typeof createRoomStore>, roomId: string, blackToken: string, whiteToken: string) {
  for (let x = 0; x < 4; x += 1) {
    store.placeStone(roomId, blackToken, { x, y: 0 });
    store.placeStone(roomId, whiteToken, { x, y: 1 });
  }
  return store.placeStone(roomId, blackToken, { x: 4, y: 0 });
}

describe("room store", () => {
  it("creates a waiting room", () => {
    const store = createRoomStore();
    const result = store.createRoom("主人");
    expect(result.room.players.black?.nickname).toBe("主人");
    expect(result.room.players.white).toBe(null);
    expect(result.room.status).toBe("waiting");
    expect(result.playerToken).toHaveLength(32);
  });

  it("randomizes first-round colors on the server", () => {
    const store = createRoomStore({ random: () => 0, startingDelayMs: 0 });
    const creator = store.createRoom("创建者");
    const joiner = store.joinRoom(creator.room.id, "加入者");
    const started = store.activateRound(creator.room.id);
    expect(started.players.black?.nickname).toBe("加入者");
    expect(started.players.white?.nickname).toBe("创建者");
    expect(joiner.role).toBe("black");
    expect(started.status).toBe("playing");
  });

  it("allows at most five spectators", () => {
    const { store, roomId } = setupGame();
    for (let index = 0; index < 5; index += 1) {
      expect(store.joinRoom(roomId, `观众${index}`).role).toBe("spectator");
    }
    expect(() => store.joinRoom(roomId, "第六位观众")).toThrow("SPECTATOR_LIMIT_REACHED");
  });

  it("finishes immediately on five or more in a row", () => {
    const { store, black, white, roomId } = setupGame();
    const finished = finishBlackWin(store, roomId, black.playerToken, white.playerToken);
    expect(finished.status).toBe("finished");
    expect(finished.winner).toBe("black");
    expect(finished.winningLine).toHaveLength(5);
  });

  it("allows either player to request removal of the latest stone", () => {
    const { store, black, white, roomId } = setupGame({ now: () => 1234 });
    store.placeStone(roomId, black.playerToken, { x: 3, y: 3 });
    const requested = store.requestUndo(roomId, white.playerToken);
    expect(requested.undoRequest?.move.point).toEqual({ x: 3, y: 3 });
    const undone = store.approveUndo(roomId, black.playerToken);
    expect(undone.board[3][3]).toBe(null);
    expect(undone.currentTurn).toBe("black");
  });

  it("does not allow undo after the game finishes", () => {
    const { store, black, white, roomId } = setupGame();
    finishBlackWin(store, roomId, black.playerToken, white.playerToken);
    expect(() => store.requestUndo(roomId, black.playerToken)).toThrow("UNDO_NOT_AVAILABLE");
  });

  it("swaps colors after both players approve a rematch", () => {
    const { store, black, white, roomId } = setupGame();
    finishBlackWin(store, roomId, black.playerToken, white.playerToken);
    store.setRestartReady(roomId, black.playerToken);
    const starting = store.setRestartReady(roomId, white.playerToken);
    expect(starting.status).toBe("starting");
    const restarted = store.activateRound(roomId);
    expect(restarted.gameNumber).toBe(2);
    expect(restarted.players.black?.nickname).toBe("白棋");
    expect(restarted.players.white?.nickname).toBe("黑棋");
    expect(restarted.board.flat().every((cell) => cell === null)).toBe(true);
  });

  it("returns chat messages without storing history in room snapshots", () => {
    let time = 1000;
    const { store, black, roomId } = setupGame({ now: () => time, chatCooldownMs: 2000 });
    const message = store.addChatMessage(roomId, black.playerToken, "  你好   好友  ");
    expect(message).toMatchObject({ nickname: "黑棋", color: "black", text: "你好 好友" });
    expect("chatMessages" in store.getRoom(roomId)).toBe(false);
    expect(() => store.addChatMessage(roomId, black.playerToken, "太快")).toThrow("CHAT_RATE_LIMITED");
    time += 2000;
    expect(store.addChatMessage(roomId, black.playerToken, "可以了").text).toBe("可以了");
  });

  it("keeps player seats during disconnect and restores by token", () => {
    const { store, black, roomId } = setupGame();
    const paused = store.markOffline(roomId, black.playerToken);
    expect(paused.status).toBe("paused");
    const reconnected = store.reconnect(roomId, black.playerToken);
    expect(reconnected.room.status).toBe("playing");
    expect(reconnected.role).toBe("black");
  });

  it("does not promote spectators and closes after both players explicitly leave", () => {
    const { store, black, white, roomId } = setupGame();
    const spectator = store.joinRoom(roomId, "观众");
    const firstLeave = store.leaveRoom(roomId, black.playerToken);
    expect(firstLeave.closed).toBe(false);
    expect(store.reconnect(roomId, spectator.playerToken).role).toBe("spectator");
    const secondLeave = store.leaveRoom(roomId, white.playerToken);
    expect(secondLeave.closed).toBe(true);
    expect(() => store.getRoom(roomId)).toThrow("ROOM_NOT_FOUND");
  });

  it("deletes fully inactive rooms after the fallback timeout", () => {
    let currentTime = 1_000;
    const store = createRoomStore({ now: () => currentTime, inactiveRoomMs: 30 * 60 * 1000 });
    const created = store.createRoom("黑棋");
    store.markOffline(created.room.id, created.playerToken);
    currentTime += 31 * 60 * 1000;
    expect(store.deleteInactiveRooms()).toBe(1);
  });
});
