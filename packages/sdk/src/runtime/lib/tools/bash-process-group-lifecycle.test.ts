import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  BASH_PROCESS_GROUP_TERM_GRACE_MS,
  addSessionBashProcessGroup,
  bashSessionProcessGroups,
  createBashTool,
  createLocalBashOperations,
  drainBashProcessGroup,
  drainPersistedSessionBashProcessGroups,
  drainSessionBashProcessGroups,
  processGroupContainsLiveMember,
  readSessionBashProcessGroups,
  removeSessionBashProcessGroup,
} from "@may-agent/sdk/runtime";

function sessionDir(persistDir: string, sessionId: string): string {
  return join(persistDir, "sessions", sessionId);
}

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
  it.each(["normal", "abort"] as const)(
    "drains nested GNU timeout groups before %s settlement without stopping another session",
    async (mode) => {
      const f = fixture();
      const ready = join(f.root, "nested-ready");
      const release = join(f.root, "nested-release");
      const mutation = join(f.root, "nested-mutation");
      const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
      const nested = `trap '' TERM; printf '%s %s\\n' "$$" "$PPID" > ${quote(ready)}; while [ ! -e ${quote(release)} ]; do sleep 0.02; done; printf mutated > ${quote(mutation)}`;
      const controller = new AbortController();
      const tool = createBashTool(f.root, {
        defaultTimeout: 10,
        processGroupOwner: { persistDir: f.persistDir, sessionId: "nested-session" },
      });
      const neighbor = spawn("/usr/bin/setsid", ["/bin/sleep", "30"]);
      const neighborExit = new Promise((resolve) => neighbor.once("exit", resolve));
      let nestedGroup: number | undefined;
      try {
        const command = `timeout 30s /bin/bash -c ${quote(nested)} & ${mode === "normal"
          ? `while [ ! -s ${quote(ready)} ]; do sleep 0.01; done`
          : "wait"}`;
        const execution = tool.execute("nested", { command }, controller.signal);
        const deadline = Date.now() + 5_000;
        while (!existsSync(ready) && Date.now() < deadline) await Bun.sleep(10);
        expect(existsSync(ready)).toBe(true);
        nestedGroup = Number(readFileSync(ready, "utf8").trim().split(" ")[1]);
        expect(nestedGroup).toBeGreaterThan(0);
        if (mode === "abort") {
          controller.abort();
          await expect(execution).rejects.toThrow("Command aborted");
        } else await execution;
        expect(processGroupContainsLiveMember(nestedGroup, readdirSync("/proc"))).toBe(false);
        expect(readSessionBashProcessGroups(f.persistDir, "nested-session")).toEqual([]);
        expect(() => process.kill(neighbor.pid!, 0)).not.toThrow();
        writeFileSync(release, "release\n");
        expect(existsSync(mutation)).toBe(false);
      } finally {
        // Contain the demonstrated leak even when this test runs on old code.
        if (existsSync(ready)) {
          nestedGroup ??= Number(readFileSync(ready, "utf8").trim().split(" ")[1]);
          try { process.kill(-nestedGroup, "SIGKILL"); } catch { /* Already drained. */ }
        }
        neighbor.kill("SIGKILL");
        await neighborExit;
      }
    },
    10_000,
  );

  it.each(["live", "persisted"] as const)(
    "recovers nested groups after their leader exits through %s cleanup",
    async (mode) => {
      const f = fixture();
      const ready = join(f.root, "recovery-ready");
      const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
      const nested = `trap '' TERM; printf '%s\\n' "$PPID" > ${quote(ready)}; sleep 30`;
      const tool = createBashTool(f.root, {
        defaultTimeout: 5,
        operations: createLocalBashOperations(async () => false),
        processGroupOwner: { persistDir: f.persistDir, sessionId: "nested-recovery" },
      });
      let nestedGroup: number | undefined;
      try {
        // Retain a real production sidecar as if the owning process had failed
        // to confirm cleanup. Only the nested GNU timeout group remains alive.
        await expect(tool.execute("recovery", {
          command: `timeout 30s /bin/bash -c ${quote(nested)} & while [ ! -s ${quote(ready)} ]; do sleep 0.01; done`,
        })).rejects.toThrow("did not exit after bounded SIGTERM/SIGKILL drain");
        nestedGroup = Number(readFileSync(ready, "utf8").trim());
        expect(processGroupContainsLiveMember(nestedGroup, readdirSync("/proc"))).toBe(true);
        const [leader] = readSessionBashProcessGroups(f.persistDir, "nested-recovery");
        expect(leader).toBeGreaterThan(0);
        expect(processGroupContainsLiveMember(leader!, readdirSync("/proc"))).toBe(false);
        const drained = mode === "live"
          ? await drainSessionBashProcessGroups(f.persistDir, "nested-recovery")
          : drainPersistedSessionBashProcessGroups(f.persistDir, "nested-recovery");
        expect(drained).toBe(true);
        expect(processGroupContainsLiveMember(nestedGroup, readdirSync("/proc"))).toBe(false);
        expect(readSessionBashProcessGroups(f.persistDir, "nested-recovery")).toEqual([]);
      } finally {
        if (existsSync(ready)) {
          nestedGroup ??= Number(readFileSync(ready, "utf8").trim());
          try { process.kill(-nestedGroup, "SIGKILL"); } catch { /* Already drained. */ }
        }
      }
    },
    10_000,
  );

  it.each(["invalid-json", "unreadable"] as const)(
    "rejects %s evidence before invoking local Bash execution",
    async (kind) => {
      const f = fixture();
      const sessionId = `preflight-${kind}`;
      const dir = sessionDir(f.persistDir, sessionId);
      mkdirSync(dir, { recursive: true });
      const path = join(dir, "bash-process-groups.json");
      const damaged = '{"pgids":[';
      if (kind === "unreadable") mkdirSync(path);
      else writeFileSync(path, damaged);
      const local = createLocalBashOperations();
      let executionCalls = 0;
      const tool = createBashTool(f.root, {
        processGroupOwner: { persistDir: f.persistDir, sessionId },
        operations: {
          ...local,
          exec(command, cwd, options) {
            executionCalls += 1;
            return local.exec(command, cwd, options);
          },
        },
      });

      await expect(tool.execute("preflight", { command: "true" })).rejects.toThrow("bash process-group evidence");
      expect(executionCalls).toBe(0);
      expect(existsSync(path)).toBe(true);
      if (kind !== "unreadable") expect(readFileSync(path, "utf8")).toBe(damaged);
    },
  );

  it.each(["changed-evidence", "write-failure"] as const)(
    "drains and joins the spawned Bash group when registration fails from %s",
    async (kind) => {
      const f = fixture();
      const sessionId = `registration-${kind}`;
      addSessionBashProcessGroup(f.persistDir, sessionId, 999999999);
      const path = join(sessionDir(f.persistDir, sessionId), "bash-process-groups.json");
      const originalEvidence = readFileSync(path, "utf8");
      const damaged = '{"pgids":[';
      // The evidence remains readable, but the atomic registration write fails.
      if (kind === "write-failure") mkdirSync(`${path}.tmp.${process.pid}`);
      const ready = join(f.root, "descendant-ready");
      let spawnedPgid: number | undefined;
      let confirmedDrain = false;
      let removalCalls = 0;
      const local = createLocalBashOperations(async (pgid) => {
        // Observe an actual descendant before draining; do not assume fork speed.
        const deadline = Date.now() + 5_000;
        while (!existsSync(ready) && Date.now() < deadline) await Bun.sleep(10);
        confirmedDrain = await drainBashProcessGroup(pgid);
        return confirmedDrain;
      });
      const tool = createBashTool(f.root, {
        defaultTimeout: 10,
        processGroupOwner: { persistDir: f.persistDir, sessionId },
        operations: {
          ...local,
          exec(command, cwd, options) {
            // Corrupt after the tool's preflight to exercise the spawn/register gap.
            if (kind === "changed-evidence") writeFileSync(path, damaged);
            return local.exec(command, cwd, {
              ...options,
              onProcessGroupSpawn(pgid) {
                spawnedPgid = pgid;
                options.onProcessGroupSpawn?.(pgid);
              },
              onProcessGroupDrained(pgid) {
                removalCalls += 1;
                options.onProcessGroupDrained?.(pgid);
              },
            });
          },
        },
      });

      try {
        await expect(
          tool.execute("registration-failure", {
            command: `(trap '' TERM; printf ready > ${JSON.stringify(ready)}; sleep 30) & wait`,
          }),
        ).rejects.toThrow(kind === "changed-evidence" ? "bash process-group evidence" : "EISDIR");
        expect(spawnedPgid).toBeNumber();
        expect(confirmedDrain).toBe(true);
        expect(existsSync(ready)).toBe(true);
        expect(() => process.kill(spawnedPgid!, 0)).toThrow();
        expect(processGroupContainsLiveMember(spawnedPgid!, readdirSync("/proc"))).toBe(false);
        expect(removalCalls).toBe(0);
        expect(readFileSync(path, "utf8")).toBe(kind === "changed-evidence" ? damaged : originalEvidence);
      } finally {
        // Also contain the child when running this regression against broken code.
        if (spawnedPgid) await drainBashProcessGroup(spawnedPgid);
      }
    },
    10_000,
  );

  it("rejects settlement and preserves evidence damaged after successful registration", async () => {
    const f = fixture();
    const sessionId = "damaged-after-registration";
    const path = join(sessionDir(f.persistDir, sessionId), "bash-process-groups.json");
    const damaged = '{"pgids":[';
    let spawnedPgid: number | undefined;
    const local = createLocalBashOperations();
    const tool = createBashTool(f.root, {
      processGroupOwner: { persistDir: f.persistDir, sessionId },
      operations: {
        ...local,
        exec(command, cwd, options) {
          return local.exec(command, cwd, {
            ...options,
            onProcessGroupSpawn(pgid) {
              spawnedPgid = pgid;
              options.onProcessGroupSpawn?.(pgid);
              writeFileSync(path, damaged);
            },
          });
        },
      },
    });

    await expect(tool.execute("cleanup-evidence", { command: "true" })).rejects.toThrow("bash process-group evidence");
    expect(spawnedPgid).toBeNumber();
    expect(() => process.kill(spawnedPgid!, 0)).toThrow();
    expect(readFileSync(path, "utf8")).toBe(damaged);
  });

  it.each(["invalid-json", "invalid-shape", "invalid-member", "unreadable", "permission-denied"] as const)(
    "retains %s sidecar evidence and rejects live and recovery cleanup",
    async (kind) => {
      if (kind === "permission-denied" && typeof process.getuid === "function" && process.getuid() === 0) return;
      const f = fixture();
      const dir = sessionDir(f.persistDir, "damaged");
      mkdirSync(dir, { recursive: true });
      const path = join(dir, "bash-process-groups.json");
      const bytes =
        kind === "invalid-json"
          ? '{"pgids":['
          : kind === "invalid-shape"
            ? "null"
            : kind === "permission-denied"
              ? '{"pgids":[999999999]}'
              : '{"pgids":[999999999,"invalid"]}';
      if (kind === "unreadable") mkdirSync(path);
      else writeFileSync(path, bytes);
      if (kind === "permission-denied") chmodSync(dir, 0o000);
      try {
        expect(() => readSessionBashProcessGroups(f.persistDir, "damaged")).toThrow("bash process-group evidence");
        await expect(drainSessionBashProcessGroups(f.persistDir, "damaged")).rejects.toThrow(
          "bash process-group evidence",
        );
        expect(() => drainPersistedSessionBashProcessGroups(f.persistDir, "damaged")).toThrow(
          "bash process-group evidence",
        );
        expect(() => addSessionBashProcessGroup(f.persistDir, "damaged", 999999998)).toThrow(
          "bash process-group evidence",
        );
        expect(() => removeSessionBashProcessGroup(f.persistDir, "damaged", 999999999)).toThrow(
          "bash process-group evidence",
        );
      } finally {
        if (kind === "permission-denied") chmodSync(dir, 0o700);
      }
      expect(existsSync(path)).toBe(true);
      if (kind !== "unreadable") expect(readFileSync(path, "utf8")).toBe(bytes);
      expect(readSessionBashProcessGroups(f.persistDir, "legacy")).toEqual([]);
      expect(await drainSessionBashProcessGroups(f.persistDir, "legacy")).toBe(true);
      expect(drainPersistedSessionBashProcessGroups(f.persistDir, "legacy")).toBe(true);
    },
  );

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

  it("bounds proc stat reads while persisted recovery polls a TERM-resistant nested group", () => {
    const f = fixture();
    const sessionPgid = 424_240;
    const nestedPgid = 424_241;
    const entries = Array.from({ length: 64 }, (_, index) => String(500_000 + index));
    const nestedEntry = entries[17]!;
    let nestedAlive = true;
    let procStatReads = 0;
    let groupProbes = 0;
    let termProbes = 0;
    const signals: string[] = [];
    addSessionBashProcessGroup(f.persistDir, "persisted-proc-bound", sessionPgid);

    const confirmedDrained = drainPersistedSessionBashProcessGroups(f.persistDir, "persisted-proc-bound", {
      isAlive: () => true,
      signal: (pgid, signal) => {
        signals.push(`${pgid}:${signal}`);
        if (signal === "SIGKILL") nestedAlive = false;
      },
      wait: () => undefined,
      discoverGroups: (sessionId) => bashSessionProcessGroups(sessionId, entries, (pid) => {
        procStatReads += 1;
        if (pid === nestedEntry && nestedAlive) return `${pid} (nested) S 1 ${nestedPgid} ${sessionPgid} 0`;
        return `${pid} (other) S 1 ${pid} 999999 0`;
      }),
      groupExists: (pgid) => {
        groupProbes += 1;
        if (pgid !== nestedPgid || !nestedAlive) return false;
        // Exercise many 20 ms-equivalent polls without making the regression slow.
        termProbes += 1;
        return termProbes <= 50;
      },
    });

    expect(confirmedDrained).toBe(true);
    expect(groupProbes).toBeGreaterThan(50);
    expect(procStatReads).toBe(entries.length * 3);
    expect(signals).toEqual([`${nestedPgid}:SIGTERM`, `${nestedPgid}:SIGKILL`]);
    expect(readSessionBashProcessGroups(f.persistDir, "persisted-proc-bound")).toEqual([]);
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
