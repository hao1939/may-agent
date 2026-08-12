import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "../..");
const setupScript = resolve(repoRoot, "container/setup-claude-config.sh");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Claude startup configuration", () => {
  test("defaults plain Claude sessions to bypassPermissions", () => {
    const home = mkdtempSync(join(tmpdir(), "may-claude-config-"));
    tempDirs.push(home);
    const result = spawnSync("bash", [setupScript], { env: { ...process.env, HOME: home }, encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"))).toEqual({
      permissions: { defaultMode: "bypassPermissions" },
      skipDangerousModePermissionPrompt: true,
    });
  });

  test("preserves existing Claude settings while enforcing the container permission mode", () => {
    const home = mkdtempSync(join(tmpdir(), "may-claude-config-"));
    const claudeHome = join(home, ".claude");
    tempDirs.push(home);
    mkdirSync(claudeHome, { recursive: true });
    writeFileSync(join(claudeHome, "settings.json"), JSON.stringify({
      theme: "dark",
      permissions: { defaultMode: "plan", allow: ["Read"] },
    }));

    const result = spawnSync("bash", [setupScript], { env: { ...process.env, HOME: home }, encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(claudeHome, "settings.json"), "utf8"))).toEqual({
      theme: "dark",
      permissions: { defaultMode: "bypassPermissions", allow: ["Read"] },
      skipDangerousModePermissionPrompt: true,
    });
  });
});
