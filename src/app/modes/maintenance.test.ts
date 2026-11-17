import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { currentProcessInstance } from "../../lib/process-identity.js";
import type { DaemonHeartbeatRecord } from "../daemon-loops.js";
import { observeDaemonLiveness, observeDurableDaemonHeartbeat, observeRuntimeLiveness } from "./maintenance.js";

function heartbeat(recordedAt: number): DaemonHeartbeatRecord {
  return {
    version: 1,
    recordedAt,
    ...currentProcessInstance(),
    interfaceAgent: "may",
    socketEnabled: true,
    sql: { since: 1, calls: 2, errors: 0, totalMs: 3, untrackedCalls: 0 },
  };
}

describe("runtime liveness maintenance", () => {
  test("requires consecutive failures before requesting recovery", () => {
    let state = { consecutiveFailures: 0, lastRestartAt: 0, activeWorkProtectedUntil: 0 };
    for (let attempt = 1; attempt < 3; attempt += 1) {
      const observed = observeRuntimeLiveness(state, { responsive: false, activeWork: false }, attempt, {
        failureThreshold: 3,
      });
      state = observed.state;
      expect(observed.requestRestart).toBe(false);
    }
    const observed = observeRuntimeLiveness(state, { responsive: false, activeWork: false }, 3, {
      failureThreshold: 3,
    });
    expect(observed.requestRestart).toBe(true);
  });

  test("a healthy probe resets the failure streak", () => {
    expect(
      observeRuntimeLiveness(
        { consecutiveFailures: 5, lastRestartAt: 0, activeWorkProtectedUntil: 20 },
        { responsive: true, activeWork: false },
        10,
      ),
    ).toEqual({
      state: { consecutiveFailures: 0, lastRestartAt: 0, activeWorkProtectedUntil: 0 },
      requestRestart: false,
      protectedActiveWork: false,
    });
  });

  test("restart cooldown prevents a recovery loop", () => {
    const observed = observeRuntimeLiveness(
      { consecutiveFailures: 8, lastRestartAt: 1_000, activeWorkProtectedUntil: 0 },
      { responsive: false, activeWork: false },
      1_500,
      {
        failureThreshold: 3,
        restartCooldownMs: 1_000,
      },
    );
    expect(observed.requestRestart).toBe(false);
    expect(observed.state.consecutiveFailures).toBe(9);
  });

  test("recently observed active work suppresses socket-timeout recovery", () => {
    const active = observeRuntimeLiveness(
      { consecutiveFailures: 0, lastRestartAt: 0, activeWorkProtectedUntil: 0 },
      { responsive: true, activeWork: true },
      100,
      { activeWorkGraceMs: 1_000 },
    );
    const failed = observeRuntimeLiveness(
      { ...active.state, consecutiveFailures: 5 },
      { responsive: false, activeWork: false },
      500,
      { failureThreshold: 3, activeWorkGraceMs: 1_000 },
    );
    expect(failed.requestRestart).toBe(false);
    expect(failed.protectedActiveWork).toBe(true);
  });

  test("active work seen during a failed probe gets one bounded grace window", () => {
    const first = observeRuntimeLiveness(
      { consecutiveFailures: 5, lastRestartAt: 0, activeWorkProtectedUntil: 0 },
      { responsive: false, activeWork: true },
      100,
      { failureThreshold: 3, activeWorkGraceMs: 1_000 },
    );
    expect(first.requestRestart).toBe(false);
    expect(first.state.activeWorkProtectedUntil).toBe(1_100);

    const expired = observeRuntimeLiveness(first.state, { responsive: false, activeWork: true }, 1_101, {
      failureThreshold: 3,
      activeWorkGraceMs: 1_000,
    });
    expect(expired.requestRestart).toBe(true);
    expect(expired.state.activeWorkProtectedUntil).toBe(1_100);
  });

  test("expired active-work protection permits recovery", () => {
    const observed = observeRuntimeLiveness(
      { consecutiveFailures: 5, lastRestartAt: 0, activeWorkProtectedUntil: 1_100 },
      { responsive: false, activeWork: false },
      1_101,
      { failureThreshold: 3 },
    );
    expect(observed.requestRestart).toBe(true);
    expect(observed.protectedActiveWork).toBe(false);
  });

  test("fresh current-process heartbeat protects work when the control socket is unavailable", () => {
    const now = Date.now();
    expect(observeDurableDaemonHeartbeat(heartbeat(now - 100), process.pid, 3, now, 200)).toEqual({
      responsive: true,
      activeWork: true,
    });
  });

  test("stale, absent, malformed, future, and mismatched process heartbeats permit recovery", () => {
    const now = Date.now();
    const observations = [
      observeDurableDaemonHeartbeat(heartbeat(700), process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat(undefined, process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat({ version: 1, pid: process.pid, recordedAt: now }, process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat({ ...heartbeat(now), processIdentity: "" }, process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat({ ...heartbeat(now), processStartedAt: undefined }, process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat(heartbeat(now + 5_001), process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat(heartbeat(now), process.pid + 1, 0, now, 200),
      observeDurableDaemonHeartbeat({ ...heartbeat(now), processIdentity: "previous-daemon" }, process.pid, 0, now, 200),
      observeDurableDaemonHeartbeat({ ...heartbeat(now), processStartedAt: 1 }, process.pid, 0, now, 200),
    ];
    expect(observations).toEqual(observations.map(() => ({ responsive: false, activeWork: false })));
  });

  test("socket failure validates the live daemon process instance across a real process boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-maintenance-heartbeat-"));
    const instanceDir = join(root, "instances", "test");
    const socketPath = join(instanceDir, "may.sock");
    const childRecordPath = join(root, "child-process.json");
    const processIdentityModule = new URL("../../lib/process-identity.ts", import.meta.url).href;
    mkdirSync(instanceDir, { recursive: true });
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `import { writeFileSync } from "node:fs";
         import { currentProcessInstance } from ${JSON.stringify(processIdentityModule)};
         writeFileSync(${JSON.stringify(childRecordPath)}, JSON.stringify(currentProcessInstance()));
         setInterval(() => {}, 1_000);`,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    try {
      for (let attempt = 0; attempt < 100 && !existsSync(childRecordPath); attempt += 1) await Bun.sleep(10);
      expect(existsSync(childRecordPath)).toBe(true);
      const childInstance = JSON.parse(readFileSync(childRecordPath, "utf8")) as {
        pid: number;
        processIdentity: string;
        processStartedAt?: number;
      };
      expect(childInstance.pid).toBe(child.pid);
      expect(childInstance.processIdentity.length).toBeGreaterThan(0);
      expect(childInstance.processStartedAt).toBeGreaterThan(0);

      const liveHeartbeat: DaemonHeartbeatRecord = {
        version: 1,
        recordedAt: Date.now(),
        ...childInstance,
        interfaceAgent: "may",
        socketEnabled: true,
        sql: { since: 1, calls: 2, errors: 0, totalMs: 3, untrackedCalls: 0 },
      };
      writeFileSync(join(instanceDir, "may.pid"), String(child.pid));
      writeFileSync(join(instanceDir, "may.heartbeat.json"), JSON.stringify(liveHeartbeat));
      expect(await observeDaemonLiveness(root, socketPath)).toEqual({ responsive: true, activeWork: false });

      writeFileSync(
        join(instanceDir, "may.heartbeat.json"),
        JSON.stringify({ ...liveHeartbeat, processStartedAt: Number(liveHeartbeat.processStartedAt) + 1 }),
      );
      expect(await observeDaemonLiveness(root, socketPath)).toEqual({ responsive: false, activeWork: false });
    } finally {
      child.kill();
      await child.exited;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
