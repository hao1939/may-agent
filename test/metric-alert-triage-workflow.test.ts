import { describe, expect, it } from "vitest";
import { execute } from "../agents/shared/workflows/metric-alert-triage.ts";

function makeDb() {
  const rows = {
    metric: {
      id: "arc.quality",
      name: "Arc quality",
      explicitOwner: "arc",
      projectOwner: null,
      current: 0.4,
      threshold: 0.8,
      target: 0.95,
      priority: "P1",
      project: null,
      status: "breach",
      updated_at: Date.now(),
    },
    alert: {
      id: 7,
      metric_id: "arc.quality",
      alert_type: "threshold",
      message: "quality below threshold",
      created_at: Date.now() - 60_000,
      resolved_at: null,
    },
    snapshots: [
      { value: 0.4, measured_at: Date.now(), note: "latest" },
      { value: 0.5, measured_at: Date.now() - 300_000, note: "previous" },
    ],
    ownerSessions: [
      { sessionId: "s_prior", status: "done", source: "heartbeat-arc", startedAt: Date.now() - 30_000, endedAt: Date.now() - 20_000 },
    ],
  };

  return {
    prepare(sql: string) {
      return {
        get(..._args: unknown[]) {
          if (sql.includes("FROM metrics")) return rows.metric;
          if (sql.includes("FROM metric_alerts")) return rows.alert;
          return null;
        },
        all(..._args: unknown[]) {
          if (sql.includes("FROM metric_snapshots")) return rows.snapshots;
          if (sql.includes("FROM sessions")) return rows.ownerSessions;
          return [];
        },
      };
    },
  };
}

function task() {
  return [
    "Run metric alert triage.",
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify({
      type: "metric.breach",
      data: {
        alertId: 7,
        owner: "arc",
        metricId: "arc.quality",
        metricName: "Arc quality",
        current: 0.4,
        threshold: 0.8,
        target: 0.95,
        message: "quality below threshold",
        priority: "P1",
      },
    }, null, 2),
    "```",
  ].join("\n");
}

describe("metric-alert-triage workflow", () => {
  it("emits metric.alert_judged after owner returns a structured operation", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const agentTasks: string[] = [];
    const ctx = {
      task: task(),
      agentsRoot: "/tmp/no-agents",
      getDb: () => makeDb(),
      runFunction: async (_label: string, fn: () => Promise<string>) => ({
        sessionId: "fn_load",
        status: "done",
        lastAssistantText: await fn(),
        messages: [],
        duration: "0s",
        outputDir: "",
      }),
      runAgent: async (_agent: string, agentTask: string) => {
        agentTasks.push(agentTask);
        return {
          sessionId: "s_owner",
          status: "done",
          lastAssistantText: [
            "I found the cause and fixed it.",
            "METRIC_ALERT_OPERATION: fix_root_cause",
            "METRIC_ALERT_EVIDENCE: handler bug reproduced and patched",
            "METRIC_ALERT_NEXT_VALIDATION: next metrics-snapshot",
          ].join("\n"),
          messages: [],
          duration: "1s",
          outputDir: "",
        };
      },
      emit: (event: Record<string, unknown>) => emitted.push(event),
      done: (summary: string) => ({ type: "done", summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate", reason, context }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({ type: "done" });
    expect(agentTasks[0]).toContain("METRIC_ALERT_OPERATION");
    expect(agentTasks[0]).toContain("Metrics are signals, not judges");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "metric.alert_judged",
      metricId: "arc.quality",
      alertId: 7,
      owner: "arc",
      operation: "fix_root_cause",
      evidence: "handler bug reproduced and patched",
      ownerSessionId: "s_owner",
      workflow: "metric-alert-triage",
    });
  });

  it("escalates instead of recording closure when owner omits the structured operation", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const notifications: string[] = [];
    const ctx = {
      task: task(),
      agentsRoot: "/tmp/no-agents",
      getDb: () => makeDb(),
      runFunction: async (_label: string, fn: () => Promise<string>) => ({
        sessionId: "fn_load",
        status: "done",
        lastAssistantText: await fn(),
        messages: [],
        duration: "0s",
        outputDir: "",
      }),
      runAgent: async () => ({
        sessionId: "s_owner",
        status: "done",
        lastAssistantText: "I investigated but forgot the required footer.",
        messages: [],
        duration: "1s",
        outputDir: "",
      }),
      emit: (event: Record<string, unknown>) => emitted.push(event),
      notify: (msg: string) => notifications.push(msg),
      done: (summary: string) => ({ type: "done", summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate", reason, context }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({ type: "escalate" });
    expect(String((result as any).reason)).toContain("did not produce a valid METRIC_ALERT_OPERATION");
    expect(emitted).toEqual([]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("Metric alert triage needs attention for arc.quality");
    expect(notifications[0]).toContain("owner did not produce a valid METRIC_ALERT_OPERATION");
  });
});
