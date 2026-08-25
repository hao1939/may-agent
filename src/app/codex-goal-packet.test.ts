import { describe, expect, it } from "bun:test";
import { taskReconcileResultSchema } from "@may-agent/sdk";
import {
  buildCanonicalTaskAttemptPacket,
  MAX_CODEX_GOAL_OBJECTIVE_CHARS,
  readCodexGoalTaskAttempt,
  renderCodexGoalTaskAttempt,
  renderNativeTaskAttempt,
  type CanonicalTaskAttemptPacket,
} from "./codex-goal-packet.js";

function packet(overrides: Partial<CanonicalTaskAttemptPacket> = {}): CanonicalTaskAttemptPacket {
  return buildCanonicalTaskAttemptPacket({
    identity: {
      appId: "sample",
      taskId: "review:design",
      generation: 3,
      resourceVersion: 7,
      attemptId: "attempt-9",
    },
    desired: {
      outcome: "Review and refine the current design",
      acceptance: ["Findings cite current code", "The recommendation is actionable"],
      mode: "achieve",
      input: { document: "docs/design.md" },
    },
    role: {
      agent: "reviewer",
      instructions: "Prefer direct evidence and keep changes bounded.",
      capabilities: ["read-workspace", "publish-task-event"],
    },
    events: {
      items: [
        {
          eventId: 41,
          observedAt: "2026-08-23T08:00:00.000Z",
          event: { type: "task.steering", data: { message: "Check the recovery section" } },
        },
      ],
      throughEventId: 41,
      truncated: false,
      checkpoint: { summary: "Read the proposal", evidence: ["docs/design.md"] },
    },
    observations: {
      children: {
        live: [],
        completed: [
          {
            taskId: "review:tests",
            parentId: "review:design",
            generation: 1,
            outcome: "Verify the review",
            agent: "reviewer",
            input: {},
            conditions: [],
            hasLiveChildren: false,
            status: "done",
            evidence: ["test:pass"],
            completedAt: "2026-08-23T08:00:00.000Z",
          },
        ],
      },
      dependencies: [{ taskId: "collect:evidence", status: "done" }],
    },
    workspace: { cwd: "/tmp/sample", declaredOutputPaths: ["docs/design.md"] },
    contract: { resultSchema: structuredClone(taskReconcileResultSchema) as Record<string, unknown> },
    limits: {
      deadlineAt: "2026-08-23T08:15:00.000Z",
      remainingTaskTokens: 20_000,
      sandbox: "workspace-write",
    },
    ...overrides,
  });
}

describe("Codex goal Task packet", () => {
  it("gives native May and Codex the same semantic fields", () => {
    const canonical = packet();
    const nativeInput = renderNativeTaskAttempt(canonical);
    const codexInput = readCodexGoalTaskAttempt(renderCodexGoalTaskAttempt(canonical).developerInstructions);
    expect(codexInput).toEqual(nativeInput);
    expect(Object.keys(codexInput).sort()).toEqual(
      ["contract", "desired", "events", "identity", "limits", "observations", "role", "workspace"].sort(),
    );
  });

  it("keeps the goal stable across same-generation attempts and event replay", () => {
    const first = packet();
    const next = packet({
      identity: { ...first.identity, attemptId: "attempt-10", resourceVersion: 8 },
      events: {
        items: [
          ...first.events.items,
          {
            eventId: 42,
            observedAt: "2026-08-23T08:01:00.000Z",
            event: { type: "task.finding", data: { message: "Recovery wording is stale" } },
          },
        ],
        throughEventId: 42,
        truncated: false,
      },
    });
    const firstRendered = renderCodexGoalTaskAttempt(first);
    const nextRendered = renderCodexGoalTaskAttempt(next);
    expect(nextRendered.goalObjective).toBe(firstRendered.goalObjective);
    expect(nextRendered.developerInstructions).not.toBe(firstRendered.developerInstructions);
    expect(readCodexGoalTaskAttempt(nextRendered.developerInstructions)).toEqual(next);
  });

  it("changes the goal only with a new generation and respects Codex's objective limit", () => {
    const first = packet({ desired: { ...packet().desired, outcome: "x".repeat(8_000) } });
    const revised = packet({ identity: { ...first.identity, generation: first.identity.generation + 1 } });
    expect(renderCodexGoalTaskAttempt(first).goalObjective.length).toBe(MAX_CODEX_GOAL_OBJECTIVE_CHARS);
    expect(renderCodexGoalTaskAttempt(revised).goalObjective).not.toBe(renderCodexGoalTaskAttempt(first).goalObjective);
  });
});
