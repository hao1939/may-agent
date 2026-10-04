import { describe, expect, test } from "bun:test";
import type {
  GuidedPracticeCase,
  LearningUnitContext,
} from "@may-agent/gym/loop";
import type { CliCallEvidence, WorkflowContext } from "@may-agent/sdk";
import type { GymAgentResult } from "./context";
import {
  assessCliPractice,
  guidedPracticePrompt,
  parseCliPracticeEvents,
  observePractice,
  runGuidedPractice,
} from "./guided-practice";

const practice: GuidedPracticeCase = {
  id: "real-review",
  type: "live",
  objective: "Review evidence",
  task: "Review",
  requirements: [{ tool: "codex", terminal: "completed" }],
  max_wait_ms: 1_000,
};
const cliCall: CliCallEvidence = {
  sessionId: "caller",
  toolCallId: "tool-call",
  taskId: "cli-1",
  tool: "codex",
  status: "completed",
  resultPath: "/recorded/result.md",
  structuredResultPath: "/recorded/result.json",
  eventsPath: "/recorded/events.jsonl",
};
function agentResult(calls = [cliCall]): GymAgentResult {
  return {
    sessionId: "caller",
    status: "done",
    lastAssistantText: "Reviewed",
    cliCalls: calls,
    structuredResult: {
      summary: "Reviewed",
      lessons: ["Check primary evidence"],
      decision: "Keep investigating",
      calls: calls.map((call) => ({
        taskId: call.taskId,
        tool: call.tool,
        outcome: call.status,
        ...(call.failureCategory
          ? { failureCategory: call.failureCategory }
          : {}),
        evidence: [call.resultPath, call.structuredResultPath, call.eventsPath],
      })),
    },
  };
}

describe("guided CLI practice", () => {
  test("uses actual call results without looking up a CLI ID as an execution", async () => {
    let calls = 0;
    const result = agentResult();
    const ctx = {
      agents: {
        call: async () => {
          calls++;
          return {
            id: result.sessionId,
            kind: "agent",
            status: result.status,
            summary: "Reviewed",
            output: result.structuredResult,
            cliCalls: result.cliCalls,
          };
        },
      },
      read: {
        execution: () => {
          throw new Error("CLI IDs are not executions");
        },
      },
    } as unknown as WorkflowContext;
    const unit = {
      id: "cli",
      version: 1,
      sourcePaths: [],
      guidedPracticeCases: [practice],
    } as unknown as LearningUnitContext;
    const observed = await runGuidedPractice({
      ctx,
      agent: "may",
      units: [unit],
    });
    expect(observed.passed).toBe(true);
    expect(calls).toBe(1);
    expect(observed.cases[0].attempts[0].events[0].resultPath).toBe(
      cliCall.resultPath,
    );
  });

  test("marks unavailable, absent, and wrong-session evidence invalid, never passes claims", () => {
    for (const cliCalls of [
      undefined,
      [],
      [{ ...cliCall, sessionId: "old-caller" }],
    ]) {
      const observed = observePractice(
        { ...agentResult(), cliCalls },
        practice,
      );
      expect(observed.assessment.passed).toBe(false);
      expect(observed.assessment.invalid?.length).toBeGreaterThan(0);
      expect(observed.events).toEqual([]);
    }
  });

  test("checks claims against runtime outcomes and exact named paths", () => {
    for (const claim of [
      { tool: "claude" },
      { outcome: "failed" },
      { failureCategory: "timeout" },
      { evidence: ["/an-existing-but-unrelated-file"] },
      { evidence: [] },
    ]) {
      const result = agentResult();
      const reflection = result.structuredResult as {
        calls: Record<string, unknown>[];
      };
      Object.assign(reflection.calls[0], claim);
      const observed = observePractice(result, practice);
      expect(observed.assessment.passed).toBe(false);
      expect(observed.assessment.invalid).toBeUndefined();
      expect(observed.events[0].eventType).toBe("cli.task.completed");
    }
  });

  test("one call cannot satisfy two requirements even if evidence and claims repeat", () => {
    const observed = observePractice(agentResult([cliCall, cliCall]), {
      ...practice,
      requirements: [practice.requirements[0], practice.requirements[0]],
    });
    expect(observed.assessment.passed).toBe(false);
    expect(observed.assessment.missing).toContain("codex:completed");
    expect(observed.assessment.missing).toContain("duplicate-claim:cli-1");
    expect(observed.events).toHaveLength(1);
  });

  test("preserves actual timeout and successful retry as distinct evidence", () => {
    const observed = observePractice(
      agentResult([
        {
          ...cliCall,
          taskId: "cli-timeout",
          toolCallId: "first",
          status: "failed",
          failureCategory: "timeout",
        },
        cliCall,
      ]),
      {
        ...practice,
        requirements: [
          { tool: "codex", terminal: "failed", failure_category: "timeout" },
          ...practice.requirements,
        ],
      },
    );
    expect(observed.assessment.passed).toBe(true);
    expect(observed.assessment.taskIds).toEqual(["cli-timeout", "cli-1"]);
  });

  test("unexpected native failure and interrupted caller are not agent behavior failures", () => {
    const failed = observePractice(
      agentResult([
        { ...cliCall, status: "failed", failureCategory: "permission" },
      ]),
      practice,
    );
    expect(failed.assessment.passed).toBe(false);
    expect(failed.assessment.invalid).toContain(
      "unexpected-cli-failure:cli-1:permission",
    );
    for (const status of ["interrupted", "error", "blocked"] as const) {
      const observed = observePractice({ ...agentResult(), status }, practice);
      expect(observed.assessment.passed).toBe(false);
      expect(observed.assessment.invalid).toContain(
        `agent-execution:${status}`,
      );
    }
    expect(
      observePractice(
        { ...agentResult(), structuredResult: undefined },
        practice,
      ).assessment.passed,
    ).toBe(false);
  });

  test("does not repeat live practice to fix missing Host evidence", async () => {
    let calls = 0;
    const result = agentResult();
    const ctx = {
      agents: {
        call: async () => {
          calls++;
          return {
            id: "caller",
            kind: "agent",
            status: "done",
            summary: "Claim only",
            output: result.structuredResult,
          };
        },
      },
    } as unknown as WorkflowContext;
    const unit = {
      id: "cli",
      version: 1,
      sourcePaths: [],
      guidedPracticeCases: [practice],
    } as unknown as LearningUnitContext;
    const observed = await runGuidedPractice({
      ctx,
      agent: "may",
      units: [unit],
    });
    expect(observed.passed).toBe(false);
    expect(calls).toBe(1);
    expect(observed.cases[0].attempts[0].lifecycle.invalid).toContain(
      "cli-evidence-unavailable:requires-updated-host",
    );
  });

  test("requires the complete requested, started, terminal lifecycle", () => {
    const events = parseCliPracticeEvents([
      {
        id: 1,
        event_type: "cli.task.requested",
        task_id: "cli_codex",
        data: JSON.stringify({ taskId: "cli_codex", tool: "codex" }),
      },
      {
        id: 2,
        event_type: "cli.task.started",
        task_id: "cli_codex",
        data: JSON.stringify({ taskId: "cli_codex", tool: "codex" }),
      },
      {
        id: 3,
        event_type: "cli.task.completed",
        task_id: "cli_codex",
        data: JSON.stringify({
          taskId: "cli_codex",
          tool: "codex",
          resultPath: "/state/cli_codex/result.md",
          structuredResultPath: "/state/cli_codex/result.json",
          eventsPath: "/state/cli_codex/events.jsonl",
        }),
      },
    ]);

    expect(
      assessCliPractice(events, [{ tool: "codex", terminal: "completed" }]),
    ).toEqual({
      passed: true,
      missing: [],
      taskIds: ["cli_codex"],
      evidence: [
        "/state/cli_codex/result.md",
        "/state/cli_codex/result.json",
        "/state/cli_codex/events.jsonl",
      ],
    });

    expect(
      assessCliPractice(
        events.filter(({ eventType }) => eventType !== "cli.task.started"),
        [{ tool: "codex", terminal: "completed" }],
      ).missing,
    ).toEqual(["codex:completed:started"]);
  });

  test("distinguishes a timeout from the successful retry", () => {
    const events = parseCliPracticeEvents(
      [
        ["timeout", "requested", {}],
        ["timeout", "started", {}],
        ["timeout", "failed", { failureCategory: "timeout" }],
        ["retry", "requested", {}],
        ["retry", "started", {}],
        ["retry", "completed", { resultPath: "/retry/result.md" }],
      ].map(([taskId, state, extra], index) => ({
        id: index + 1,
        event_type: `cli.task.${state}`,
        task_id: taskId,
        data: JSON.stringify({ taskId, tool: "codex", ...extra }),
      })),
    );

    expect(
      assessCliPractice(events, [
        {
          tool: "codex",
          terminal: "failed",
          failure_category: "timeout",
        },
        { tool: "codex", terminal: "completed" },
      ]).passed,
    ).toBe(true);
  });

  test("tells May to use real workers and inspect durable results", () => {
    const unit: LearningUnitContext = {
      id: "cli-worker-opinions",
      version: 1,
      title: "Use CLI workers for independent advice",
      competencies: ["judgment.seek-independent-opinion"],
      lessonPath: "/learning/lesson.md",
      practicePath: "/learning/practice.md",
      guidedPracticePath: "/learning/guided-practice.json",
      guidedPracticeCases: [],
      evidencePath: "/learning/evidence.jsonl",
      sourcePaths: ["/design/native-coding-workers.md"],
      releaseBenchmark: "release",
      releaseScenarios: ["held-back"],
    };
    const prompt = guidedPracticePrompt(
      unit,
      {
        id: "dual-review",
        type: "live",
        objective: "Get two independent reviews.",
        task: "Ask both workers to review the same bounded evidence.",
        requirements: [
          { tool: "codex", terminal: "completed" },
          { tool: "claude", terminal: "completed" },
        ],
        max_wait_ms: 60_000,
      },
      null,
    );

    expect(prompt).toContain("guided practice, not a written knowledge test");
    expect(prompt).toContain("Use run_cli_agent");
    expect(prompt).toContain("result.md, result.json, and events.jsonl");
    expect(prompt).toContain("fresh native context for an independent opinion");
    expect(prompt).not.toContain("Codex is better");
  });
});
