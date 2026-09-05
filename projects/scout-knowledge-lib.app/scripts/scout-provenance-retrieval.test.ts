import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "bun:test";
import { buildProvenanceReconstruction } from "./scout-provenance-reconstruction";
import {
  inspectProvenanceRetrieval,
  provenanceRetrievalPosthocV3Commit,
  provenanceRetrievalPosthocV3Sha256,
  provenanceRetrievalEntries,
  provenanceRetrievalPromptCommit,
  provenanceRetrievalPromptSha256,
  scoreProvenanceRetrieval,
  validateProvenanceRetrievalPrompts,
} from "./scout-provenance-retrieval";

const fixturesDir = resolve(import.meta.dir, "fixtures");
const promptPath = resolve(
  fixturesDir,
  "scout-provenance-retrieval-prompts-cycle415.json",
);
const replacementPath = resolve(
  fixturesDir,
  "scout-provenance-replacement-cycle413.json",
);

describe("Scout provenance retrieval", () => {
  it("pins prompts committed before the retrieval adapter", () => {
    expect(
      createHash("sha256").update(readFileSync(promptPath)).digest("hex"),
    ).toBe(provenanceRetrievalPromptSha256);
    expect(provenanceRetrievalPromptCommit).toBe(
      "d5b9b3ff943c3c2446bfb50e91e4163ec291e88b",
    );
  });

  it("retrieves all compact dispositions while headings alone retrieve one", () => {
    expect(inspectProvenanceRetrieval(promptPath)).toMatchObject({
      ok: true,
      candidate: { supplied: 14, selected: 14, exact: 14 },
      anchor_heading_only: { supplied: 14, selected: 1, exact: 1 },
      exact_gain: 13,
    });
  });

  it("attributes the matched gain to disposition text", () => {
    const prompts = validateProvenanceRetrievalPrompts(
      JSON.parse(readFileSync(promptPath, "utf8")),
    );
    const answers = buildProvenanceReconstruction(replacementPath);
    expect(
      scoreProvenanceRetrieval(
        prompts.cases,
        provenanceRetrievalEntries(answers, true),
      ).exact,
    ).toBe(14);
    expect(
      scoreProvenanceRetrieval(
        prompts.cases,
        provenanceRetrievalEntries(answers, false),
      ).exact,
    ).toBe(1);
  });

  it("distinguishes post-hoc topic contamination from duplicate wording", () => {
    expect(provenanceRetrievalPosthocV3Commit).toBe(
      "3fd5c82a8412e279e65e2ccf3ace5456d6af4b7d",
    );
    expect(provenanceRetrievalPosthocV3Sha256).toBe(
      "cc5ab71b0ff5fe354abd5494fea35cb355a8b59b6827ac4e6b7308ddf7721324",
    );
    expect(inspectProvenanceRetrieval(promptPath)).toMatchObject({
      prompt_overlap_with_posthoc_v3: {
        aligned_pairs: 14,
        aligned_shared_tokens: 43,
        aligned_mean_jaccard: 0.1712,
        aligned_mean_shorter_query_coverage: 0.4533,
        posthoc_exact_top_one: 5,
        cyclic_shift_max_shared_tokens: 4,
      },
    });
  });

  it("rejects a cyclic substitution of all expected identities", () => {
    const prompts = validateProvenanceRetrievalPrompts(
      JSON.parse(readFileSync(promptPath, "utf8")),
    );
    const answers = buildProvenanceReconstruction(replacementPath);
    const rotated = prompts.cases.map((testCase, index, cases) => ({
      ...testCase,
      expected_entry_id: cases[(index + 1) % cases.length].expected_entry_id,
    }));
    expect(
      scoreProvenanceRetrieval(
        rotated,
        provenanceRetrievalEntries(answers, true),
      ).exact,
    ).toBe(0);
  });

  it("rejects changed prompt bytes before retrieval", () => {
    const altered = JSON.parse(readFileSync(promptPath, "utf8"));
    altered.cases[0].query = `${altered.cases[0].query} changed`;
    const path = join(
      mkdtempSync(join(tmpdir(), "scout-provenance-retrieval-")),
      "scout-provenance-retrieval-prompts-altered.json",
    );
    writeFileSync(path, `${JSON.stringify(altered, null, 2)}\n`);
    expect(() => inspectProvenanceRetrieval(path)).toThrow(
      "provenance retrieval prompt digest mismatch",
    );
  });
});
