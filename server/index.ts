import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { createRoomStore } from "./roomStore";
import { registerSocketHandlers } from "./socketHandlers";

const port = parsePort(process.env.PORT);
const host = process.env.HOST ?? "0.0.0.0";
const allowedOrigins = parseAllowedOrigins(process.env.FRONTEND_ORIGINS);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  transports: ["websocket", "polling"],
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  },
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("ORIGIN_NOT_ALLOWED"));
    },
    methods: ["GET", "POST"]
  }
});
const roomStore = createRoomStore();

app.disable("x-powered-by");
registerSocketHandlers(io, roomStore);

const clientBuildDirectory = resolve(process.cwd(), "dist");
if (existsSync(clientBuildDirectory)) {
  app.use(express.static(clientBuildDirectory));
}

const cleanupTimer = setInterval(() => {
  roomStore.deleteInactiveRooms();
}, 5 * 60 * 1000);
cleanupTimer.unref();

app.get(["/health", "/api/health"], (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ ok: true, service: "qizheyiy-gomoku-api" });
});

app.get("*", (_request, response) => {
  response.sendFile(resolve(clientBuildDirectory, "index.html"));
});

httpServer.requestTimeout = 30_000;
httpServer.headersTimeout = 35_000;

httpServer.on("error", (error) => {
  console.error("server error", error);
  process.exitCode = 1;
});

httpServer.listen(port, host, () => {
  console.log(`棋者弈也 API listening on http://${host}:${port}`);
  console.log(`allowed frontend origins: ${[...allowedOrigins].join(", ")}`);
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received, closing connections`);
  clearInterval(cleanupTimer);
  io.emit("server:shutdown", { reason: "deployment" });
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 8_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function parsePort(rawPort: string | undefined): number {
  const parsed = Number(rawPort ?? 8788);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return parsed;
}

function parseAllowedOrigins(rawOrigins: string | undefined): Set<string> {
  const defaults = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];
  const configured = (rawOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([...defaults, ...configured]);
}
