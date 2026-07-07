import express from "express";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
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

function getLanOrigins(port: number) {
  return Object.values(networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((details) => details.family === "IPv4" && !details.internal)
    .map((details) => `http://${details.address}:${port}`);
}

app.get("/api/share-info", (request, response) => {
  const protocol = request.headers["x-forwarded-proto"] ?? request.protocol;
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  const currentOrigin = host ? `${protocol}://${host}` : null;
  response.json({
    currentOrigin,
    lanOrigins: getLanOrigins(port)
  });
});

const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

const port = Number(process.env.PORT ?? 8788);
const host = process.env.HOST ?? "0.0.0.0";
httpServer.listen(port, host, () => {
  const lanOrigins = getLanOrigins(port);
  console.log(`online gomoku server listening on http://127.0.0.1:${port}`);
  for (const origin of lanOrigins) {
    console.log(`LAN share URL: ${origin}`);
  }
});
