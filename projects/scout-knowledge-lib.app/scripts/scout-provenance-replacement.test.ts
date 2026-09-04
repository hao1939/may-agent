import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  fragmentMatchCount,
  replacementRemainder,
  validateProvenanceFixtureShape,
} from "./scout-provenance-replacement";

const fixturePath = resolve(
  import.meta.dir,
  "fixtures/scout-provenance-replacement-cycle413.json",
);

describe("Scout compact provenance replacement", () => {
  it("fails closed on missing and unknown record fields", () => {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    const missing = structuredClone(fixture);
    delete missing.record.entries[0].limitation;
    expect(() => validateProvenanceFixtureShape(missing)).toThrow(
      "keys must be exactly",
    );

    const extended = structuredClone(fixture);
    extended.record.entries[0].claim = "not allowed";
    expect(() => validateProvenanceFixtureShape(extended)).toThrow(
      "keys must be exactly",
    );
  });

  it("requires one exact Markdown fragment", () => {
    const markdown = "## Exact target\n\n## Exact target\n## Other\n";
    expect(fragmentMatchCount(markdown, "other")).toBe(1);
    expect(fragmentMatchCount(markdown, "missing")).toBe(0);
    expect(fragmentMatchCount(markdown, "exact-target")).toBe(2);
  });

  it("keeps audit metadata outside the rendered replacement", () => {
    const output = {
      absent_after_projection: {
        headings: ["Cycle 373 checkpoint — duplicate structure"],
        commit_refs: ["abcdef1"],
        timestamps: ["2026-09-04T10:00:00Z", "2026-09-04T11:00:00Z"],
        urls: [],
      },
      broad_links: { ok: true, documents: 1, checked: 0, errors: [] },
    };
    const record = {
      entries: [],
      retained_literals: {
        commit_refs: ["abcdef1"],
        timestamps: ["2026-09-04T10:00:00Z"],
      },
    };
    expect(replacementRemainder(output, record)).toEqual({
      headings: ["Cycle 373 checkpoint — duplicate structure"],
      commit_refs: [],
      timestamps: ["2026-09-04T11:00:00Z"],
      urls: [],
    });
  });

  it("validates the exact source-bound candidate end to end", () => {
    const appDir = resolve(import.meta.dir, "..");
    const run = spawnSync(
      "bun",
      [
        "./scripts/scout-provenance-replacement.ts",
        "scout-provenance-replacement-cycle413.json",
      ],
      { cwd: appDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: true,
      entries: 14,
      evidence_fragments_unique: 14,
      retained_commit_refs: 6,
      retained_timestamps: 48,
      omitted_operational_timestamps: 19,
      classified_structural_headings: 61,
      broad_links: { ok: true, documents: 1546, checked: 1774, errors: [] },
    });
  }, 30_000);
});
