import { describe, expect, it } from "vitest";
import {
  HEURISTIC_VERSION,
  artifactVerdict,
  buildReviewTask,
  classifyEvaluationLane,
  classifyVerdict,
  evaluationHeuristicVersion,
  falseGoodEventPayload,
  shouldRefreshEvaluation,
  transcriptOutputSignals,
  transcriptIssues,
} from "../../evaluator/workflows/evaluator-aftermath.ts";

describe("evaluator aftermath transcript checks", () => {
  it("flags schema guessing and runtime-file commit friction", () => {
    const transcript = [
      "toolResult: no such column: current_value",
      "finish() blocked [uncommitted changes]",
      "M may/last-session.md",
      "M shared/gate-outcomes.log",
      "git add may/ shared/ && git commit -m",
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([
      "finish blocked by uncommitted changes",
      "schema/query error in transcript",
      "broad may/shared commit during session",
      "committed generated runtime files",
    ]);
  });

  it("downgrades a done session when transcript contains hidden friction", () => {
    const verdict = classifyVerdict(
      { status: "done", opCount: 0 },
      "finish() blocked [uncommitted changes]\nno such column: metric_name",
    );

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.quality).toBe(0.55);
    expect(verdict.issues).toContain("schema/query error in transcript");
  });

  it("ignores target transcript failures quoted inside evaluator review sessions", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "bash-1",
            name: "bash",
            arguments: { command: "sed -n '1,200p' .state/sessions/history/s_target/session.jsonl" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "bash-1",
        toolName: "bash",
        content: [
          {
            type: "text",
            text: "target said no such column: summary and later finish() blocked [uncommitted changes]",
          },
        ],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "write-1",
            name: "write",
            arguments: { path: "agents/evaluator/workspace/aftermath/s_target.md", content: "review" },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("detects anti-shallow gate failures from direct session tool calls", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "toolCall", id: "q1", name: "query_db", arguments: { sql: "SELECT 1" } },
          { type: "toolCall", id: "b1", name: "bash", arguments: { command: "ls agents/scout/workspace" } },
        ],
      }),
    ].join("\n");

    const verdict = classifyVerdict(
      { status: "done", opCount: 0, task: "⚠️ ANTI-SHALLOW GATE: Your session made only 7 tool calls (minimum: 10)." },
      transcript,
    );

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.issues).toContain("anti-shallow gate not satisfied: 2/10 tool calls");
  });

  it("flags metric health claims without live evidence", () => {
    const verdict = classifyVerdict(
      { status: "done", opCount: 0 },
      "DONE\n\nAll P1 metrics are in range. project.md says the system is healthy.",
    );

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.issues).toContain("metric health claim without live evidence");
  });

  it("accepts workflow-collected live signals as metric evidence", () => {
    const verdict = classifyVerdict(
      { status: "done", opCount: 0 },
      [
        "## Live Runtime Signals (workflow-collected)",
        "Status: available",
        "Counts: active P0/P1 metrics=2; open P0/P1 alerts=0; open lower-priority alerts=0; active projects=1",
        "DONE",
        "All P1 metrics are in range based on workflow-collected live signals.",
      ].join("\n"),
    );

    expect(verdict.issues).not.toContain("metric health claim without live evidence");
  });

  it("flags unavailable workflow-collected signals as reliability issue", () => {
    const verdict = classifyVerdict(
      { status: "done", opCount: 0 },
      [
        "## Live Runtime Signals (workflow-collected)",
        "Status: unavailable",
        "Error: no such table: metrics",
      ].join("\n"),
    );

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.issues).toContain("workflow live signal injection unavailable");
  });

  it("refreshes stale good heuristic evaluations", () => {
    const heuristic = { verdict: "needs_improvement", issues: ["schema/query error in transcript"] };

    expect(evaluationHeuristicVersion({ overall: JSON.stringify({ heuristicVersion: HEURISTIC_VERSION }) })).toBe(HEURISTIC_VERSION);
    expect(shouldRefreshEvaluation({ verdict: "good", overall: "{}" }, heuristic)).toBe(true);
    expect(shouldRefreshEvaluation({ verdict: "good", overall: JSON.stringify({ heuristicVersion: HEURISTIC_VERSION }) }, heuristic)).toBe(false);
    expect(shouldRefreshEvaluation({ verdict: "needs_improvement", overall: "{}" }, heuristic)).toBe(false);
  });

  it("routes failed or issue-bearing sessions to triage", () => {
    const heuristic = classifyVerdict(
      { status: "done", opCount: 0 },
      "finish() blocked [uncommitted changes]\nno such column: metric_name",
    );

    const route = classifyEvaluationLane({ status: "done", opCount: 0 }, "", heuristic);

    expect(route.lane).toBe("needs_triage");
    expect(route.reason).toContain("schema/query error in transcript");
  });

  it("routes good sessions with material output as success candidates", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "w1",
            name: "write",
            arguments: { path: "agents/shared/projects/example/outputs/result.md", content: "value" },
          },
        ],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "b1",
            name: "bash",
            arguments: { command: "bun test agents/shared/tests/example.test.ts" },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptOutputSignals({ status: "done", projectId: "example" }, transcript)).toEqual([
      "file write/edit",
      "project artifact",
      "verification command",
      "project-linked session",
    ]);
    expect(classifyEvaluationLane({ status: "done", opCount: 10, projectId: "example" }, transcript).lane).toBe("success_candidate");
  });

  it("routes good sessions without material output as routine ok", () => {
    const transcript = JSON.stringify({
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "q1",
          name: "query_db",
          arguments: { sql: "SELECT COUNT(*) FROM metrics" },
        },
      ],
    });

    expect(classifyEvaluationLane({ status: "done", opCount: 10 }, transcript).lane).toBe("routine_ok");
  });

  it("review prompt treats heuristics as routing signals and asks for output quality", () => {
    const task = buildReviewTask({
      sessionId: "s_1",
      session: { sessionId: "s_1", agent: "dev", status: "done" },
      transcriptPath: ".state/sessions/history/s_1/session.jsonl",
      artifactPath: "agents/evaluator/workspace/aftermath/s_1.md",
      workflowCollectedFacts: "## Workflow-Collected Session Facts\n- Heuristic verdict: good",
      route: {
        lane: "success_candidate",
        reason: "good session with material output: file write/edit",
        signals: ["file write/edit"],
      },
    });

    expect(task).toContain("routing signals, not the final judgment");
    expect(task).toContain("did this session produce real value");
    expect(task).toContain("inspect the actual artifacts, diffs, or relevant files");
    expect(task).toContain("Output Quality");
    expect(task).toContain("Learning Created: yes|no");
  });

  it("normalizes artifact verdicts for reviewed false-good sessions", () => {
    expect(artifactVerdict("## Verdict\nneeds_triage\n")).toBe("needs_improvement");
    expect(artifactVerdict("## Verdict\nNeeds Improvement\n")).toBe("needs_improvement");
    expect(artifactVerdict("## Verdict\ngood\n")).toBe("good");
    expect(artifactVerdict("## Evidence\nnone\n")).toBeNull();
  });

  it("emits false-good events with generic and review-specific verdict fields", () => {
    expect(falseGoodEventPayload({
      sessionId: "s_1",
      agent: "may",
      heuristicVerdict: "good",
      reviewedVerdict: "acceptable",
      reviewSessionId: "s_review",
      artifactPath: "agents/evaluator/workspace/aftermath/s_1.md",
    })).toMatchObject({
      source: "evaluator-aftermath",
      owner: "evaluator",
      evaluationId: "s_1",
      sessionId: "s_1",
      agent: "may",
      originalVerdict: "good",
      newVerdict: "needs_improvement",
      heuristicVerdict: "good",
      reviewedVerdict: "acceptable",
      reviewSessionId: "s_review",
      artifactPath: "agents/evaluator/workspace/aftermath/s_1.md",
    });
  });
});
