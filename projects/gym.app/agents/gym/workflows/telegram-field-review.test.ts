import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  runTelegramFieldReview,
  scanTelegramFieldInteractions,
  type TelegramFieldInteraction,
} from "./telegram-field-review";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function task(): string {
  return `## Reconciliation Task\n\n\`\`\`json\n${JSON.stringify({
    taskId: "learning/telegram-field-review",
    generation: 1,
    input: { batchSize: 40 },
  })}\n\`\`\``;
}

function interaction(id: number): TelegramFieldInteraction {
  return {
    kind: "conversation",
    sourceId: `telegram-event-${id}`,
    rootEventId: id,
    traceId: `trace-${id}`,
    timestamp: 1_785_000_000_000 + id,
    sessionIds: [`session-${id}`],
    humanMessage: "Please investigate the cause and fix it.",
    replyContext: null,
    mayResponses: ["I only described the symptom and stopped."],
    sessionEvidence: [
      { sessionId: `session-${id}`, status: "done", outcome: "No fix made" },
    ],
    actionEvents: [],
    terminalEvents: [{ eventType: "session.idle", sessionId: `session-${id}` }],
    nextHumanMessage: "Why did you stop? Please push it forward.",
  };
}

function context(root: string, runAgent: WorkflowContext["runAgent"]) {
  const emitted: Array<Record<string, unknown>> = [];
  const ctx = {
    projectsRoot: join(root, "projects"),
    task: task(),
    runAgent,
    emit(event: Record<string, unknown>) {
      emitted.push(event);
    },
    done(summary: string, output: unknown) {
      return { type: "done" as const, summary, output };
    },
  } as unknown as WorkflowContext;
  return { ctx, emitted };
}

test("keeps strong field signals, emits actionable failures, and advances the checkpoint", async () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-field-review-"));
  roots.push(root);
  const { ctx, emitted } = context(root, async () => ({
    status: "success",
    sessionId: "review-session",
    structuredResult: {
      summary: "One reusable failure and one weak observation.",
      signals: [
        {
          sourceIds: ["telegram-event-41"],
          polarity: "negative",
          fulfillment: "missed",
          responsibleLayer: "may-judgment",
          intent: "Hao wanted the issue driven to closure.",
          handling: "May described the symptom and stopped.",
          outcomeEvidence: "Hao explicitly asked why May stopped.",
          reusableRule: "Investigate and push the owner workflow forward.",
          recommendedUse: "benchmark-seed",
          strong: true,
          confidence: 0.98,
        },
        {
          sourceIds: ["telegram-event-41"],
          polarity: "positive",
          fulfillment: "unclear",
          responsibleLayer: "may-judgment",
          intent: "Weak guess",
          handling: "Weak guess",
          outcomeEvidence: "No clear reaction",
          reusableRule: "Guess",
          recommendedUse: "lesson-example",
          strong: false,
          confidence: 0.5,
        },
      ],
    },
  })) as ReturnType<typeof context>;

  const result = await runTelegramFieldReview(ctx, {
    scan: () => ({
      interactions: [interaction(41)],
      scanned: 1,
      skippedStale: 0,
      nextEventId: 41,
      waitingForCompletion: false,
    }),
  });
  expect(result.type).toBe("done");
  expect(emitted).toEqual([
    expect.objectContaining({
      type: "gym.incident.detected",
      incidentId: expect.stringContaining("telegram-field-"),
      classification: "may-judgment",
    }),
  ]);
  const stateDir = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "learning",
    "telegram",
  );
  const evidenceFiles = readdirSync(join(stateDir, "evidence"));
  expect(evidenceFiles).toHaveLength(1);
  const evidence = readFileSync(
    join(stateDir, "evidence", evidenceFiles[0]!),
    "utf8",
  );
  expect(evidence).toContain(
    "Investigate and push the owner workflow forward.",
  );
  expect(evidence).not.toContain("Please investigate the cause and fix it.");
  expect(
    JSON.parse(readFileSync(join(stateDir, "checkpoint.json"), "utf8")),
  ).toMatchObject({ last_root_event_id: 41 });
  expect(existsSync(join(stateDir, "scratch"))).toBe(true);
});

test("preserves the checkpoint when the field reviewer fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "telegram-field-review-"));
  roots.push(root);
  const { ctx } = context(root, async () => ({
    status: "error",
    sessionId: "failed-review",
  })) as ReturnType<typeof context>;
  const result = await runTelegramFieldReview(ctx, {
    scan: () => ({
      interactions: [interaction(72)],
      scanned: 1,
      skippedStale: 0,
      nextEventId: 72,
      waitingForCompletion: false,
    }),
  });
  expect(result.type).toBe("done");
  expect(
    existsSync(
      join(
        ctx.projectsRoot,
        "gym.app",
        ".state",
        "learning",
        "telegram",
        "checkpoint.json",
      ),
    ),
  ).toBe(false);
});

test("uses the Telegram delivery ledger when a completed reply is missing trace closure", () => {
  const timestamp = Date.now() - 60 * 60_000;
  const query = {
    sql(sql: string) {
      if (sql.includes("root.id AS rootEventId")) {
        return {
          rows: [
            {
              rootEventId: 91,
              timestamp,
              rootData: JSON.stringify({
                text: "Fix why this alert is useless.",
                target: { sessionId: "session-91" },
              }),
              traceId: "trace-91",
              hasTerminal: 0,
              hasDelivery: 0,
            },
          ],
        };
      }
      if (sql.includes("trace.trace_id = ?")) {
        return { rows: [] };
      }
      if (sql.includes("id > ?") && sql.includes("ORDER BY id ASC")) {
        return {
          rows: [
            {
              timestamp: timestamp + 10_000,
              data: JSON.stringify({ text: "Why did May stop?" }),
            },
          ],
        };
      }
      if (sql.includes("FROM notification_messages")) {
        return {
          rows: [
            {
              data: JSON.stringify({ text: "I routed the alert fix." }),
              sentAt: timestamp + 5_000,
            },
          ],
        };
      }
      if (sql.includes("FROM sessions")) {
        return {
          rows: [
            {
              sessionId: "session-91",
              status: "done",
              outcome: "Alert fix routed",
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const ctx = { query } as unknown as WorkflowContext;
  const scan = scanTelegramFieldInteractions(ctx, 0, 40);
  expect(scan.interactions).toHaveLength(1);
  expect(scan.skippedStale).toBe(0);
  expect(scan.waitingForCompletion).toBe(false);
  expect(scan.interactions[0]).toMatchObject({
    sourceId: "telegram-event-91",
    mayResponses: ["I routed the alert fix."],
    sessionEvidence: [{ sessionId: "session-91", outcome: "Alert fix routed" }],
  });
});

test("reviews proactive May shadow judgments without requiring a human reply", () => {
  const timestamp = Date.now() - 60_000;
  const query = {
    sql(sql: string) {
      if (sql.includes("root.id AS rootEventId")) {
        return {
          rows: [
            {
              rootEventId: 105,
              rootType: "human.attention.reviewed",
              timestamp,
              rootData: JSON.stringify({
                mode: "shadow",
                delivered: true,
                status: "completed",
                disposition: "route",
                understoodIntent: "Recover the project-owned failure.",
                reason: "The owner can act before Hao is needed.",
                nextAction: "Route to the AKS owner and require rerun proof.",
                owner: "aks-owner",
                sessionId: "review-session-105",
                candidate: {
                  from: "evaluator",
                  content: "AKS failed. Hao, decide what to do.",
                  projectId: "aks-rp-e2e",
                },
              }),
              traceId: "trace-105",
              hasTerminal: 0,
              hasDelivery: 0,
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const ctx = { query } as unknown as WorkflowContext;
  const scan = scanTelegramFieldInteractions(ctx, 0, 40);

  expect(scan.interactions).toEqual([
    expect.objectContaining({
      kind: "proactive-review",
      sourceId: "attention-review-105",
      humanMessage: "AKS failed. Hao, decide what to do.",
      sessionIds: ["review-session-105"],
      mayResponses: [expect.stringContaining("Disposition: route")],
      replyContext: expect.objectContaining({
        mode: "shadow",
        delivered: true,
        projectId: "aks-rp-e2e",
      }),
    }),
  ]);
  expect(scan.waitingForCompletion).toBe(false);
  expect(scan.nextEventId).toBe(105);
});
