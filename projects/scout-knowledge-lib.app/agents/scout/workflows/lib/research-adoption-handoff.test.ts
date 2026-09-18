import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  qualifiedResearchHandoff,
  researchHandoffKey,
} from "./research-adoption-handoff";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture(revision = "v1") {
  const root = mkdtempSync(join(tmpdir(), "scout-research-handoff-"));
  roots.push(root);
  const artifact = join(root, "finding.md");
  const bytes = Buffer.from("source-grounded finding\n");
  writeFileSync(artifact, bytes);
  const recommendation = {
    sourceUrl: "https://example.test/paper",
    sourceRevision: revision,
    artifact,
    claim: "A bounded technique may reduce work.",
    limits: "Author-reported result; not locally reproduced.",
    possibleApplication: "Compare with the current May task mapper.",
    relatedWork: ["may/research-adoption"],
  };
  return {
    artifact,
    bytes,
    result: { researchRecommendation: recommendation },
    recommendation,
  };
}

describe("qualified Scout research handoff", () => {
  test("normalizes one published recommendation and code binds its bytes", () => {
    const first = fixture();
    const admitted = qualifiedResearchHandoff(first.result, [first.artifact]);
    expect(admitted).toEqual({
      ...first.recommendation,
      artifactHash: createHash("sha256").update(first.bytes).digest("hex"),
    });
    expect(researchHandoffKey(admitted!)).toBe(
      researchHandoffKey(
        qualifiedResearchHandoff(first.result, [first.artifact])!,
      ),
    );
    expect(qualifiedResearchHandoff(undefined, [first.artifact])).toBeNull();
  });

  test("separates source revisions and rejects an unpreserved claim", () => {
    const first = fixture("v1");
    const second = fixture("v2");
    expect(
      researchHandoffKey(
        qualifiedResearchHandoff(first.result, [first.artifact])!,
      ),
    ).not.toBe(
      researchHandoffKey(
        qualifiedResearchHandoff(second.result, [second.artifact])!,
      ),
    );
    expect(() => qualifiedResearchHandoff(first.result, [])).toThrow(
      "published output",
    );
    expect(() =>
      qualifiedResearchHandoff(
        { researchRecommendation: { sourceUrl: "https://example.test" } },
        [first.artifact],
      ),
    ).toThrow("requires sourceRevision");
  });
});
