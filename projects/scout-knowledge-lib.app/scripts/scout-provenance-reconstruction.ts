import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  markdownSection,
  validateProvenanceFixtureShape,
} from "./scout-provenance-replacement";

type JsonObject = Record<string, unknown>;

export type ReconstructionAnswer = {
  entry_id: string;
  producer_source: string;
  producer_result: string;
  accepted_evidence: {
    path: string;
    fragment: string;
    heading: string;
  };
  seed_receipt: string;
  review: string;
  limitation: string;
  integration: "exact";
  rollback: "revert-producer-result-after-dependents";
};

export type ReconstructionScorer = {
  schema: "scout.provenance-reconstruction/v1";
  frozen_against_tip: string;
  replacement_fixture: string;
  replacement_fixture_sha256: string;
  expected_entries: Array<{ entry_id: string; answer_sha256: string }>;
  expected_scores: {
    replacement_exact: 14;
    anchor_reference_only_exact: 0;
  };
  interpretation: string;
};

type ReconstructionScore = {
  supplied: number;
  complete: number;
  exact: number;
};

export const reconstructionScorerSha256 =
  "a7ddcc64a8fe7225c584ea65e52ff5040151f3dd951013c491f21b38b413cf9e";

const sha = /^[0-9a-f]{40}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys must be exactly ${expected.join(",")}`);
  }
}

function nonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function heading(section: string): string {
  const value = section
    .split("\n", 1)[0]
    ?.match(/^#{1,6}\s+(.+?)\s*#*\s*$/u)?.[1];
  if (!value) throw new Error("accepted evidence section has no heading");
  return value;
}

export function answerSha256(answer: ReconstructionAnswer): string {
  return digest(JSON.stringify(answer));
}

export function buildProvenanceReconstruction(
  replacementPath: string,
): ReconstructionAnswer[] {
  const replacement = validateProvenanceFixtureShape(
    JSON.parse(readFileSync(replacementPath, "utf8")),
  );
  const appDir = resolve(dirname(replacementPath), "../..");
  const root = resolve(appDir, "../..");

  return replacement.record.entries.map((entry) => {
    const markdown = git(root, [
      "show",
      `${replacement.evidence_tip}:${entry.accepted_evidence.path}`,
    ]);
    const section = markdownSection(markdown, entry.accepted_evidence.fragment);
    return {
      entry_id: entry.entry_id,
      producer_source: entry.producer_source,
      producer_result: entry.producer_result,
      accepted_evidence: {
        path: entry.accepted_evidence.path,
        fragment: entry.accepted_evidence.fragment,
        heading: heading(section),
      },
      seed_receipt: entry.seed_receipt,
      review: entry.review,
      limitation: entry.limitation,
      integration: entry.integration,
      rollback: entry.rollback,
    };
  });
}

export function validateReconstructionScorerShape(
  raw: unknown,
): ReconstructionScorer {
  const scorer = object(raw, "scorer");
  exactKeys(
    scorer,
    [
      "schema",
      "frozen_against_tip",
      "replacement_fixture",
      "replacement_fixture_sha256",
      "expected_entries",
      "expected_scores",
      "interpretation",
    ],
    "scorer",
  );
  if (scorer.schema !== "scout.provenance-reconstruction/v1") {
    throw new Error("unsupported provenance reconstruction schema");
  }
  if (!sha.test(nonempty(scorer.frozen_against_tip, "frozen_against_tip"))) {
    throw new Error("frozen_against_tip must be a full commit SHA");
  }
  if (
    scorer.replacement_fixture !== "scout-provenance-replacement-cycle413.json"
  ) {
    throw new Error("replacement_fixture changed");
  }
  if (
    !sha256Pattern.test(
      nonempty(scorer.replacement_fixture_sha256, "replacement_fixture_sha256"),
    )
  ) {
    throw new Error("replacement_fixture_sha256 must be SHA-256");
  }
  if (!Array.isArray(scorer.expected_entries)) {
    throw new Error("expected_entries must be an array");
  }
  const ids = scorer.expected_entries.map((value, index) => {
    const expected = object(value, `expected_entries[${index}]`);
    exactKeys(
      expected,
      ["entry_id", "answer_sha256"],
      `expected_entries[${index}]`,
    );
    const entryId = nonempty(
      expected.entry_id,
      `expected_entries[${index}].entry_id`,
    );
    if (
      !sha256Pattern.test(
        nonempty(expected.answer_sha256, `${entryId}.answer_sha256`),
      )
    ) {
      throw new Error(`${entryId}.answer_sha256 must be SHA-256`);
    }
    return entryId;
  });
  if (ids.length !== 14 || new Set(ids).size !== ids.length) {
    throw new Error("expected_entries must contain fourteen unique entries");
  }
  const scores = object(scorer.expected_scores, "expected_scores");
  exactKeys(
    scores,
    ["replacement_exact", "anchor_reference_only_exact"],
    "expected_scores",
  );
  if (
    scores.replacement_exact !== 14 ||
    scores.anchor_reference_only_exact !== 0
  ) {
    throw new Error("expected reconstruction scores changed");
  }
  nonempty(scorer.interpretation, "interpretation");
  return raw as ReconstructionScorer;
}

function completeAnswer(value: unknown): value is ReconstructionAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answer = value as JsonObject;
  const keys = [
    "entry_id",
    "producer_source",
    "producer_result",
    "accepted_evidence",
    "seed_receipt",
    "review",
    "limitation",
    "integration",
    "rollback",
  ];
  if (
    JSON.stringify(Object.keys(answer).sort()) !==
    JSON.stringify([...keys].sort())
  ) {
    return false;
  }
  const evidence = answer.accepted_evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return false;
  }
  const evidenceObject = evidence as JsonObject;
  return (
    typeof answer.entry_id === "string" &&
    typeof answer.producer_source === "string" &&
    typeof answer.producer_result === "string" &&
    JSON.stringify(Object.keys(evidenceObject).sort()) ===
      JSON.stringify(["fragment", "heading", "path"]) &&
    Object.values(evidenceObject).every((item) => typeof item === "string") &&
    typeof answer.seed_receipt === "string" &&
    typeof answer.review === "string" &&
    typeof answer.limitation === "string" &&
    answer.integration === "exact" &&
    answer.rollback === "revert-producer-result-after-dependents"
  );
}

export function scoreProvenanceReconstruction(
  answers: unknown[],
  scorer: ReconstructionScorer,
): ReconstructionScore {
  let complete = 0;
  let exact = 0;
  for (let index = 0; index < answers.length; index += 1) {
    const answer = answers[index];
    if (!completeAnswer(answer)) continue;
    complete += 1;
    const expected = scorer.expected_entries[index];
    if (
      expected?.entry_id === answer.entry_id &&
      expected.answer_sha256 === answerSha256(answer)
    ) {
      exact += 1;
    }
  }
  return { supplied: answers.length, complete, exact };
}

export function inspectProvenanceReconstruction(
  scorerPath: string,
): Record<string, unknown> {
  const scorerBytes = readFileSync(scorerPath);
  if (digest(scorerBytes) !== reconstructionScorerSha256) {
    throw new Error("reconstruction scorer digest mismatch");
  }
  const scorer = validateReconstructionScorerShape(
    JSON.parse(scorerBytes.toString("utf8")),
  );
  const appDir = resolve(dirname(scorerPath), "../..");
  const root = resolve(appDir, "../..");
  git(root, ["merge-base", "--is-ancestor", scorer.frozen_against_tip, "HEAD"]);

  const replacementPath = resolve(
    dirname(scorerPath),
    scorer.replacement_fixture,
  );
  if (
    digest(readFileSync(replacementPath)) !== scorer.replacement_fixture_sha256
  ) {
    throw new Error("replacement fixture digest mismatch");
  }
  const candidate = buildProvenanceReconstruction(replacementPath);
  const anchorReferenceOnly = candidate.map((answer) => ({
    accepted_evidence: answer.accepted_evidence,
  }));
  const candidateScore = scoreProvenanceReconstruction(candidate, scorer);
  const baselineScore = scoreProvenanceReconstruction(
    anchorReferenceOnly,
    scorer,
  );
  if (
    candidateScore.exact !== scorer.expected_scores.replacement_exact ||
    baselineScore.exact !== scorer.expected_scores.anchor_reference_only_exact
  ) {
    throw new Error("reconstruction score changed");
  }

  return {
    ok: true,
    frozen_against_tip: scorer.frozen_against_tip,
    scorer_sha256: reconstructionScorerSha256,
    replacement_fixture_sha256: scorer.replacement_fixture_sha256,
    anchors_resolved: candidate.length,
    replacement: candidateScore,
    anchor_reference_only: baselineScore,
    exact_gain: candidateScore.exact - baselineScore.exact,
    interpretation: scorer.interpretation,
  };
}

if (import.meta.main) {
  const fixtureName = process.argv[2];
  if (
    !fixtureName ||
    !/^scout-provenance-reconstruction-[a-z0-9-]+\.json$/u.test(fixtureName)
  ) {
    throw new Error(
      "pass one scout-provenance-reconstruction-*.json fixture name",
    );
  }
  const scorerPath = resolve(import.meta.dir, "fixtures", fixtureName);
  process.stdout.write(
    `${JSON.stringify(inspectProvenanceReconstruction(scorerPath), null, 2)}\n`,
  );
}
