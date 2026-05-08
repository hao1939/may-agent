import { describe, expect, it } from "vitest";
import {
  HEURISTIC_VERSION,
  classifyVerdict,
  evaluationHeuristicVersion,
  shouldRefreshEvaluation,
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
});
