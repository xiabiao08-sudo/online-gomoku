import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("single-service production build", () => {
  it("does not embed a separately configured socket server", () => {
    const staleSocketUrl = "https://stale-socket.example.test";
    execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
      cwd: process.cwd(),
      env: { ...process.env, VITE_SOCKET_URL: staleSocketUrl },
      stdio: "pipe"
    });

    const assetDirectory = join(process.cwd(), "dist", "assets");
    const builtJavaScript = readdirSync(assetDirectory)
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(assetDirectory, file), "utf8"))
      .join("\n");

    expect(builtJavaScript).not.toContain(staleSocketUrl);
  });
});
