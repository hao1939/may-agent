import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { holdoutCases, holdoutVerdict, reloadRecoveryEvidence } from "./agent-operated-improvement.js";
import { validateActivationCondition } from "./task-improvement.js";
import { normalizeTaskHandlerResult } from "../../src/app/core/tasks/result.js";

function reloadRequests(...ids: string[]): AgentMessage {
  return {
    role: "assistant",
    content: ids.map((id) => ({ type: "toolCall", id, name: "definition_source", arguments: { action: "reload" } })),
    api: "openai-responses",
    provider: "fixture",
    model: "fixture",
    stopReason: "toolUse",
    timestamp: 0,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}
function reloadResult(id: string, result: unknown, isError = false): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: id,
    toolName: "definition_source",
    isError,
    timestamp: 0,
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}
const failure = reloadResult("first", { state: "not-submitted", retryable: true });
const activated = {
  activated: true,
  sourceCommit: "candidate",
  activeCommit: "candidate",
  reload: { state: "succeeded" },
};

test("recovery needs a later assistant reload after the exact failure, then matching activation", () => {
  const messages = [reloadRequests("first"), failure, reloadRequests("retry"), reloadResult("retry", activated)];
  const evidence = reloadRecoveryEvidence(messages, "first", "candidate");
  expect(evidence.handled).toBe(true);
  expect(evidence.trace.map(({ messageIndex, role, callId }) => ({ messageIndex, role, callId }))).toEqual([
    { messageIndex: 0, role: "assistant", callId: "first" },
    { messageIndex: 1, role: "toolResult", callId: "first" },
    { messageIndex: 2, role: "assistant", callId: "retry" },
    { messageIndex: 3, role: "toolResult", callId: "retry" },
  ]);
  expect(reloadRecoveryEvidence(messages, "unrelated-failure", "candidate").handled).toBe(false);
  expect(reloadRecoveryEvidence(messages, "first", "different-source").handled).toBe(false);
  expect(
    reloadRecoveryEvidence(
      [...messages, reloadRequests("still-pending"), reloadResult("still-pending", { reload: { state: "pending" } })],
      "first",
      "candidate",
    ).handled,
  ).toBe(false);
});

test("two reloads planned before failure are not an observed recovery, even if one activates", () => {
  for (const prefix of [[reloadRequests("first", "retry")], [reloadRequests("first"), reloadRequests("retry")]]) {
    expect(
      reloadRecoveryEvidence([...prefix, failure, reloadResult("retry", activated)], "first", "candidate").handled,
    ).toBe(false);
  }
});

test("later retries need their own successful active-source result", () => {
  for (const reply of [
    reloadResult("unrelated", activated),
    reloadResult("retry", activated, true),
    reloadResult("retry", { ...activated, activated: false }),
    reloadResult("retry", { ...activated, reload: { state: "pending" } }),
    reloadResult("retry", { ...activated, activeCommit: "old-source" }),
    reloadResult("retry", "malformed evidence"),
  ]) {
    expect(
      reloadRecoveryEvidence([reloadRequests("first"), failure, reloadRequests("retry"), reply], "first", "candidate")
        .handled,
    ).toBe(false);
  }
});

test("holdout smoke verdicts require policy references and a real unrelated reply, not just numeric fields", () => {
  for (const sample of holdoutCases) {
    const unrelated = sample.id === "unrelated";
    const answer = {
      ...sample.expected,
      source: unrelated ? null : "Synthetic Orion owner, orion-capacity-v1",
      reply: unrelated ? "Welcome to the team—we’re glad you’re here!" : "Assessment from the accepted policy.",
    };
    const verdict = (patch: Record<string, unknown> = {}, revision = "candidate") =>
      holdoutVerdict(sample, { ...answer, ...patch }, revision, "candidate");
    expect(verdict().mechanicalPassed).toBe(true);
    expect(verdict({}, "old-source").mechanicalPassed).toBe(false);
    expect(verdict({ totalSlots: 999 }).mechanicalPassed).toBe(false);
    expect(verdict({ reply: "  " }).mechanicalPassed).toBe(false);
    expect(verdict({ reply: null }).mechanicalPassed).toBe(false);
    expect(verdict({ source: "unrelated-policy-v2" }).mechanicalPassed).toBe(false);
    if (unrelated) {
      for (const reply of [
        "Capacity is unknown.",
        "Welcome to the team; Orion capacity is 37 slots.",
        "Welcome to the team! Let's begin.",
      ]) expect(verdict({ reply }).mechanicalPassed).toBe(false);
      expect(verdict({ source: "orion-capacity-v1" }).mechanicalPassed).toBe(false);
    } else {
      expect(verdict({ source: null }).mechanicalPassed).toBe(false);
      expect(verdict({ source: "orion-capacity-v10" }).mechanicalPassed).toBe(false);
      expect(verdict({ source: "orion-capacity-v1-fake" }).mechanicalPassed).toBe(false);
    }
    expect(holdoutVerdict(sample, undefined, "candidate", "candidate").mechanicalPassed).toBe(false);
  }
});

for (const mode of ["direct", "task-resume", "task-withdraw"] as const)
  test(`agent-operated ${mode} preflight confines edits and preserves lifecycle boundaries`, async () => {
    let root: string | undefined;
    let stdout = "";
    const trial = promisify(execFile)(
      "bun",
      [
        join(import.meta.dirname, mode === "direct" ? "agent-operated-improvement.ts" : "task-improvement.ts"),
        ...(mode === "task-withdraw" ? ["--withdraw"] : []),
      ],
      {
        // Own both the harness and daemon so timeout/failure cannot orphan either.
        detached: true,
        timeout: 330_000,
      },
    );
    trial.child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      root ??= stdout.match(/(?:^|\n)Experiment artifacts: ([^\r\n]+)\r?\n/)?.[1];
    });
    try {
      await trial;
      expect(root?.startsWith(join(tmpdir(), "may-e2e-"))).toBe(true);
      const result = JSON.parse(readFileSync(join(root!, "results.json"), "utf8"));
      expect(result.executions).toBe(0);
      expect(result.checks.failure).toBeUndefined();
      expect(result.checks.preflight).toEqual({
        confinedWrites: true,
        targetRejectsFileDeliverables: true,
        committedNotActive: true,
        rejectedBeforeAdmission: true,
        realReloadRecovered: true,
        modelExecutions: 0,
        compactEvidence: true,
        finalSourceMatchesActive: true,
      });
      if (mode !== "direct") {
        const task = JSON.parse(readFileSync(join(root!, "task-trial.json"), "utf8"));
        expect(task.passed).toBe(true);
        expect(task.restarted).toBe(true);
        expect(task.scopedToolsAfterPreparation).toBe(true);
        expect(task.noopWaitCheck).toBe(true);
        expect(task.nonmatchingFactsIgnored).toBe(true);
        expect(task.controls.providerCalls).toBe(0);
        expect(task.controls.attempts).toBe(mode === "task-resume" ? 2 : 1);
        expect(task.controls.forwardedReloadCalls).toBe(mode === "task-resume" ? 1 : 0);
        expect(task.executions).toHaveLength(task.controls.attempts);
        expect(task.preparations).toHaveLength(task.controls.attempts);
        for (const preparation of task.preparations) {
          expect(typeof preparation.systemPrompt).toBe("string");
          expect(preparation.tools).toEqual(
            expect.arrayContaining(["fixture_read", "fixture_write", "definition_source", "finish"]),
          );
          expect(preparation.tools).not.toContain("write");
          expect(preparation.tools).not.toContain("read");
        }
        expect(task.candidateSource.sourceCommit).not.toBe(task.initialSource.sourceCommit);
        expect(task.candidateSource.activeCommit).toBe(task.initialSource.activeCommit);
        // A wildcard or altered fixture-owned field must be rejected through the
        // same result admission used by managed Tasks, not only by a test parser.
        const first = task.executions[0].structuredResult;
        const condition = first.conditions[0];
        const closedWindow = task.executions[0].messages
          .filter(
            (message: { role: string; toolName?: string }) =>
              message.role === "toolResult" && message.toolName === "definition_source",
          )
          .map((message: { content: { type: string; text: string }[] }) =>
            JSON.parse(message.content.find((part) => part.type === "text")!.text),
          )
          .find((result: { state?: string }) => result.state === "waiting");
        expect(condition).toMatchObject(closedWindow.condition);
        expect(validateActivationCondition(condition)).toBeNull();
        expect(
          validateActivationCondition({ ...condition, requestedAction: "Describe the next authorized step" }),
        ).toBeNull();
        for (const patch of [
          { expected: {} },
          { expected: { field: "ready", equals: false } },
          { type: "wrong" },
          { subject: "id:another-window" },
          { id: "other" },
          { owner: "service:other" },
          { reviewAfterMs: 60_000 },
        ]) {
          expect(
            normalizeTaskHandlerResult(
              { ...first, conditions: [{ ...condition, ...patch }] },
              { type: "done", summary: "fixture", runId: null },
              { validateCondition: validateActivationCondition },
            ).resultRejected,
          ).toBe(true);
        }
        if (mode === "task-withdraw") {
          expect(task.withdrawal.cancellation.kind).toBe("cancelled");
          expect(task.lateTargetedWake).toBeNull();
          expect(task.withdrawnSource).toEqual(task.candidateSource);
        } else {
          expect(task.ownerClosure.closure.kind).toBe("closed");
          expect(task.ownerClosure.closure.acceptedResultAttemptId).toBe(task.finalTask.status.observedAttemptId);
          expect(task.closedTask.status.phase).toBe("converged");
          expect(task.reopenedClosedTask).toEqual(task.closedTask);
          expect(task.closedTask.status.result).toEqual({ accepted: true });
          expect(task.inputs[0].status).toBe("done");
          expect(task.inputs[0].result.result).toEqual({ accepted: true });
          expect(task.finalSource).toEqual({
            sourceCommit: task.candidateSource.sourceCommit,
            activeCommit: task.candidateSource.sourceCommit,
          });
        }
      }
    } finally {
      try {
        if (trial.child.pid) process.kill(-trial.child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      } finally {
        if (root?.startsWith(join(tmpdir(), "may-e2e-"))) rmSync(root, { recursive: true, force: true });
      }
    }
  }, 340_000);
