import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "bun:test";
import {
  buildProvenanceReconstruction,
  inspectProvenanceReconstruction,
  reconstructionScorerSha256,
  scoreProvenanceReconstruction,
  validateReconstructionScorerShape,
} from "./scout-provenance-reconstruction";

const fixturesDir = resolve(import.meta.dir, "fixtures");
const scorerPath = resolve(
  fixturesDir,
  "scout-provenance-reconstruction-cycle414.json",
);
const replacementPath = resolve(
  fixturesDir,
  "scout-provenance-replacement-cycle413.json",
);

describe("Scout provenance reconstruction", () => {
  it("pins a scorer separately from the accepted replacement", () => {
    expect(
      createHash("sha256").update(readFileSync(scorerPath)).digest("hex"),
    ).toBe(reconstructionScorerSha256);
    expect(
      createHash("sha256").update(readFileSync(replacementPath)).digest("hex"),
    ).toBe("8c9ecb6c26214be88820eb9b9d3612ea82394a1b5fdc7dae20e29aab84cc1856");
  });

  it("reconstructs all dispositions while the matched anchor-only control reconstructs none", () => {
    expect(inspectProvenanceReconstruction(scorerPath)).toMatchObject({
      ok: true,
      anchors_resolved: 14,
      replacement: { supplied: 14, complete: 14, exact: 14 },
      anchor_reference_only: { supplied: 14, complete: 0, exact: 0 },
      exact_gain: 14,
    });
  });

  it("detects a changed disposition and changed entry order", () => {
    const scorer = validateReconstructionScorerShape(
      JSON.parse(readFileSync(scorerPath, "utf8")),
    );
    const answers = buildProvenanceReconstruction(replacementPath);
    const changed = structuredClone(answers);
    changed[4].limitation = "A substituted limitation.";
    expect(scoreProvenanceReconstruction(changed, scorer)).toEqual({
      supplied: 14,
      complete: 14,
      exact: 13,
    });

    const reordered = structuredClone(answers);
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    expect(scoreProvenanceReconstruction(reordered, scorer)).toEqual({
      supplied: 14,
      complete: 14,
      exact: 12,
    });
  });

  it("rejects a self-consistent-looking scorer substitution", () => {
    const altered = JSON.parse(readFileSync(scorerPath, "utf8"));
    altered.expected_entries[0].answer_sha256 = "0".repeat(64);
    const path = join(
      mkdtempSync(join(tmpdir(), "scout-reconstruction-")),
      "scout-provenance-reconstruction-altered.json",
    );
    writeFileSync(path, `${JSON.stringify(altered, null, 2)}\n`);
    expect(() => inspectProvenanceReconstruction(path)).toThrow(
      "reconstruction scorer digest mismatch",
    );
  });
});
