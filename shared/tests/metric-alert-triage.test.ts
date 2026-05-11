import { describe, expect, it, vi } from "vitest";
import { execute } from "../workflows/metric-alert-triage.js";

describe("metric-alert-triage workflow", () => {
  it("compacts owner session rows before passing context to the owner agent", async () => {
    const ownerTasks: string[] = [];
    const emitted: Array<Record<string, unknown>> = [];
    const hugeTask = "x".repeat(80_000);
    const ctx = {
      task: [
        "Run metric alert triage for m.alert.",
        "",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "metric.breach",
          data: { metricId: "m.alert", owner: "dev", priority: "P1" },
        }),
        "```",
      ].join("\n"),
      agentsRoot: "/no/such/agents",
      query: {
        metricAlertContext: vi.fn(() => ({
          alert: { id: 7, metric_id: "m.alert", created_at: 10 },
          metric: { id: "m.alert", explicitOwner: "dev", priority: "P1" },
          snapshots: [],
          relatedEvents: [],
          metricId: "m.alert",
          alertId: 7,
        })),
        sessions: vi.fn(() => ({
          rows: [{
            sessionId: "s_huge",
            agent: "dev",
            status: "done",
            source: "workflow:metric-alert-triage",
            startedAt: 11,
            endedAt: 12,
            task: hugeTask,
          }],
          rowCount: 1,
          limit: 5,
          truncated: false,
        })),
      },
      runFunction: vi.fn(async (_label: string, fn: () => Promise<string>) => ({
        sessionId: "fn",
        status: "done",
        lastAssistantText: await fn(),
        messages: [],
        duration: "0s",
        outputDir: "/tmp",
      })),
      runAgent: vi.fn(async (_agent: string, task: string) => {
        ownerTasks.push(task);
        return {
          sessionId: "s_owner",
          status: "done",
          lastAssistantText: [
            "METRIC_ALERT_OPERATION: waiting_with_evidence",
            "METRIC_ALERT_EVIDENCE: compact context checked",
            "METRIC_ALERT_NEXT_VALIDATION: next metrics-snapshot",
          ].join("\n"),
          messages: [],
          duration: "1s",
          outputDir: "/tmp",
        };
      }),
      emit: (event: Record<string, unknown>) => emitted.push(event),
      notify: vi.fn(),
      done: (summary: string) => ({ type: "done", summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate", reason, context }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({ type: "done" });
    expect(ownerTasks[0]).toContain("taskPreview");
    expect(ownerTasks[0]).not.toContain(hugeTask);
    expect(ownerTasks[0]!.length).toBeLessThan(20_000);
    expect(emitted).toContainEqual(expect.objectContaining({
      type: "metric.alert_judged",
      metricId: "m.alert",
      owner: "dev",
      operation: "waiting_with_evidence",
    }));
  });
});
