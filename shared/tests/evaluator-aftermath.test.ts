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

  it("does not downgrade finish-only self-repaired dirty-worktree sessions", () => {
    const transcript = [
      "finish() blocked [uncommitted changes]",
      "git status --short",
      " M shared/projects/example/outputs/result.md",
      "git add -f shared/projects/example/outputs/result.md && git commit -m \"dev: add result\"",
      "[main abc123] dev: add result",
    ].join("\n");

    const verdict = classifyVerdict({ status: "done", opCount: 20 }, transcript);
    const route = classifyEvaluationLane({ status: "done", opCount: 20 }, transcript, verdict);

    expect(verdict.verdict).toBe("good");
    expect(verdict.quality).toBe(0.85);
    expect(verdict.issues).toEqual(["finish blocked by uncommitted changes"]);
    expect(route.lane).toBe("success_candidate");
    expect(route.reason).toContain("self-repaired");
  });

  it("does not downgrade finish-only sessions that cleanly exit partial instead of committing ambient dirt", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "f1",
            name: "finish",
            arguments: { status: "success", summary: "done" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "f1",
        toolName: "finish",
        isError: true,
        content: [{ type: "text", text: "finish() blocked [uncommitted changes]" }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "f2",
            name: "finish",
            arguments: { status: "partial", summary: "ambient dirt remains" },
          },
        ],
      }),
    ].join("\n");

    const verdict = classifyVerdict({ status: "done", opCount: 20 }, transcript);
    const route = classifyEvaluationLane({ status: "done", opCount: 20 }, transcript, verdict);

    expect(verdict.verdict).toBe("good");
    expect(verdict.issues).toEqual(["finish blocked by uncommitted changes"]);
    expect(route.lane).toBe("success_candidate");
  });

  it("does not downgrade finish-only sessions that retry finish(success) after committing", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [{ type: "toolCall", id: "f1", name: "finish", arguments: { status: "success", summary: "done" } }],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "f1",
        toolName: "finish",
        isError: true,
        content: [{ type: "text", text: "finish() blocked [uncommitted changes]" }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "toolCall", id: "b1", name: "bash", arguments: { command: "cd /app/agents && git add file.md && git commit -m fix" } },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: "[main abc123] fix\n 1 file changed" }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [{ type: "toolCall", id: "f2", name: "finish", arguments: { status: "success", summary: "done" } }],
      }),
    ].join("\n");

    const verdict = classifyVerdict({ status: "done", opCount: 12 }, transcript);
    const route = classifyEvaluationLane({ status: "done", opCount: 12 }, transcript, verdict);

    expect(verdict.verdict).toBe("good");
    expect(verdict.issues).toEqual(["finish blocked by uncommitted changes"]);
    expect(route.lane).toBe("success_candidate");
  });

  it("still downgrades unresolved finish-only dirty-worktree sessions", () => {
    const verdict = classifyVerdict(
      { status: "interrupted", opCount: 20 },
      "finish() blocked [uncommitted changes]\ngit status --short",
    );

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.quality).toBe(0.2);
    expect(verdict.issues).toContain("finish blocked by uncommitted changes");
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

  it("ignores quoted session-transcript errors when bash inspects another session jsonl", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "bash-1",
            name: "bash",
            arguments: { command: "nl -ba .state/sessions/history/s_target/session.jsonl | sed -n '1,80p'" },
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
            text: "10\t{\"role\":\"toolResult\",\"toolName\":\"finish\",\"content\":[{\"type\":\"text\",\"text\":\"finish() blocked [uncommitted changes]\"}],\"isError\":true}\n13\t{\"role\":\"toolResult\",\"toolName\":\"query_db\",\"content\":[{\"type\":\"text\",\"text\":\"{\\\"error\\\":\\\"no such column: summary\\\"}\"}],\"isError\":true}",
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
            arguments: { path: "agents/dev/workspace/investigations/example.md", content: "review" },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("ignores assistant prose quoting schema errors when no query_db toolResult failed", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q1",
            name: "query_db",
            arguments: { sql: "SELECT sessionId, agent FROM sessions LIMIT 1" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q1",
        toolName: "query_db",
        isError: false,
        content: [{ type: "text", text: '{"rowCount":1,"rows":[{"sessionId":"s1","agent":"arc"}]}' }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "This session quoted no such column: summary while analyzing another session's transcript, but made no failing query_db call of its own.",
          },
          {
            type: "toolCall",
            id: "w1",
            name: "write",
            arguments: { path: "agents/shared/knowledge/example.md", content: "review" },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("ignores successful query_db rows that quote historical schema errors", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q1",
            name: "query_db",
            arguments: { sql: "SELECT event_type, data FROM events ORDER BY timestamp DESC LIMIT 1" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q1",
        toolName: "query_db",
        isError: false,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              rowCount: 1,
              rows: [
                {
                  event_type: "message.created",
                  data: "Aftermath says prior target queried no such column: summary and no such table: messages",
                },
              ],
            }),
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("still flags failed query_db schema errors", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q1",
            name: "query_db",
            arguments: { sql: "SELECT summary FROM sessions" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q1",
        toolName: "query_db",
        isError: true,
        content: [{ type: "text", text: '{"error":"no such column: summary"}' }],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual(["schema/query error in transcript"]);
  });

  it("does not flag schema/query error when a later query_db call recovers", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q1",
            name: "query_db",
            arguments: { sql: "SELECT summary FROM sessions" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q1",
        toolName: "query_db",
        isError: false,
        content: [{ type: "text", text: '{"error":"no such column: summary","schema":{"sessions":["sessionId","agent"]}}' }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q2",
            name: "query_db",
            arguments: { sql: "SELECT sessionId, agent FROM sessions" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q2",
        toolName: "query_db",
        isError: false,
        content: [{ type: "text", text: '{"rowCount":1,"rows":[{"sessionId":"s1","agent":"arc"}]}' }],
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

  it("flags explicit forbidden-file edits as constraint violations", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "Task constraints: You CANNOT edit the project file or journal. Forbidden: STATUS.md and NEXT.md.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "e1",
            name: "edit",
            arguments: { path: "agents/shared/projects/ruflo-learning-loop/outputs/STATUS.md", oldText: "a", newText: "b" },
          },
        ],
      }),
    ].join("\n");

    const verdict = classifyVerdict({ status: "done", opCount: 0 }, transcript);

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.issues).toContain("constraint violation: edited forbidden path(s): STATUS.md");
    expect(classifyEvaluationLane({ status: "done", opCount: 0 }, transcript, verdict).lane).toBe("needs_triage");
  });

  it("flags forbidden edits observed in git status output", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "Do not edit agents/shared/projects/ruflo-learning-loop/outputs/NEXT.md.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "b1",
            name: "bash",
            arguments: { command: "git status --short agents/shared/projects/ruflo-learning-loop/outputs/NEXT.md" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: " M agents/shared/projects/ruflo-learning-loop/outputs/NEXT.md\n" }],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toContain(
      "constraint violation: edited forbidden path(s): agents/shared/projects/ruflo-learning-loop/outputs/NEXT.md",
    );
  });

  it("ignores path-like prose in assistant-created artifacts when extracting forbidden paths", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: [
          "Task constraints: You CANNOT edit the project file or journal.",
          "Write recommendations to agents/shared/projects/daily-alert-review/outputs/2026-05-09-recommendations.md.",
        ].join("\n"),
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "w1",
            name: "write",
            arguments: {
              path: "agents/shared/projects/daily-alert-review/outputs/2026-05-09-recommendations.md",
              content: "- metric config owner\n- evaluator/scout owner\n",
            },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
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

  it("routes recovered schema/query sessions with material output as success candidates", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q1",
            name: "query_db",
            arguments: { sql: "SELECT summary FROM sessions" },
          },
          {
            type: "toolCall",
            id: "w1",
            name: "write",
            arguments: { path: "agents/shared/knowledge/recovery-note.md", content: "ok" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q1",
        toolName: "query_db",
        isError: false,
        content: [{ type: "text", text: '{"error":"no such column: summary"}' }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "q2",
            name: "query_db",
            arguments: { sql: "SELECT sessionId FROM sessions" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "q2",
        toolName: "query_db",
        isError: false,
        content: [{ type: "text", text: '{"rowCount":1,"rows":[{"sessionId":"s1"}]}' }],
      }),
    ].join("\n");

    const heuristic = classifyVerdict({ status: "done", opCount: 10 }, transcript);
    const route = classifyEvaluationLane({ status: "done", opCount: 10 }, transcript, heuristic);

    expect(heuristic.verdict).toBe("good");
    expect(heuristic.issues).toEqual([]);
    expect(route.lane).toBe("success_candidate");
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
