import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ENTRYPOINT = resolve(import.meta.dir, "may.ts");

describe("may CLI help", () => {
  it("exits successfully without starting recovery or mutating state", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "may-help-state-"));
    const markerPath = join(stateDir, "existing-state.txt");
    writeFileSync(markerPath, "unchanged\n");

    try {
      const result = spawnSync(process.execPath, [ENTRYPOINT, "--help"], {
        cwd: resolve(import.meta.dir, "../.."),
        env: { ...process.env, STATE_DIR: stateDir },
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage: may-agent [options]");
      expect(result.stderr).not.toContain("handler-recovery");
      expect(result.stderr).not.toContain("workflow-recovery");
      expect(readdirSync(stateDir)).toEqual(["existing-state.txt"]);
      expect(readFileSync(markerPath, "utf8")).toBe("unchanged\n");
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("keeps a running instance identity unchanged for --status", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "may-status-state-"));
    const instanceDir = join(stateDir, "instances", "background");
    mkdirSync(instanceDir, { recursive: true });
    const identityPath = join(instanceDir, "identity.json");
    const runningIdentity = JSON.stringify({ pid: 42, status: "running", instance: "background" });
    writeFileSync(identityPath, runningIdentity);

    try {
      const result = spawnSync(process.execPath, [ENTRYPOINT, "--status"], {
        cwd: resolve(import.meta.dir, "../.."),
        env: { ...process.env, STATE_DIR: stateDir, INSTANCE: "background" },
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(readFileSync(identityPath, "utf8")).toBe(runningIdentity);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
