import { describe, expect, it } from "vitest";
import { classifyVerdict, transcriptIssues } from "../../evaluator/workflows/evaluator-aftermath.ts";

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

  it("flags metric health claims without live DB evidence", () => {
    const verdict = classifyVerdict(
      { status: "done", opCount: 0 },
      "DONE\n\nAll P1 metrics are in range. project.md says the system is healthy.",
    );

    expect(verdict.verdict).toBe("needs_improvement");
    expect(verdict.issues).toContain("metric health claim without live query");
  });
});
