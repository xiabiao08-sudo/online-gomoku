# 在线联机五子棋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-demo-ready web Gomoku MVP where two friends can create/join a room, play a 15 x 15 free-rule game in real time, reconnect after refresh, and start another round.

**Architecture:** Use a single Node.js service that serves the Vite React frontend and hosts Socket.IO on the same HTTP server. Keep all room state in server memory for MVP, with shared TypeScript types and pure game logic used by both tests and runtime code.

**Tech Stack:** Node.js, TypeScript, React, Vite, Express, Socket.IO, Vitest, Playwright.

---

## Target File Structure

Create and modify files under:

```text
projects/【codex test】/在线联机五子棋/
```

Planned structure:

```text
package.json                         Project scripts and dependencies
tsconfig.json                        Shared TypeScript settings
vite.config.ts                       Vite + React + Vitest config
index.html                           Frontend entry HTML
README.md                            Run, test, deploy, and handoff entry
TASK_HANDOFF.md                      Current task state for future Codex sessions
server/
  index.ts                           Express + Socket.IO bootstrap
  roomStore.ts                       In-memory room lifecycle and rules
  socketHandlers.ts                  Socket.IO event wiring
src/
  main.tsx                           React bootstrap
  App.tsx                            Top-level page routing
  styles.css                         Global traditional-board visual system
  shared/
    game.ts                          Board, move, winner, and DTO types
  client/
    socketClient.ts                  Socket.IO client wrapper
    storage.ts                       Local player token persistence
  components/
    HomePage.tsx                     Nickname, create room, join room
    RoomPage.tsx                     Room orchestration and status UI
    Board.tsx                        15 x 15 board rendering and hit targets
    PlayerPanel.tsx                  Player color, nickname, online state
    StatusMessage.tsx                Single low-noise status/error area
tests/
  game.test.ts                       Pure winner and move tests
  roomStore.test.ts                  Room state transition tests
  socket.test.ts                     Socket.IO integration tests
e2e/
  gomoku.spec.ts                     Browser two-player smoke tests
```

## Task 1: Scaffold the TypeScript Web App

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/package.json`
- Create: `projects/【codex test】/在线联机五子棋/tsconfig.json`
- Create: `projects/【codex test】/在线联机五子棋/vite.config.ts`
- Create: `projects/【codex test】/在线联机五子棋/index.html`

- [ ] **Step 1: Create package scripts and dependencies**

Create `package.json`:

```json
{
  "name": "online-gomoku",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx server/index.ts",
    "dev:client": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "tsx server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run test && npm run build"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "express": "^4.19.2",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/react": "^16.1.0",
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["server", "src", "tests", "e2e", "vite.config.ts"]
}
```

- [ ] **Step 3: Create Vite config with Vitest**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
```

- [ ] **Step 4: Create frontend entry HTML**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>在线联机五子棋</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Install dependencies**

Run:

```powershell
npm install
```

Expected: `node_modules/` and `package-lock.json` are created, no install errors.

- [ ] **Step 6: Commit scaffold**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/package.json" `
  "projects/【codex test】/在线联机五子棋/package-lock.json" `
  "projects/【codex test】/在线联机五子棋/tsconfig.json" `
  "projects/【codex test】/在线联机五子棋/vite.config.ts" `
  "projects/【codex test】/在线联机五子棋/index.html"
git commit -m "chore: scaffold online gomoku app"
```

Expected: commit contains only scaffold files.

## Task 2: Implement Shared Game Rules With TDD

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/src/shared/game.ts`
- Create: `projects/【codex test】/在线联机五子棋/tests/game.test.ts`

- [ ] **Step 1: Write failing tests for board creation and winner detection**

Create `tests/game.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  createEmptyBoard,
  findWinningLine,
  placeStone
} from "../src/shared/game";

describe("shared game rules", () => {
  it("creates a 15 x 15 empty board", () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(BOARD_SIZE);
    expect(board[0]).toHaveLength(BOARD_SIZE);
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });

  it("places a stone immutably", () => {
    const board = createEmptyBoard();
    const next = placeStone(board, { x: 7, y: 7 }, "black");
    expect(board[7][7]).toBe(null);
    expect(next[7][7]).toBe("black");
  });

  it("detects horizontal five in a row", () => {
    let board = createEmptyBoard();
    for (let x = 3; x <= 7; x += 1) {
      board = placeStone(board, { x, y: 6 }, "black");
    }
    expect(findWinningLine(board, { x: 7, y: 6 }, "black")).toEqual([
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 7, y: 6 }
    ]);
  });

  it("detects vertical and diagonal wins", () => {
    let vertical = createEmptyBoard();
    for (let y = 2; y <= 6; y += 1) {
      vertical = placeStone(vertical, { x: 9, y }, "white");
    }
    expect(findWinningLine(vertical, { x: 9, y: 6 }, "white")).toHaveLength(5);

    let diagonal = createEmptyBoard();
    for (let step = 0; step < 5; step += 1) {
      diagonal = placeStone(diagonal, { x: 4 + step, y: 4 + step }, "black");
    }
    expect(findWinningLine(diagonal, { x: 8, y: 8 }, "black")).toHaveLength(5);
  });

  it("does not report four in a row as a win", () => {
    let board = createEmptyBoard();
    for (let x = 1; x <= 4; x += 1) {
      board = placeStone(board, { x, y: 1 }, "black");
    }
    expect(findWinningLine(board, { x: 4, y: 1 }, "black")).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/game.test.ts
```

Expected: FAIL because `src/shared/game.ts` does not exist.

- [ ] **Step 3: Implement shared game module**

Create `src/shared/game.ts`:

```ts
export const BOARD_SIZE = 15;

export type Stone = "black" | "white";
export type Cell = Stone | null;
export type Board = Cell[][];
export type GameStatus = "waiting" | "playing" | "finished";

export interface Point {
  x: number;
  y: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  color: Stone;
  online: boolean;
}

export interface PublicRoomState {
  id: string;
  players: {
    black: PublicPlayer | null;
    white: PublicPlayer | null;
  };
  board: Board;
  currentTurn: Stone;
  status: GameStatus;
  winner: Stone | null;
  winningLine: Point[];
  lastMove: Point | null;
  restartReady: Record<Stone, boolean>;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

export function isInsideBoard(point: Point): boolean {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.x < BOARD_SIZE &&
    point.y >= 0 &&
    point.y < BOARD_SIZE
  );
}

export function placeStone(board: Board, point: Point, stone: Stone): Board {
  if (!isInsideBoard(point)) {
    throw new Error("POINT_OUT_OF_RANGE");
  }
  if (board[point.y][point.x] !== null) {
    throw new Error("CELL_OCCUPIED");
  }
  return board.map((row, y) =>
    row.map((cell, x) => (x === point.x && y === point.y ? stone : cell))
  );
}

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 }
];

export function findWinningLine(
  board: Board,
  lastMove: Point,
  stone: Stone
): Point[] | null {
  for (const direction of DIRECTIONS) {
    const line = collectLine(board, lastMove, stone, direction);
    if (line.length >= 5) {
      return line.slice(0, 5);
    }
  }
  return null;
}

function collectLine(
  board: Board,
  origin: Point,
  stone: Stone,
  direction: Point
): Point[] {
  const backward = collectDirection(board, origin, stone, {
    x: -direction.x,
    y: -direction.y
  }).reverse();
  const forward = collectDirection(board, origin, stone, direction);
  return [...backward, origin, ...forward];
}

function collectDirection(
  board: Board,
  origin: Point,
  stone: Stone,
  direction: Point
): Point[] {
  const points: Point[] = [];
  let cursor = { x: origin.x + direction.x, y: origin.y + direction.y };
  while (isInsideBoard(cursor) && board[cursor.y][cursor.x] === stone) {
    points.push(cursor);
    cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y };
  }
  return points;
}

export function oppositeTurn(stone: Stone): Stone {
  return stone === "black" ? "white" : "black";
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm run test -- tests/game.test.ts
```

Expected: PASS for all shared game rule tests.

- [ ] **Step 5: Commit game rules**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/src/shared/game.ts" `
  "projects/【codex test】/在线联机五子棋/tests/game.test.ts"
git commit -m "feat: add gomoku game rules"
```

## Task 3: Implement In-Memory Room Store With TDD

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/server/roomStore.ts`
- Create: `projects/【codex test】/在线联机五子棋/tests/roomStore.test.ts`

- [ ] **Step 1: Write room store tests**

Create `tests/roomStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/roomStore.test.ts
```

Expected: FAIL because `server/roomStore.ts` does not exist.

- [ ] **Step 3: Implement room store**

Create `server/roomStore.ts` with focused methods:

```ts
import crypto from "node:crypto";
import {
  Board,
  Point,
  PublicPlayer,
  PublicRoomState,
  Stone,
  createEmptyBoard,
  findWinningLine,
  oppositeTurn,
  placeStone
} from "../src/shared/game";

interface InternalPlayer extends PublicPlayer {
  token: string;
  socketId: string | null;
  joinedAt: number;
  lastSeenAt: number;
}

interface InternalRoom {
  id: string;
  players: {
    black: InternalPlayer | null;
    white: InternalPlayer | null;
  };
  board: Board;
  currentTurn: Stone;
  status: "waiting" | "playing" | "finished";
  winner: Stone | null;
  winningLine: Point[];
  lastMove: Point | null;
  restartReady: Record<Stone, boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface JoinResult {
  room: PublicRoomState;
  playerToken: string;
  color: Stone;
}

interface RoomStoreOptions {
  now?: () => number;
  inactiveRoomMs?: number;
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const now = options.now ?? Date.now;
  const inactiveRoomMs = options.inactiveRoomMs ?? 30 * 60 * 1000;
  const rooms = new Map<string, InternalRoom>();

  function createRoom(nickname: string): JoinResult {
    const timestamp = now();
    const player = createPlayer(nickname, "black", timestamp);
    const room: InternalRoom = {
      id: createRoomId(),
      players: { black: player, white: null },
      board: createEmptyBoard(),
      currentTurn: "black",
      status: "waiting",
      winner: null,
      winningLine: [],
      lastMove: null,
      restartReady: { black: false, white: false },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    rooms.set(room.id, room);
    return { room: toPublicRoom(room), playerToken: player.token, color: "black" };
  }

  function joinRoom(roomId: string, nickname: string): JoinResult {
    const room = requireRoom(roomId);
    if (room.players.white) {
      throw new Error("ROOM_FULL");
    }
    const player = createPlayer(nickname, "white", now());
    room.players.white = player;
    room.status = "playing";
    room.updatedAt = now();
    return { room: toPublicRoom(room), playerToken: player.token, color: "white" };
  }

  function reconnect(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    player.online = true;
    player.lastSeenAt = now();
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function markOffline(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    player.online = false;
    player.socketId = null;
    player.lastSeenAt = now();
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function place(roomId: string, token: string, point: Point): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    if (room.status !== "playing") {
      throw new Error("GAME_NOT_PLAYING");
    }
    if (!room.players.black?.online || !room.players.white?.online) {
      throw new Error("PLAYER_OFFLINE");
    }
    if (player.color !== room.currentTurn) {
      throw new Error("NOT_YOUR_TURN");
    }

    room.board = placeStone(room.board, point, player.color);
    room.lastMove = point;
    const winningLine = findWinningLine(room.board, point, player.color);
    if (winningLine) {
      room.status = "finished";
      room.winner = player.color;
      room.winningLine = winningLine;
    } else {
      room.currentTurn = oppositeTurn(player.color);
    }
    room.restartReady = { black: false, white: false };
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function setRestartReady(roomId: string, token: string): PublicRoomState {
    const room = requireRoom(roomId);
    const player = findPlayerByToken(room, token);
    if (!player) {
      throw new Error("INVALID_TOKEN");
    }
    room.restartReady[player.color] = true;
    if (room.restartReady.black && room.restartReady.white) {
      room.board = createEmptyBoard();
      room.currentTurn = "black";
      room.status = room.players.white ? "playing" : "waiting";
      room.winner = null;
      room.winningLine = [];
      room.lastMove = null;
      room.restartReady = { black: false, white: false };
    }
    room.updatedAt = now();
    return toPublicRoom(room);
  }

  function deleteInactiveRooms(): number {
    let deleted = 0;
    const cutoff = now() - inactiveRoomMs;
    for (const [roomId, room] of rooms.entries()) {
      const nobodyOnline = !room.players.black?.online && !room.players.white?.online;
      if (nobodyOnline && room.updatedAt < cutoff) {
        rooms.delete(roomId);
        deleted += 1;
      }
    }
    return deleted;
  }

  return {
    createRoom,
    joinRoom,
    reconnect,
    markOffline,
    placeStone: place,
    setRestartReady,
    deleteInactiveRooms,
    getRoom: (roomId: string) => toPublicRoom(requireRoom(roomId))
  };

  function requireRoom(roomId: string): InternalRoom {
    const room = rooms.get(roomId);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    return room;
  }
}

function createPlayer(nickname: string, color: Stone, timestamp: number): InternalPlayer {
  return {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(16).toString("hex"),
    nickname: nickname.trim(),
    color,
    online: true,
    socketId: null,
    joinedAt: timestamp,
    lastSeenAt: timestamp
  };
}

function createRoomId(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function findPlayerByToken(room: InternalRoom, token: string): InternalPlayer | null {
  for (const player of [room.players.black, room.players.white]) {
    if (player?.token === token) {
      return player;
    }
  }
  return null;
}

function toPublicPlayer(player: InternalPlayer | null): PublicPlayer | null {
  if (!player) {
    return null;
  }
  return {
    id: player.id,
    nickname: player.nickname,
    color: player.color,
    online: player.online
  };
}

function toPublicRoom(room: InternalRoom): PublicRoomState {
  return {
    id: room.id,
    players: {
      black: toPublicPlayer(room.players.black),
      white: toPublicPlayer(room.players.white)
    },
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    winningLine: room.winningLine,
    lastMove: room.lastMove,
    restartReady: room.restartReady
  };
}
```

- [ ] **Step 4: Run room store tests**

Run:

```powershell
npm run test -- tests/roomStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all unit tests**

Run:

```powershell
npm run test
```

Expected: PASS for `game.test.ts` and `roomStore.test.ts`.

- [ ] **Step 6: Commit room store**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/server/roomStore.ts" `
  "projects/【codex test】/在线联机五子棋/tests/roomStore.test.ts"
git commit -m "feat: add gomoku room store"
```

## Task 4: Add Express and Socket.IO Server

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/server/index.ts`
- Create: `projects/【codex test】/在线联机五子棋/server/socketHandlers.ts`
- Create: `projects/【codex test】/在线联机五子棋/tests/socket.test.ts`

- [ ] **Step 1: Write Socket.IO integration test**

Create `tests/socket.test.ts`:

```ts
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { io as createClient, Socket as ClientSocket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Server } from "socket.io";
import { registerSocketHandlers } from "../server/socketHandlers";
import { createRoomStore } from "../server/roomStore";

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
    expect(created.room.players.black.nickname).toBe("黑棋");

    const joined = await white.emitWithAck("room:join", {
      roomId: created.room.id,
      nickname: "白棋"
    });
    expect(joined.room.status).toBe("playing");
    expect(joined.room.players.white.nickname).toBe("白棋");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/socket.test.ts
```

Expected: FAIL because `server/socketHandlers.ts` does not exist.

- [ ] **Step 3: Implement socket handlers**

Create `server/socketHandlers.ts`:

```ts
import { Server } from "socket.io";
import { Point } from "../src/shared/game";
import { createRoomStore } from "./roomStore";

type RoomStore = ReturnType<typeof createRoomStore>;

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

export function registerSocketHandlers(io: Server, store: RoomStore): void {
  io.on("connection", (socket) => {
    socket.on("room:create", async (payload: CreatePayload) => {
      const nickname = normalizeNickname(payload.nickname);
      const result = store.createRoom(nickname);
      await socket.join(result.room.id);
      io.to(result.room.id).emit("room:state", result.room);
      return result;
    });

    socket.on("room:join", async (payload: JoinPayload) => {
      if (payload.playerToken) {
        const room = store.reconnect(payload.roomId, payload.playerToken);
        await socket.join(room.id);
        io.to(room.id).emit("room:state", room);
        return { room, playerToken: payload.playerToken };
      }
      const nickname = normalizeNickname(payload.nickname ?? "");
      const result = store.joinRoom(payload.roomId, nickname);
      await socket.join(result.room.id);
      io.to(result.room.id).emit("room:state", result.room);
      return result;
    });

    socket.on("game:placeStone", async (payload: MovePayload) => {
      const room = store.placeStone(payload.roomId, payload.playerToken, payload.point);
      io.to(payload.roomId).emit("room:state", room);
      return { room };
    });

    socket.on(
      "game:restartReady",
      async (payload: { roomId: string; playerToken: string }) => {
        const room = store.setRestartReady(payload.roomId, payload.playerToken);
        io.to(payload.roomId).emit("room:state", room);
        return { room };
      }
    );
  });
}

function normalizeNickname(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) {
    throw new Error("NICKNAME_REQUIRED");
  }
  return trimmed.slice(0, 16);
}
```

- [ ] **Step 4: Implement server bootstrap**

Create `server/index.ts`:

```ts
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createRoomStore } from "./roomStore";
import { registerSocketHandlers } from "./socketHandlers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

const roomStore = createRoomStore();
registerSocketHandlers(io, roomStore);

setInterval(() => {
  roomStore.deleteInactiveRooms();
}, 5 * 60 * 1000).unref();

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

const port = Number(process.env.PORT ?? 8788);
httpServer.listen(port, () => {
  console.log(`online gomoku server listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 5: Run socket test**

Run:

```powershell
npm run test -- tests/socket.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit server**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/server/index.ts" `
  "projects/【codex test】/在线联机五子棋/server/socketHandlers.ts" `
  "projects/【codex test】/在线联机五子棋/tests/socket.test.ts"
git commit -m "feat: add realtime gomoku server"
```

## Task 5: Build React Client State and Pages

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/src/main.tsx`
- Create: `projects/【codex test】/在线联机五子棋/src/App.tsx`
- Create: `projects/【codex test】/在线联机五子棋/src/client/socketClient.ts`
- Create: `projects/【codex test】/在线联机五子棋/src/client/storage.ts`
- Create: `projects/【codex test】/在线联机五子棋/src/components/HomePage.tsx`
- Create: `projects/【codex test】/在线联机五子棋/src/components/RoomPage.tsx`

- [ ] **Step 1: Implement token storage**

Create `src/client/storage.ts`:

```ts
import { Stone } from "../shared/game";

const KEY = "online-gomoku-session";

export interface SavedSession {
  roomId: string;
  playerToken: string;
  color: Stone;
}

export function saveSession(session: SavedSession): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): SavedSession | null {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SavedSession;
  } catch {
    window.localStorage.removeItem(KEY);
    return null;
  }
}
```

- [ ] **Step 2: Implement Socket.IO client wrapper**

Create `src/client/socketClient.ts`:

```ts
import { io } from "socket.io-client";

export const socket = io({
  autoConnect: true,
  transports: ["websocket", "polling"]
});
```

- [ ] **Step 3: Implement React bootstrap**

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Implement top-level routing without adding router dependency**

Create `src/App.tsx`:

```tsx
import { useMemo, useState } from "react";
import { HomePage } from "./components/HomePage";
import { RoomPage } from "./components/RoomPage";

export function App() {
  const initialRoomId = useMemo(() => {
    const match = window.location.pathname.match(/^\/room\/([^/]+)$/);
    return match?.[1] ?? null;
  }, []);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);

  function navigateToRoom(nextRoomId: string) {
    window.history.pushState(null, "", `/room/${nextRoomId}`);
    setRoomId(nextRoomId);
  }

  function goHome() {
    window.history.pushState(null, "", "/");
    setRoomId(null);
  }

  return roomId ? (
    <RoomPage roomId={roomId} onExit={goHome} />
  ) : (
    <HomePage onEnterRoom={navigateToRoom} />
  );
}
```

- [ ] **Step 5: Implement HomePage**

Create `src/components/HomePage.tsx`:

```tsx
import { FormEvent, useState } from "react";
import { socket } from "../client/socketClient";
import { saveSession } from "../client/storage";

interface Props {
  onEnterRoom: (roomId: string) => void;
}

export function HomePage({ onEnterRoom }: Props) {
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("输入昵称，创建房间或加入好友房。");

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await socket.emitWithAck("room:create", { nickname });
      saveSession({
        roomId: result.room.id,
        playerToken: result.playerToken,
        color: result.color
      });
      onEnterRoom(result.room.id);
    } catch {
      setMessage("昵称不能为空，或服务暂时不可用。");
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await socket.emitWithAck("room:join", {
        roomId: roomId.trim().toUpperCase(),
        nickname
      });
      saveSession({
        roomId: result.room.id,
        playerToken: result.playerToken,
        color: result.color
      });
      onEnterRoom(result.room.id);
    } catch {
      setMessage("无法加入房间：房间不存在、已满或昵称为空。");
    }
  }

  return (
    <main className="home-shell">
      <section className="home-panel" aria-labelledby="home-title">
        <p className="eyebrow">好友房 · 自由五子棋</p>
        <h1 id="home-title">在线联机五子棋</h1>
        <p className="home-copy">创建房间，把链接发给好友，两人到齐即可开局。</p>
        <label>
          昵称
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={16} />
        </label>
        <div className="home-actions">
          <form onSubmit={createRoom}>
            <button type="submit">创建房间</button>
          </form>
          <form onSubmit={joinRoom} className="join-form">
            <input
              aria-label="房间号"
              placeholder="房间号"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
            />
            <button type="submit">加入房间</button>
          </form>
        </div>
        <p className="status-text">{message}</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Implement RoomPage shell**

Create `src/components/RoomPage.tsx`. This page must support two entry modes: a returning player with a saved token, and a new friend who opened a copied `/room/<roomId>` link and still needs to enter a nickname.

```tsx
import { FormEvent, useEffect, useState } from "react";
import { socket } from "../client/socketClient";
import { SavedSession, loadSession, saveSession } from "../client/storage";
import { PublicRoomState } from "../shared/game";
import { Board } from "./Board";
import { PlayerPanel } from "./PlayerPanel";
import { StatusMessage } from "./StatusMessage";

interface Props {
  roomId: string;
  onExit: () => void;
}

export function RoomPage({ roomId, onExit }: Props) {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [session, setSession] = useState<SavedSession | null>(() => loadSession());
  const myColor = session?.roomId === roomId ? session.color : null;

  useEffect(() => {
    socket.on("room:state", setRoom);
    if (session?.roomId === roomId) {
      socket.emit("room:join", { roomId, playerToken: session.playerToken });
    }
    return () => {
      socket.off("room:state", setRoom);
    };
  }, [roomId, session]);

  async function joinWithNickname(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await socket.emitWithAck("room:join", {
        roomId,
        nickname
      });
      const nextSession = {
        roomId: result.room.id,
        playerToken: result.playerToken,
        color: result.color
      };
      saveSession(nextSession);
      setSession(nextSession);
      setRoom(result.room);
      setError("");
    } catch {
      setError("无法加入房间：房间不存在、已满或昵称为空。");
    }
  }

  async function placeStone(x: number, y: number) {
    if (!session || session.roomId !== roomId) {
      setError("当前浏览器没有这个房间的玩家身份。");
      return;
    }
    try {
      await socket.emitWithAck("game:placeStone", {
        roomId,
        playerToken: session.playerToken,
        point: { x, y }
      });
      setError("");
    } catch {
      setError("现在不能在这里落子。");
    }
  }

  async function restartReady() {
    if (!session) {
      return;
    }
    await socket.emitWithAck("game:restartReady", {
      roomId,
      playerToken: session.playerToken
    });
  }

  const roomUrl = `${window.location.origin}/room/${roomId}`;

  if (!session || session.roomId !== roomId) {
    return (
      <main className="room-shell">
        <section className="home-panel" aria-labelledby="join-title">
          <p className="eyebrow">加入好友房</p>
          <h1 id="join-title">房间 {roomId}</h1>
          <form onSubmit={joinWithNickname}>
            <label>
              昵称
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={16} />
            </label>
            <button type="submit">加入房间</button>
          </form>
          <p className={error ? "status-text warning" : "status-text"}>
            {error || "输入昵称后加入这局五子棋。"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="room-shell">
      <section className="room-header">
        <button type="button" onClick={onExit}>返回首页</button>
        <div>
          <p className="eyebrow">房间号</p>
          <h1>{roomId}</h1>
        </div>
        <button type="button" onClick={() => navigator.clipboard.writeText(roomUrl)}>
          复制链接
        </button>
      </section>

      {room ? (
        <section className="game-layout">
          <PlayerPanel player={room.players.black} label="黑棋" />
          <Board room={room} myColor={myColor} onPlaceStone={placeStone} />
          <PlayerPanel player={room.players.white} label="白棋" />
          <StatusMessage room={room} myColor={myColor} error={error} />
          {room.status === "finished" ? (
            <button type="button" className="primary-action" onClick={restartReady}>
              准备下一局
            </button>
          ) : null}
        </section>
      ) : (
        <p className="status-text">正在连接房间...</p>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Run build to expose missing components**

Run:

```powershell
npm run build
```

Expected: FAIL because `Board`, `PlayerPanel`, `StatusMessage`, and `styles.css` do not exist.

- [ ] **Step 8: Commit client shell**

Do not commit yet if build fails because missing components are expected. Continue to Task 6 before committing.

## Task 6: Implement Board UI, Panels, and Traditional Styling

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/src/components/Board.tsx`
- Create: `projects/【codex test】/在线联机五子棋/src/components/PlayerPanel.tsx`
- Create: `projects/【codex test】/在线联机五子棋/src/components/StatusMessage.tsx`
- Create: `projects/【codex test】/在线联机五子棋/src/styles.css`

- [ ] **Step 1: Implement Board**

Create `src/components/Board.tsx`:

```tsx
import { BOARD_SIZE, PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  onPlaceStone: (x: number, y: number) => void;
}

export function Board({ room, myColor, onPlaceStone }: Props) {
  const canPlay = room.status === "playing" && myColor === room.currentTurn;
  const winningKeys = new Set(room.winningLine.map((point) => `${point.x}:${point.y}`));
  const lastMoveKey = room.lastMove ? `${room.lastMove.x}:${room.lastMove.y}` : "";

  return (
    <div className="board-wrap" aria-label="15乘15五子棋棋盘">
      <div className="board-grid">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const stone = room.board[y][x];
          const key = `${x}:${y}`;
          return (
            <button
              key={key}
              type="button"
              className={`point ${stone ? "occupied" : ""} ${winningKeys.has(key) ? "winning" : ""}`}
              aria-label={`${x + 1}列${y + 1}行${stone ? `${stone === "black" ? "黑" : "白"}棋` : "空位"}`}
              disabled={!canPlay || Boolean(stone)}
              onClick={() => onPlaceStone(x, y)}
            >
              {stone ? <span className={`stone ${stone}`} /> : <span className="preview-stone" />}
              {lastMoveKey === key ? <span className="last-move" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement PlayerPanel**

Create `src/components/PlayerPanel.tsx`:

```tsx
import { PublicPlayer } from "../shared/game";

interface Props {
  player: PublicPlayer | null;
  label: string;
}

export function PlayerPanel({ player, label }: Props) {
  return (
    <aside className="player-panel">
      <span className={`mini-stone ${label === "黑棋" ? "black" : "white"}`} aria-hidden="true" />
      <div>
        <p className="panel-label">{label}</p>
        <strong>{player?.nickname ?? "等待加入"}</strong>
        <p className="player-state">{player ? (player.online ? "在线" : "离线") : "空位"}</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Implement StatusMessage**

Create `src/components/StatusMessage.tsx`:

```tsx
import { PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  error: string;
}

export function StatusMessage({ room, myColor, error }: Props) {
  if (error) {
    return <p className="status-text warning">{error}</p>;
  }
  if (room.status === "waiting") {
    return <p className="status-text">等待好友加入。</p>;
  }
  if (room.status === "finished") {
    return <p className="status-text">{room.winner === "black" ? "黑棋" : "白棋"}获胜，双方准备后开始下一局。</p>;
  }
  const blackOnline = room.players.black?.online;
  const whiteOnline = room.players.white?.online;
  if (!blackOnline || !whiteOnline) {
    return <p className="status-text warning">对方离线，等待重连。</p>;
  }
  if (myColor === room.currentTurn) {
    return <p className="status-text strong">轮到你落子：{myColor === "black" ? "黑棋" : "白棋"}。</p>;
  }
  return <p className="status-text">等待对方落子。</p>;
}
```

- [ ] **Step 4: Implement traditional responsive styling**

Create `src/styles.css`:

```css
:root {
  color: #231c15;
  background: #e7d5b6;
  font-family: "Noto Serif SC", "LXGW WenKai", "Songti SC", serif;
  --paper: #ead8bb;
  --paper-deep: #d4b98d;
  --ink: #241b13;
  --line: rgba(58, 42, 26, 0.48);
  --focus: #7a3e18;
  --warning: #8a2d18;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.22), transparent 26rem),
    linear-gradient(135deg, #f3e4c8, #d7ba8d);
}

button,
input {
  min-height: 48px;
  border: 1px solid rgba(36, 27, 19, 0.35);
  border-radius: 8px;
  font: inherit;
}

button {
  cursor: pointer;
  background: #2a2119;
  color: #fff8ec;
  padding: 0 18px;
}

button:disabled {
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.home-shell,
.room-shell {
  width: min(1120px, calc(100vw - 32px));
  min-height: 100vh;
  margin: 0 auto;
  padding: 24px 0;
}

.home-panel {
  max-width: 560px;
  margin: 12vh auto 0;
  padding: 32px;
  border: 1px solid rgba(36, 27, 19, 0.22);
  border-radius: 10px;
  background: rgba(255, 248, 236, 0.78);
  box-shadow: 0 22px 60px rgba(56, 39, 19, 0.18);
}

.eyebrow,
.panel-label,
.player-state,
.status-text {
  font-size: 16px;
}

h1 {
  margin: 0;
  font-size: clamp(32px, 7vw, 56px);
  line-height: 1.05;
}

label {
  display: grid;
  gap: 8px;
  margin: 24px 0 16px;
}

input {
  width: 100%;
  padding: 0 14px;
  background: rgba(255, 252, 244, 0.9);
  color: var(--ink);
}

.home-actions,
.join-form,
.room-header,
.game-layout {
  display: grid;
  gap: 12px;
}

.room-header {
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin-bottom: 16px;
}

.game-layout {
  grid-template-columns: 180px minmax(0, 1fr) 180px;
  align-items: start;
}

.board-wrap {
  width: min(78vh, 100%);
  aspect-ratio: 1;
  margin: 0 auto;
  padding: clamp(12px, 3vw, 22px);
  border: 2px solid rgba(36, 27, 19, 0.5);
  background: linear-gradient(135deg, #ecd9b8, #d4b384);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45), 0 18px 42px rgba(58, 42, 26, 0.2);
}

.board-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  grid-template-rows: repeat(15, 1fr);
  width: 100%;
  height: 100%;
  background:
    repeating-linear-gradient(to right, transparent 0 calc(100% / 14 - 1px), var(--line) calc(100% / 14 - 1px) calc(100% / 14)),
    repeating-linear-gradient(to bottom, transparent 0 calc(100% / 14 - 1px), var(--line) calc(100% / 14 - 1px) calc(100% / 14));
}

.point {
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
}

.stone,
.preview-stone {
  position: absolute;
  inset: 17%;
  border-radius: 999px;
}

.stone.black,
.mini-stone.black {
  background: radial-gradient(circle at 35% 28%, #4a4035, #050403 70%);
}

.stone.white,
.mini-stone.white {
  background: radial-gradient(circle at 35% 28%, #fff, #ded8cd 72%);
  border: 1px solid rgba(36, 27, 19, 0.3);
}

.preview-stone {
  opacity: 0;
  background: rgba(36, 27, 19, 0.16);
}

.point:not(:disabled):hover .preview-stone,
.point:focus-visible .preview-stone {
  opacity: 1;
}

.last-move,
.winning::after {
  position: absolute;
  content: "";
  border-radius: 999px;
  pointer-events: none;
}

.last-move {
  inset: 42%;
  background: #b54a24;
}

.winning::after {
  inset: 9%;
  border: 3px solid #b54a24;
}

.player-panel {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 14px;
  border-radius: 8px;
  background: rgba(255, 248, 236, 0.74);
}

.mini-stone {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  flex: none;
}

.status-text {
  grid-column: 1 / -1;
  min-height: 48px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 248, 236, 0.74);
}

.status-text.warning {
  color: var(--warning);
}

.status-text.strong {
  font-size: 20px;
  font-weight: 700;
}

.primary-action {
  grid-column: 1 / -1;
  justify-self: center;
}

@media (max-width: 820px) {
  .room-header,
  .game-layout {
    grid-template-columns: 1fr;
  }

  .room-header {
    text-align: center;
  }

  .board-wrap {
    width: min(100%, 92vh);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```

- [ ] **Step 5: Run build**

Run:

```powershell
npm run build
```

Expected: PASS and `dist/` is created.

- [ ] **Step 6: Commit client UI**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/src" `
  "projects/【codex test】/在线联机五子棋/tests" `
  "projects/【codex test】/在线联机五子棋/package.json" `
  "projects/【codex test】/在线联机五子棋/package-lock.json"
git commit -m "feat: add gomoku client interface"
```

## Task 7: Add E2E Smoke Test and Manual Verification

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/playwright.config.ts`
- Create: `projects/【codex test】/在线联机五子棋/e2e/gomoku.spec.ts`

- [ ] **Step 1: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:8788/health",
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } }
  ]
});
```

- [ ] **Step 2: Create E2E test**

Create `e2e/gomoku.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("two players can create and join a room", async ({ browser }) => {
  const blackPage = await browser.newPage();
  const whitePage = await browser.newPage();

  await blackPage.goto("/");
  await blackPage.getByLabel("昵称").fill("黑棋玩家");
  await blackPage.getByRole("button", { name: "创建房间" }).click();
  await expect(blackPage.getByText("房间号")).toBeVisible();

  const roomUrl = blackPage.url();
  await whitePage.goto(roomUrl);
  await whitePage.getByLabel("昵称").fill("白棋玩家");
  await whitePage.getByRole("button", { name: "加入房间" }).click();

  await expect(blackPage.getByText("黑棋玩家")).toBeVisible();
  await expect(blackPage.getByText("白棋玩家")).toBeVisible();
  await expect(whitePage.getByText("黑棋玩家")).toBeVisible();
  await expect(whitePage.getByText("白棋玩家")).toBeVisible();
});
```

- [ ] **Step 3: Run all checks**

Run:

```powershell
npm run check
npm run test:e2e
```

Expected: unit/integration tests pass, build passes, Playwright tests pass on desktop and mobile profile.

- [ ] **Step 4: Run manual two-window smoke test**

Run:

```powershell
npm run preview
```

Open:

```text
http://127.0.0.1:8788/
```

Manual expected results:

- Browser A creates room as black.
- Browser B opens copied `/room/<roomId>` URL and joins as white.
- Black and white alternate turns.
- Horizontal five in a row ends the game.
- Refreshing Browser A restores the black player.
- At 360px viewport, board remains visible and main controls are tappable.

- [ ] **Step 5: Commit E2E tests**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/playwright.config.ts" `
  "projects/【codex test】/在线联机五子棋/e2e/gomoku.spec.ts"
git commit -m "test: add gomoku browser smoke test"
```

## Task 8: Add Project Handoff Files

**Files:**
- Create: `projects/【codex test】/在线联机五子棋/README.md`
- Create: `projects/【codex test】/在线联机五子棋/TASK_HANDOFF.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```markdown
# 在线联机五子棋

网页好友房五子棋 MVP。用户不登录，输入昵称后创建或加入房间，双方通过 Socket.IO 实时对弈。

## 入口

- 设计文档：`docs/superpowers/specs/2026-07-05-online-gomoku-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-05-online-gomoku-implementation.md`
- 任务交接：`TASK_HANDOFF.md`

## 常用命令

```powershell
npm install
npm run test
npm run build
npm run preview
npm run test:e2e
```

## 本地运行

```powershell
npm run build
npm run preview
```

打开：

```text
http://127.0.0.1:8788/
```

## MVP 范围

- 15 x 15 自由五子棋。
- 好友房创建和加入。
- 黑棋先手，白棋后手。
- 实时落子和服务端判胜。
- 刷新后用本地 token 恢复身份。
- 双方准备后再来一局。

## 非目标

第一版不做账号、排行榜、观战、聊天、悔棋、计时、AI、随机匹配或数据库保存。
```

- [ ] **Step 2: Create TASK_HANDOFF**

Create `TASK_HANDOFF.md`:

```markdown
# 在线联机五子棋任务交接

更新时间：2026-07-05

## 任务目标

实现公网可访问的网页好友房五子棋 MVP：创建房间、复制链接、两人进入、实时对弈、判胜、断线重连、再来一局。

## 当前状态

- 设计文档已完成。
- 实施计划已完成。
- 实现阶段按 `docs/superpowers/plans/2026-07-05-online-gomoku-implementation.md` 执行。

## 核心路径

- 项目根：`projects/【codex test】/在线联机五子棋/`
- 设计文档：`docs/superpowers/specs/2026-07-05-online-gomoku-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-05-online-gomoku-implementation.md`

## 下一步

1. 选择执行方式：Subagent-Driven 或 Inline Execution。
2. 从实施计划 Task 1 开始。
3. 每个任务完成后运行对应测试并提交。

## 验收标准

- 两个浏览器窗口能进入同一房间并实时对弈。
- 横、竖、斜向五连判胜正确。
- 刷新后可恢复原座位。
- 手机 360px 宽度下棋盘可点，主按钮触控区域不小于 48 x 48 CSS px。
- `npm run check` 和 `npm run test:e2e` 通过。

## 风险点

- `projects/` 目录被 git ignore，提交本项目文件时需要 `git add -f`。
- MVP 房间状态只在内存中，服务重启会丢局。
- WebSocket 部署平台必须支持长连接。
- 不要默认扫描 `projects/software download/`、`temp/`、`.venv/` 或第三方源码。
```

- [ ] **Step 3: Commit handoff files**

```powershell
git add -f "projects/【codex test】/在线联机五子棋/README.md" `
  "projects/【codex test】/在线联机五子棋/TASK_HANDOFF.md"
git commit -m "docs: add gomoku project handoff"
```

## Final Verification

- [ ] **Step 1: Run full local checks**

```powershell
npm run check
npm run test:e2e
```

Expected: all tests and build pass.

- [ ] **Step 2: Verify files exist**

```powershell
Get-ChildItem -LiteralPath "projects\【codex test】\在线联机五子棋" -Force |
  Select-Object Name,Mode,Length,LastWriteTime
```

Expected: `README.md`, `TASK_HANDOFF.md`, `package.json`, `server/`, `src/`, `tests/`, `e2e/`, and `docs/` are present.

- [ ] **Step 3: Update workspace index**

```powershell
powershell -ExecutionPolicy Bypass -File .\temp\update-codex-project-index.ps1
powershell -ExecutionPolicy Bypass -File .\temp\check-handoff.ps1
```

Expected: the new `在线联机五子棋` task appears in `CODEX_PROJECTS_INDEX.md`, and handoff checks pass.

- [ ] **Step 4: Final commit**

```powershell
git add -f "CODEX_PROJECTS_INDEX.md" "projects/【codex test】/在线联机五子棋"
git commit -m "feat: complete online gomoku MVP"
```

Expected: final commit includes implementation files and updated index only.
