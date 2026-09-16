import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveAssessment, sources, type Assessment } from "./archive";

const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  roots
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true }));
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-archive-test-"));
  roots.push(root);
  return root;
}
const url = Object.keys(sources)[1];
const assessment: Assessment = {
  url,
  title: "Abstract assessment",
  coverage: "abstract",
  summary: "Evidence is insufficient.",
  claims: [
    {
      claim: "Improvement is claimed",
      quote:
        "The abstract claims retrieval improves results across five domains.",
      assessment: "No methods are available.",
    },
  ],
  limitations: ["Full text unavailable"],
  connections: [],
  disposition: "Archived; no new canonical claim",
};
test("requires actual source access, honest coverage, and matching quotations", () => {
  const root = fixture();
  expect(() => archiveAssessment(root, new Set(), assessment)).toThrow(
    "Read the exact source",
  );
  expect(() =>
    archiveAssessment(root, new Set([url]), {
      ...assessment,
      coverage: "full_text",
    }),
  ).toThrow("coverage");
  expect(() =>
    archiveAssessment(root, new Set([url]), {
      ...assessment,
      claims: [
        { ...assessment.claims[0], quote: "The trials proved a large effect." },
      ],
    }),
  ).toThrow("quotations");
});
test("repeat source assessment reuses its path and preserves the earlier assessment", () => {
  const root = fixture();
  setSystemTime(new Date("2026-09-15T10:00:00Z"));
  const first = archiveAssessment(root, new Set([url]), assessment);
  setSystemTime(new Date("2026-09-16T10:00:00Z"));
  const second = archiveAssessment(root, new Set([url]), {
    ...assessment,
    summary: "Reassessed; still insufficient.",
  });
  expect(second.path).toBe(first.path);
  expect(readdirSync(join(root, "knowledge/findings"))).toHaveLength(1);
  expect(readdirSync(join(root, "history"))).toHaveLength(1);
});
