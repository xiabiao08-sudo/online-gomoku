import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { io } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

const processes: ChildProcess[] = [];

afterEach(async () => {
  for (const child of processes.splice(0)) {
    if (!child.killed) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
  }
});

describe("production server", () => {
  it("serves the built single-page app for a room link", async () => {
    const port = await findFreePort();
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "production" },
      stdio: "ignore"
    });
    processes.push(child);

    const response = await waitForResponse(`http://127.0.0.1:${port}/room/ABC123`);

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it("accepts Socket.IO connections from its own Render URL", async () => {
    const port = await findFreePort();
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        NODE_ENV: "production",
        RENDER_EXTERNAL_URL: origin
      },
      stdio: "ignore"
    });
    processes.push(child);
    await waitForResponse(`${origin}/health`);

    const client = io(origin, {
      transports: ["polling"],
      extraHeaders: { Origin: origin },
      timeout: 2_000
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    client.close();
  });
});

async function findFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate a test port");
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

async function waitForResponse(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}
