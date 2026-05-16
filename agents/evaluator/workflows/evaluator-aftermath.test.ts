import { describe, expect, it } from "bun:test";
import {
  HEURISTIC_VERSION,
  artifactVerdict,
  buildReviewTask,
  buildSessionEvalTrailRows,
  classifyEvaluationLane,
  classifyVerdict,
  evaluationHeuristicVersion,
  falseGoodEventPayload,
  sessionEvalTrailPath,
  shouldSkipAftermathAmplification,
  shouldRefreshEvaluation,
  transcriptOutputSignals,
  transcriptIssues,
} from "./evaluator-aftermath.ts";

describe("evaluator aftermath transcript checks", () => {
  it("flags schema guessing and runtime handoff commit friction", () => {
    const transcript = [
      "toolResult: no such column: current_value",
      "finish() blocked [uncommitted changes]",
      "M may/last-session.md",
      "git add may/last-session.md && git commit -m",
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([
      "finish blocked by uncommitted changes",
      "schema/query error in transcript",
      "committed runtime handoff files",
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

  it("skips terminal zero-op aftermath instead of spawning evaluator review", () => {
    expect(shouldSkipAftermathAmplification({ status: "error", opCount: 0 }, "")).toEqual({
      skip: true,
      reason: "terminal_zero_op_session",
    });
    expect(shouldSkipAftermathAmplification({ status: "done", opCount: 0 }, "")).toEqual({
      skip: false,
      reason: "",
    });
  });

  it("skips one-op provider auth failures from assistant error transcript lines", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [],
        provider: "github-copilot",
        model: "gpt-5.4",
        stopReason: "error",
        errorMessage:
          "401 litellm.AuthenticationError: AuthenticationError: Github_copilotException - IDE token expired: unauthorized: token expired\n. Received Model Group=gpt-5.4",
      }),
    ].join("\n");

    expect(shouldSkipAftermathAmplification({ status: "error", opCount: 1 }, transcript)).toEqual({
      skip: true,
      reason: "one_op_provider_auth_failure",
    });
    expect(shouldSkipAftermathAmplification({ status: "error", opCount: 2 }, transcript)).toEqual({
      skip: false,
      reason: "",
    });
  });

  it("does not skip one-op non-auth failures", () => {
    const transcript = JSON.stringify({
      role: "assistant",
      content: [{ type: "text", text: "Task failed because a required file was missing." }],
      stopReason: "error",
    });

    expect(shouldSkipAftermathAmplification({ status: "error", opCount: 1 }, transcript)).toEqual({
      skip: false,
      reason: "",
    });
  });

  it("does not downgrade finish-only self-repaired dirty-worktree sessions", () => {
    const transcript = [
      "finish() blocked [uncommitted changes]",
      "git status --short",
      " M projects/example/outputs/result.md",
      "git add -f projects/example/outputs/result.md && git commit -m \"dev: add result\"",
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
            arguments: { path: "projects/ruflo-learning-loop/outputs/STATUS.md", oldText: "a", newText: "b" },
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
        content: "Do not edit projects/ruflo-learning-loop/outputs/NEXT.md.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "b1",
            name: "bash",
            arguments: { command: "git status --short projects/ruflo-learning-loop/outputs/NEXT.md" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: " M projects/ruflo-learning-loop/outputs/NEXT.md\n" }],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toContain(
      "constraint violation: edited forbidden path(s): projects/ruflo-learning-loop/outputs/NEXT.md",
    );
  });

  it("flags creative heartbeat shell writes to agent tooling", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "You are **scout** in creative heartbeat mode. Produce a shared KE entry.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "b1",
            name: "bash",
            arguments: {
              command: [
                "cat << 'EOF' > agents/scout/tools/next-ke-id.sh",
                "#!/bin/bash",
                "EOF",
                "bash agents/scout/tools/next-ke-id.sh",
              ].join("\n"),
            },
          },
        ],
      }),
    ].join("\n");

    const verdict = classifyVerdict({ status: "done", opCount: 8 }, transcript);

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.issues).toContain("unexpected shell write to agent tool path(s): scout/tools/next-ke-id.sh");
  });

  it("ignores path-like prose in assistant-created artifacts when extracting forbidden paths", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: [
          "Task constraints: You CANNOT edit the project file or journal.",
          "Write recommendations to projects/daily-alert-review/outputs/2026-05-09-recommendations.md.",
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
              path: "projects/daily-alert-review/outputs/2026-05-09-recommendations.md",
              content: "- metric config owner\n- evaluator/scout owner\n",
            },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("does not treat required project outputs as forbidden when only project and journal edits are prohibited", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: [
          "(a) Concrete output: outputs/first-e2e-run-results.md with real test execution output from devbox.",
          "Put all output files in: /app/projects/aks-rp-e2e/outputs/",
          "You CANNOT edit the project file or journal.",
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
              path: "/app/projects/aks-rp-e2e/outputs/first-e2e-run-results.md",
              content: "real run output",
            },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("ignores slash tokens from review-only task prose when extracting forbidden paths", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "[REVIEW ONLY — no file edits expected.] Routing reason: constraint violation: edited forbidden path(s): finish/uncommitted.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "w1",
            name: "write",
            arguments: {
              path: "projects/finish-blocked-hygiene-reduction/outputs/sample.md",
              content: "sample",
            },
          },
        ],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("ignores runtime last-session.md churn in forbidden-path checks", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "Task constraints: Do not edit scout/last-session.md or projects/ruflo-learning-loop/outputs/NEXT.md.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "b1",
            name: "bash",
            arguments: { command: "git status --short" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: " M scout/last-session.md\n" }],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toEqual([]);
  });

  it("still flags non-runtime forbidden edits when last-session.md is also forbidden", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "Task constraints: Do not edit scout/last-session.md or projects/ruflo-learning-loop/outputs/NEXT.md.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "b1",
            name: "bash",
            arguments: { command: "git status --short" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: " M scout/last-session.md\n M projects/ruflo-learning-loop/outputs/NEXT.md\n" }],
      }),
    ].join("\n");

    expect(transcriptIssues(transcript)).toContain(
      "constraint violation: edited forbidden path(s): projects/ruflo-learning-loop/outputs/NEXT.md",
    );
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

  it("refreshes stale heuristic evaluations regardless of verdict", () => {
    const heuristic = { verdict: "needs_improvement", issues: ["schema/query error in transcript"] };

    expect(evaluationHeuristicVersion({ overall: JSON.stringify({ heuristicVersion: HEURISTIC_VERSION }) })).toBe(HEURISTIC_VERSION);
    expect(shouldRefreshEvaluation({ verdict: "good", overall: "{}" }, heuristic)).toBe(true);
    expect(shouldRefreshEvaluation({ verdict: "needs_improvement", overall: "{}" }, heuristic)).toBe(true);
    expect(shouldRefreshEvaluation({ verdict: "good", overall: JSON.stringify({ heuristicVersion: HEURISTIC_VERSION }) }, heuristic)).toBe(false);
    expect(shouldRefreshEvaluation({ verdict: "needs_improvement", overall: JSON.stringify({ heuristicVersion: HEURISTIC_VERSION }) }, heuristic)).toBe(false);
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
            arguments: { path: "projects/example/outputs/result.md", content: "value" },
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

  it("builds session.eval.jsonl summary and line rows", () => {
    const transcript = [
      JSON.stringify({ role: "user", content: "Fix the UI" }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "toolCall", id: "b1", name: "bash", arguments: { command: "cat missing" } },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        isError: true,
        content: [{ type: "text", text: "cat: missing: No such file or directory" }],
      }),
    ].join("\n");

    const rows = buildSessionEvalTrailRows({
      sessionId: "s_1",
      session: { agent: "dev", status: "done", opCount: 3 },
      transcript,
      transcriptSource: ".state/sessions/history/s_1/session.jsonl",
      heuristic: { verdict: "needs_improvement", quality: 0.55, efficiency: 0.8, issues: ["tool_output_error"] },
      route: { lane: "needs_triage", reason: "tool output failed", signals: [] },
      createdAt: 123,
    });

    expect(rows[0]).toMatchObject({
      type: "summary",
      target: "session",
      sessionId: "s_1",
      verdict: "needs_improvement",
      lane: "needs_triage",
      transcriptSource: ".state/sessions/history/s_1/session.jsonl",
      targetBreakdown: {
        request: "check",
        execution: "ok",
        result: "check",
        verification: "unknown",
      },
      repairDecision: {
        action: "repair_execution",
      },
    });
    expect(rows.find((row) => row.type === "line" && row.line === 1)).toMatchObject({
      rawRole: "user",
      target: "request",
      purpose: "work_request_or_context",
    });
    expect(rows.find((row) => row.type === "line" && row.line === 2)).toMatchObject({
      rawRole: "assistant",
      target: "execution",
      score: "ok",
      tools: ["bash"],
      toolTargets: ["execution"],
    });
    expect(rows.find((row) => row.type === "line" && row.line === 3)).toMatchObject({
      rawRole: "toolResult",
      target: "result",
      score: "check",
      issues: ["tool_output_failure_or_mismatch"],
      toolCallId: "b1",
    });
  });

  it("classifies verification tool calls and repair decisions", () => {
    const transcript = [
      JSON.stringify({ role: "user", content: "Update the platform UI and verify it in the browser." }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "toolCall", id: "b1", name: "bash", arguments: { command: "bun run check" } },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: "ok" }],
      }),
    ].join("\n");

    const rows = buildSessionEvalTrailRows({
      sessionId: "s_2",
      session: { agent: "dev", status: "done", opCount: 3, projectId: "platform" },
      transcript,
      transcriptSource: ".state/sessions/history/s_2/session.jsonl",
      heuristic: { verdict: "good", quality: 0.85, efficiency: 0.8, issues: [] },
      route: { lane: "success_candidate", reason: "material verified output", signals: ["file write/edit", "verification command"] },
      createdAt: 123,
    });

    expect(rows.find((row) => row.type === "line" && row.line === 2)).toMatchObject({
      target: "verification",
      toolTargets: ["verification"],
    });
    expect(rows.find((row) => row.type === "line" && row.line === 3)).toMatchObject({
      target: "verification",
      purpose: "verification_output",
    });
    expect(rows[0]).toMatchObject({
      targetBreakdown: { verification: "ok" },
      repairDecision: { action: "extract_evolution_candidate" },
    });
  });

  it("does not create owner findings for routine verification-only sessions", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "You are working on iteration 6 of a persistent task. Verify the platform state using the existing tests and report whether there is any concrete follow-up.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "toolCall", id: "b1", name: "bash", arguments: { command: "bun test" } },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "b1",
        toolName: "bash",
        content: [{ type: "text", text: "893 pass 0 fail" }],
      }),
    ].join("\n");

    const rows = buildSessionEvalTrailRows({
      sessionId: "s_routine",
      session: { agent: "tech-lead", status: "done", opCount: 0, projectId: "platform" },
      transcript,
      transcriptSource: ".state/sessions/history/s_routine/session.jsonl",
      heuristic: { verdict: "good", quality: 0.85, efficiency: 0.8, issues: [] },
      route: { lane: "routine_ok", reason: "good session; no material output signal", signals: ["verification command", "project-linked session", "workflow-linked session"] },
      createdAt: 123,
    });

    expect(rows[0]).toMatchObject({
      repairDecision: {
        action: "none",
        ownerFindings: [],
        notificationDecision: { notifyNow: false },
      },
    });
    expect(JSON.stringify(rows[0])).not.toContain("weak-verification");
  });

  it("routes blocked-loop findings to the concrete owner without choosing the fix", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content:
          "Project iteration 45. Current State: blocked; standalone RP dead for 12 consecutive checks. Resume when curl returns non-zero. Next Action: retry Scenario_PAFThrottling.",
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "s1",
            name: "ssh_exec",
            arguments: { host: "devbox", command: "curl -sk -o /dev/null -w 'HTTP_CODE:%{http_code}' https://localhost:8443 --max-time 5" },
          },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "s1",
        toolName: "ssh_exec",
        content: [{ type: "text", text: "HTTP_CODE:000" }],
      }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "toolCall", id: "f1", name: "finish", arguments: { status: "blocked", summary: "Still dead, 13th consecutive check." } },
        ],
      }),
      JSON.stringify({
        role: "toolResult",
        toolCallId: "f1",
        toolName: "finish",
        content: [{ type: "text", text: "BLOCKED: Standalone RP still dead. No e2e tests can run until a new standalone build is deployed." }],
      }),
    ].join("\n");

    const rows = buildSessionEvalTrailRows({
      sessionId: "s_blocked",
      session: { agent: "tech-lead", status: "blocked", opCount: 5, projectId: "aks-rp-e2e" },
      transcript,
      transcriptSource: ".state/sessions/history/s_blocked/session.jsonl",
      heuristic: { verdict: "needs_improvement", quality: 0.45, efficiency: 0.4, issues: ["repeated blocker check"] },
      route: { lane: "needs_triage", reason: "blocked project repeated liveness check", signals: ["project-linked session"] },
      createdAt: 123,
    });

    expect(rows[0]).toMatchObject({
      repairDecision: {
        ownerChoosesAction: true,
        ownerFindings: expect.arrayContaining([
          expect.objectContaining({
            id: "stale-blocker-loop",
            scope: "project_context",
            owner: "agent:tech-lead",
            severity: "high",
          }),
        ]),
        notificationDecision: {
          notifyNow: true,
          immediateFindingIds: expect.arrayContaining(["stale-blocker-loop"]),
        },
      },
    });
    expect(JSON.stringify(rows[0])).toContain("Convert repeated liveness polling into a cheap metric/watch");
    expect(JSON.stringify(rows[0])).not.toContain("nextWorkRequest");
  });

  it("places eval trail beside the raw session log", () => {
    expect(sessionEvalTrailPath("/app/.state/sessions/history/s_1/session.jsonl")).toBe(
      "/app/.state/sessions/history/s_1/session.eval.jsonl",
    );
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
      newVerdict: "acceptable",
      heuristicVerdict: "good",
      reviewedVerdict: "acceptable",
      reviewSessionId: "s_review",
      artifactPath: "agents/evaluator/workspace/aftermath/s_1.md",
    });
  });
});
