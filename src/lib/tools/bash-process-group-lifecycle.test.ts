import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addSessionBashProcessGroup, readSessionBashProcessGroups } from "../persistence.js";
import {
  BASH_PROCESS_GROUP_TERM_GRACE_MS,
  createBashTool,
  createLocalBashOperations,
  drainPersistedSessionBashProcessGroups,
} from "./bash.js";

const fixtures: string[] = [];

function fixture(): { root: string; persistDir: string } {
  const root = mkdtempSync(join(tmpdir(), "bash-pgid-lifecycle-"));
  fixtures.push(root);
  return { root, persistDir: join(root, "state") };
}

function mutationCommand(path: string, releasePath: string, parentDelaySeconds = 0): string {
  const target = JSON.stringify(path);
  const release = JSON.stringify(releasePath);
  return `(trap '' TERM; while [ ! -e ${release} ]; do sleep 0.05; done; printf mutated > ${target}) & sleep ${parentDelaySeconds}`;
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("exact-session bash process-group lifecycle", () => {
  it("drains descendants and removes the exact sidecar before normal settlement", async () => {
    const f = fixture();
    const mutation = join(f.root, "normal-overlap");
    const release = join(f.root, "normal-release");
    const tool = createBashTool(f.root, {
      defaultTimeout: 5,
      processGroupOwner: { persistDir: f.persistDir, sessionId: "normal-session" },
    });

    const startedAt = Date.now();
    await tool.execute("normal", { command: mutationCommand(mutation, release) });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(BASH_PROCESS_GROUP_TERM_GRACE_MS - 30);
    expect(readSessionBashProcessGroups(f.persistDir, "normal-session")).toEqual([]);
    expect(readSessionBashProcessGroups(f.persistDir, "legacy-session")).toEqual([]);
    writeFileSync(release, "release\n");
    await Bun.sleep(100);
    expect(existsSync(mutation)).toBe(false);
  });

  it("persists only the exact session group, then drains it before abort settlement", async () => {
    const f = fixture();
    const mutation = join(f.root, "abort-overlap");
    const release = join(f.root, "abort-release");
    const controller = new AbortController();
    const tool = createBashTool(f.root, {
      defaultTimeout: 5,
      processGroupOwner: { persistDir: f.persistDir, sessionId: "abort-session" },
    });

    const execution = tool.execute("abort", { command: mutationCommand(mutation, release, 30) }, controller.signal);
    for (
      let attempt = 0;
      attempt < 50 && readSessionBashProcessGroups(f.persistDir, "abort-session").length === 0;
      attempt += 1
    ) {
      await Bun.sleep(10);
    }
    expect(readSessionBashProcessGroups(f.persistDir, "abort-session")).toHaveLength(1);
    expect(readSessionBashProcessGroups(f.persistDir, "other-session")).toEqual([]);
    controller.abort();
    await expect(execution).rejects.toThrow("Command aborted");
    expect(readSessionBashProcessGroups(f.persistDir, "abort-session")).toEqual([]);
    writeFileSync(release, "release\n");
    await Bun.sleep(100);
    expect(existsSync(mutation)).toBe(false);
  });

  it("drains descendants and removes the exact sidecar before timeout settlement", async () => {
    const f = fixture();
    const mutation = join(f.root, "timeout-overlap");
    const release = join(f.root, "timeout-release");
    const tool = createBashTool(f.root, {
      defaultTimeout: 0.1,
      processGroupOwner: { persistDir: f.persistDir, sessionId: "timeout-session" },
    });

    await expect(tool.execute("timeout", { command: mutationCommand(mutation, release, 30) })).rejects.toThrow(
      "Command timed out after 0.1 seconds",
    );
    expect(readSessionBashProcessGroups(f.persistDir, "timeout-session")).toEqual([]);
    writeFileSync(release, "release\n");
    await Bun.sleep(100);
    expect(existsSync(mutation)).toBe(false);
  });

  it("returns an explicit undrained result and preserves a persisted PGID after both signal phases", () => {
    const f = fixture();
    const signals: string[] = [];
    addSessionBashProcessGroup(f.persistDir, "persisted-undrained", 424_242);

    const confirmedDrained = drainPersistedSessionBashProcessGroups(f.persistDir, "persisted-undrained", {
      isAlive: () => true,
      signal: (_pgid, signal) => signals.push(signal),
      wait: () => undefined,
    });

    expect(confirmedDrained).toBe(false);
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(readSessionBashProcessGroups(f.persistDir, "persisted-undrained")).toEqual([424_242]);
  });

  for (const mode of ["normal", "abort", "timeout"] as const) {
    it(`fails ${mode} settlement closed and preserves the durable sidecar when drain is unconfirmed`, async () => {
      const f = fixture();
      const sessionId = `undrained-${mode}`;
      const controller = new AbortController();
      const tool = createBashTool(f.root, {
        defaultTimeout: mode === "timeout" ? 0.05 : 5,
        operations: createLocalBashOperations(async () => false),
        processGroupOwner: { persistDir: f.persistDir, sessionId },
      });
      const execution = tool.execute(
        mode,
        { command: mode === "normal" ? "true" : "sleep 30" },
        mode === "abort" ? controller.signal : undefined,
      );
      if (mode === "abort") {
        for (
          let attempt = 0;
          attempt < 50 && readSessionBashProcessGroups(f.persistDir, sessionId).length === 0;
          attempt += 1
        ) {
          await Bun.sleep(5);
        }
        controller.abort();
      }

      await expect(execution).rejects.toThrow("did not exit after bounded SIGTERM/SIGKILL drain");
      const pgids = readSessionBashProcessGroups(f.persistDir, sessionId);
      expect(pgids).toHaveLength(1);
      try {
        process.kill(-pgids[0]!, "SIGKILL");
      } catch {
        // The normal command has already exited; its durable record remains by design.
      }
    });
  }
});
