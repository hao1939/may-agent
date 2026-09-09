import { configureMaintenance } from "../../../../test/fixtures/maintenance.js";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HostMaintenance, computeMaintenanceResumeDelay } from "./runtime.ts";
import { closeDb, getDb } from "../../../lib/requests.ts";

const PLATFORM_REVIEW = "may-agent-schedule-platform-review";

function root(): string {
  return mkdtempSync(join(tmpdir(), "may-cron-restart-"));
}

function recordStarted(projectRoot: string, entryName: string, timestamp: number): void {
  getDb(join(projectRoot, ".state"))
    .prepare(
      `INSERT INTO events (event_type, source, owner, data, timestamp, handler)
       VALUES ('handler.started', 'cron', 'agent:dev', '{}', ?, ?)`,
    )
    .run(timestamp, entryName);
}

function closeRoot(projectRoot: string): void {
  closeDb(join(projectRoot, ".state"));
  rmSync(projectRoot, { recursive: true, force: true });
}

function cronAt(
  projectRoot: string,
  entryName: string,
  intervalMs: number,
  handler: () => Promise<void>,
): HostMaintenance {
  const cron = new HostMaintenance({ configPath: join(projectRoot, "missing-cron.json"), projectRoot: projectRoot });
  cron.registerHandler(entryName, handler);
  configureMaintenance(cron, {
    name: entryName,
    enabled: true,
    intervalMs,
    handler: "maintenance",
  });
  return cron;
}

function reconstructedDelay(cron: HostMaintenance, entryName: string): number {
  const entry = cron.getEntries().find((candidate) => candidate.name === entryName)!;
  return (cron as any).computeResumeDelay(entry);
}

describe("HostMaintenance restart-safe schedule cadence", () => {
  it("reconstructs a pre-due registration without an early or duplicate emission", async () => {
    const projectRoot = root();
    const intervalMs = 60000;
    // Database creation and migrations are not part of the scheduling interval under test.
    getDb(join(projectRoot, ".state"));
    const startedAt = Date.now();
    recordStarted(projectRoot, "restart-before-due", startedAt - intervalMs + 200);
    let emissions = 0;
    let resolveFirstEmission!: () => void;
    const firstEmission = new Promise<void>((resolve) => {
      resolveFirstEmission = resolve;
    });
    const cron = cronAt(projectRoot, "restart-before-due", intervalMs, async () => {
      emissions += 1;
      resolveFirstEmission();
    });
    const entry = cron.getEntries()[0]!;
    try {
      const delayUntilDue = reconstructedDelay(cron, entry.name);
      expect(delayUntilDue).toBeGreaterThan(0);
      cron.start();
      configureMaintenance(cron, entry);
      configureMaintenance(cron, entry);
      expect((cron as any).pendingStartTimers.size).toBe(1);

      await Bun.sleep(Math.max(1, Math.floor(delayUntilDue / 2)));
      expect(emissions).toBe(0);

      await Promise.race([
        firstEmission,
        Bun.sleep(delayUntilDue + 250).then(() => {
          throw new Error("cron entry did not emit when due");
        }),
      ]);
      await Bun.sleep(0);
      expect(emissions).toBe(1);
    } finally {
      cron.stop();
      closeRoot(projectRoot);
    }
  });

  it("fires one due interval after restart despite repeated registration", async () => {
    const projectRoot = root();
    const intervalMs = 60_000;
    recordStarted(projectRoot, "restart-after-due", Date.now() - intervalMs - 1);
    let emissions = 0;
    const cron = cronAt(projectRoot, "restart-after-due", intervalMs, async () => {
      emissions += 1;
    });
    const entry = cron.getEntries()[0]!;
    try {
      expect(reconstructedDelay(cron, entry.name)).toBe(0);
      cron.start();
      configureMaintenance(cron, entry);
      configureMaintenance(cron, entry);
      expect((cron as any).pendingStartTimers.size).toBe(1);
      await Bun.sleep(10);
      expect(emissions).toBe(1);
    } finally {
      cron.stop();
      closeRoot(projectRoot);
    }
  });

  it("preserves first-registration offset and bounded jitter for hourly and daily schedules", () => {
    expect(computeMaintenanceResumeDelay({ intervalMs: 3_600_000, lastFireTime: null, now: 0, offsetMs: 42_000 })).toBe(
      42_000,
    );
    expect(
      computeMaintenanceResumeDelay({ intervalMs: 3_600_000, lastFireTime: null, now: 0, random: () => 0.5 }),
    ).toBe(150_000);
    expect(
      computeMaintenanceResumeDelay({ intervalMs: 86_400_000, lastFireTime: null, now: 0, random: () => 0.5 }),
    ).toBe(150_000);
  });

  it("produces a deterministic may-agent platform-review restart trace with no tick before 21,600,000 ms", () => {
    const intervalMs = 21_600_000;
    const firstTick = 1_800_000_000_000;
    const restartAt = firstTick + 1_234;
    const remaining = computeMaintenanceResumeDelay({
      intervalMs,
      lastFireTime: firstTick,
      now: restartAt,
    });
    const trace = [
      { at: firstTick, event: "project.tick", entry: PLATFORM_REVIEW },
      { at: restartAt, event: "daemon.restart", entry: PLATFORM_REVIEW },
      { at: restartAt + remaining, event: "project.tick", entry: PLATFORM_REVIEW },
    ];

    expect(remaining).toBe(intervalMs - 1_234);
    expect(trace.filter((item) => item.event === "project.tick")).toHaveLength(2);
    expect(trace[2]!.at - trace[0]!.at).toBe(21_600_000);
    expect(
      trace.some((item) => item.event === "project.tick" && item.at > firstTick && item.at < firstTick + intervalMs),
    ).toBe(false);
  });
});
