import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Web UI build", () => {
  it("stages into an explicit immutable-build output without deriving a shared parent path", () => {
    const root = mkdtempSync(join(tmpdir(), "may-agent-ui-stage-"));
    roots.push(root);
    const target = join(root, "release", "ui");

    const result = Bun.spawnSync({
      cmd: [process.execPath, "scripts/build-webui.ts"],
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, MAY_AGENT_UI_OUTPUT_DIR: target },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(`generated ${target}`);
    expect(readFileSync(join(target, "index.html"), "utf8")).toContain("<!DOCTYPE html>");
  });
});
