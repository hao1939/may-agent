import { describe, expect, test } from "bun:test";
import type { LearningUnitContext } from "@may-agent/gym/loop";
import {
  assessCliPractice,
  guidedPracticePrompt,
  parseCliPracticeEvents,
} from "./guided-practice";

describe("guided CLI practice", () => {
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
