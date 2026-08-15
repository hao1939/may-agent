import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withTaskStateLock, type TaskStateConfig } from "./project-task-tree-store.js";

function configFor(statePath: string): TaskStateConfig {
  return {
    appDir: join(statePath, "app"),
    projectDir: join(statePath, "project"),
    statePath,
    journalPath: `${statePath}.journal`,
    worker: "test",
    maxConcurrent: 1,
  };
}

describe("task state lock recovery", () => {
  test("records ownership while held and removes the lock on release", () => {
    const root = mkdtempSync(join(tmpdir(), "task-state-lock-"));
    const statePath = join(root, "state.json");
    const lockPath = `${statePath}.lock`;
    try {
      withTaskStateLock(configFor(statePath), () => {
        expect(existsSync(join(lockPath, "owner.json"))).toBe(true);
        expect(JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"))).toMatchObject({
          pid: process.pid,
          processIdentity: expect.any(String),
        });
      });
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("immediately reclaims a lock owned by a dead process", () => {
    const root = mkdtempSync(join(tmpdir(), "task-state-lock-dead-"));
    const statePath = join(root, "state.json");
    const lockPath = `${statePath}.lock`;
    try {
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, "owner.json"), JSON.stringify({ pid: 2_147_483_647 }));
      expect(withTaskStateLock(configFor(statePath), () => "recovered")).toBe("recovered");
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reclaims a lock carrying a reused current PID", () => {
    const root = mkdtempSync(join(tmpdir(), "task-state-lock-reused-pid-"));
    const statePath = join(root, "state.json");
    const lockPath = `${statePath}.lock`;
    try {
      mkdirSync(lockPath);
      writeFileSync(
        join(lockPath, "owner.json"),
        JSON.stringify({ pid: process.pid, processIdentity: "previous-container-runtime" }),
      );
      expect(withTaskStateLock(configFor(statePath), () => "recovered")).toBe("recovered");
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reclaims a legacy same-PID lock acquired before the current Linux process", () => {
    if (!existsSync(`/proc/${process.pid}`)) return;
    const root = mkdtempSync(join(tmpdir(), "task-state-lock-legacy-reused-pid-"));
    const statePath = join(root, "state.json");
    const lockPath = `${statePath}.lock`;
    try {
      mkdirSync(lockPath);
      writeFileSync(
        join(lockPath, "owner.json"),
        JSON.stringify({ pid: process.pid, acquiredAt: "2000-01-01T00:00:00.000Z" }),
      );
      expect(withTaskStateLock(configFor(statePath), () => "recovered")).toBe("recovered");
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
