import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../agents/may/handlers/metric-alert-reactor.ts";

describe("metric-alert-reactor", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    const root = join(tmpdir(), `metric-alert-reactor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const agentsRoot = join(root, "agents");
    tempDirs.push(root);
    mkdirSync(join(agentsRoot, "arc"), { recursive: true });
    writeFileSync(join(agentsRoot, "arc", "agent.json"), JSON.stringify({ name: "arc" }));

    const runs: Array<{ owner: string; task: string; source?: string }> = [];
    const logs: string[] = [];
    const handler = create({
      sdk: {
        paths: { root, agents: agentsRoot },
        getDb: () => {
          throw new Error("db unavailable");
        },
        log: (_level: string, msg: string) => logs.push(msg),
        runAgent: async (owner: string, task: string, opts?: { source?: string }) => {
          runs.push({ owner, task, source: opts?.source });
          return { sessionId: "s_alert", status: "done" };
        },
      },
    } as any, {} as any);

    return { handler, runs, logs };
  }

  it("defers P1 alerts to heartbeat context", async () => {
    const { handler, runs, logs } = setup();

    await handler({
      type: "metric.breach",
      data: {
        owner: "arc",
        metricId: "arc.quality",
        metricName: "Arc quality",
        current: 0.4,
        threshold: 0.8,
        target: 0.95,
        message: "quality below threshold",
        priority: "P1",
      },
    } as any);

    expect(runs).toEqual([]);
    expect(logs.some((msg) => msg.includes("Deferring arc.quality (P1) to metric context"))).toBe(true);
  });

  it("forks the owner for P0 alerts", async () => {
    const { handler, runs } = setup();

    await handler({
      type: "metric.breach",
      data: {
        owner: "arc",
        metricId: "arc.down",
        metricName: "Arc down",
        current: 0,
        threshold: 1,
        target: 1,
        message: "critical failure",
        priority: "P0",
      },
    } as any);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ owner: "arc", source: "metric-alert-reactor:arc.down" });
    expect(runs[0].task).toContain("[metric-alert][arc.down][P0]");
  });
});
