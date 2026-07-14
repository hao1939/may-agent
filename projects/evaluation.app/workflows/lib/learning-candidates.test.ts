import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendLearningCandidate, appendLearningDecision } from "./learning-candidates.js";

let root = "";
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

describe("learning candidate artifact", () => {
  it("keeps proposal and owner decisions append-only and idempotent", () => {
    root = mkdtempSync(join(tmpdir(), "learning-candidates-"));
    const path = join(root, "candidates.jsonl");
    const first = appendLearningCandidate(path, {
      sessionId: "s_1",
      reviewSessionId: "s_review",
      artifactPath: "/evidence/review.md",
      summary: "Reusable verification method",
    });
    const duplicate = appendLearningCandidate(path, {
      sessionId: "s_1",
      artifactPath: "/evidence/review.md",
    });
    appendLearningDecision(path, first.candidateId, "validated", {
      owner: "evaluator",
      summary: "Repeated in a second session",
      evidence: { sessions: ["s_1", "s_2"] },
    });

    const rows = readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(first.created).toBe(true);
    expect(duplicate).toEqual({ candidateId: first.candidateId, created: false });
    expect(rows.map((row) => row.status)).toEqual(["proposed", "validated"]);
    expect(rows[1].evidence.sessions).toEqual(["s_1", "s_2"]);
  });
});
