import { describe, expect, it } from "bun:test";
import {
  admitTaskReconcileResult,
  type TaskReconcileResult,
} from "@may-agent/sdk";
import { KnowledgePublicationError } from "./knowledge-publication";
import { retainAcceptedPublication } from "./accepted-publication";

const failure = new KnowledgePublicationError(
  "protected target",
  "/tmp/removed-worktree",
  "a".repeat(40),
  "b".repeat(40),
  ["projects/scout-knowledge-lib/knowledge/finding.md"],
  `refs/archive/scout-publication/${"b".repeat(40)}`,
);

describe("accepted publication ownership", () => {
  it("uses the archived content as stable recovery identity and preserves the complete waiting result", () => {
    const existing = {
      id: "independent-research",
      appId: "scout-knowledge-lib",
      input: {
        kind: "goal",
        data: {
          outcome: "Continue exploration",
          acceptance: ["Report evidence"],
        },
      },
    };
    const condition = {
      id: "source-ready",
      type: "source.ready",
      subject: "source:xhs",
      expected: { state: "ready" },
      owner: "human:operator",
      requestedAction: "Restore source access",
      reviewAfterMs: 60_000,
    };
    const waiting = {
      state: "waiting",
      summary: "Useful work and independent wait",
      facts: ["source:arxiv"],
      requests: [existing],
      conditions: [condition],
      actions: [
        {
          kind: "retire-condition",
          conditionId: "old-wait",
          expectedConditionGeneration: 2,
          reason: "Observed independently",
        },
      ],
      result: { retained: "planner-value" },
      report: true,
      continue: true,
      reviewAt: 2_000_000_000_000,
    } satisfies TaskReconcileResult;
    const first = retainAcceptedPublication(failure, {
      summary: "Retained",
      facts: ["unused:fallback"],
      acceptedWaiting: waiting,
    });
    const duplicate = retainAcceptedPublication(failure, {
      summary: "Retained",
      facts: [],
      acceptedWaiting: first,
    });

    const admitted = admitTaskReconcileResult(first);
    if (!admitted.ok) throw new Error(admitted.error);
    expect(admitted.result.requests).toEqual(first?.requests);
    expect(admitted.result.conditions).toEqual(first?.conditions);

    expect(first).toMatchObject({
      ...waiting,
      facts: expect.arrayContaining([
        "source:arxiv",
        `accepted-publication:pending:${"b".repeat(40)}`,
      ]),
      conditions: [
        condition,
        { requestId: `accepted-publication-${"b".repeat(40)}` },
      ],
      requests: [
        existing,
        {
          id: `accepted-publication-${"b".repeat(40)}`,
          appId: "scout-knowledge-lib",
          input: {
            kind: "goal",
            data: {
              context: {
                reason: "accepted-publication-recovery",
                candidateRef: `refs/archive/scout-publication/${"b".repeat(40)}`,
                candidateRevision: "b".repeat(40),
              },
            },
          },
        },
      ],
    });
    expect(duplicate?.requests).toHaveLength(2);
    expect(duplicate?.conditions).toEqual(first?.conditions);
    expect(duplicate?.actions).toEqual(waiting.actions);
    expect(duplicate?.result).toEqual(waiting.result);
  });

  it("does not recursively create recovery work when the recovery task waits", () => {
    const waiting = {
      state: "waiting",
      summary: "Human judgment still needed",
      facts: ["protected:path"],
      conditions: [
        {
          id: "operator-choice",
          type: "message.created",
          subject: "conversation:publication-recovery",
          expected: { decision: "provided" },
          owner: "human",
          requestedAction: "Choose a suitable writable integration",
          reviewAfterMs: 60_000,
        },
      ],
    } satisfies TaskReconcileResult;
    const retained = retainAcceptedPublication(failure, {
      summary: "Retained",
      facts: [],
      acceptedWaiting: waiting,
      recovery: {
        ref: failure.candidateRef!,
        revision: failure.candidateRevision,
        changedPaths: failure.changedPaths,
      },
    });
    expect(retained).toMatchObject({
      ...waiting,
      facts: expect.arrayContaining(waiting.facts),
    });
    expect(retained?.requests).toBeUndefined();
  });

  it("does not turn an unarchived or unchanged draft into publication work", () => {
    expect(
      retainAcceptedPublication(
        new KnowledgePublicationError("draft", "/tmp/draft", "a", "a", []),
        { summary: "Draft", facts: [] },
      ),
    ).toBeUndefined();
  });
});
