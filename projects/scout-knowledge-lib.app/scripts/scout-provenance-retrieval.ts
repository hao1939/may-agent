import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildProvenanceReconstruction,
  type ReconstructionAnswer,
} from "./scout-provenance-reconstruction";
import {
  rankNavigation,
  type NavigationEntry,
} from "./scout-navigation-outcomes";

type JsonObject = Record<string, unknown>;

export type ProvenanceRetrievalCase = {
  id: string;
  query: string;
  expected_entry_id: string;
};

export type ProvenanceRetrievalPrompts = {
  schema: "scout.provenance-retrieval-prompts/v1";
  frozen_at: string;
  frozen_against_tip: string;
  source_basis: string;
  seed_reconciliation: {
    receipt: string;
    observed_through: string;
    reconciled_at: string;
    stable_identity_count: 132;
    added_or_changed: "unknown";
    observed_removals: [];
    unavailable_count: 132;
    xhs_requests: 0;
    github_requests: 0;
    arxiv_requests: 0;
    reddit_requests: 0;
    reason: string;
  };
  cases: ProvenanceRetrievalCase[];
};

type RetrievalOutcome = {
  id: string;
  expected_entry_id: string;
  selected_entry_id: string | null;
  exact: boolean;
  matched: string[];
  score: number | null;
};

type RetrievalScore = {
  supplied: number;
  selected: number;
  exact: number;
  outcomes: RetrievalOutcome[];
};

export const provenanceRetrievalPromptCommit =
  "d5b9b3ff943c3c2446bfb50e91e4163ec291e88b";
export const provenanceRetrievalPromptSha256 =
  "d86a0173e94fb1ca281ade40d49ddfe974e02e3973eb242aeed8d536b05023d5";

const fullSha = /^[0-9a-f]{40}$/u;

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

function zero(value: unknown, label: string): void {
  if (value !== 0) throw new Error(`${label} must remain zero`);
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

export function validateProvenanceRetrievalPrompts(
  raw: unknown,
): ProvenanceRetrievalPrompts {
  const fixture = object(raw, "prompt fixture");
  exactKeys(
    fixture,
    [
      "schema",
      "frozen_at",
      "frozen_against_tip",
      "source_basis",
      "seed_reconciliation",
      "cases",
    ],
    "prompt fixture",
  );
  if (fixture.schema !== "scout.provenance-retrieval-prompts/v1") {
    throw new Error("unsupported provenance retrieval prompt schema");
  }
  nonempty(fixture.frozen_at, "frozen_at");
  if (
    !fullSha.test(nonempty(fixture.frozen_against_tip, "frozen_against_tip"))
  ) {
    throw new Error("frozen_against_tip must be a full commit SHA");
  }
  nonempty(fixture.source_basis, "source_basis");

  const seed = object(fixture.seed_reconciliation, "seed_reconciliation");
  exactKeys(
    seed,
    [
      "receipt",
      "observed_through",
      "reconciled_at",
      "stable_identity_count",
      "added_or_changed",
      "observed_removals",
      "unavailable_count",
      "xhs_requests",
      "github_requests",
      "arxiv_requests",
      "reddit_requests",
      "reason",
    ],
    "seed_reconciliation",
  );
  nonempty(seed.receipt, "seed_reconciliation.receipt");
  nonempty(seed.observed_through, "seed_reconciliation.observed_through");
  nonempty(seed.reconciled_at, "seed_reconciliation.reconciled_at");
  nonempty(seed.reason, "seed_reconciliation.reason");
  if (
    seed.stable_identity_count !== 132 ||
    seed.unavailable_count !== 132 ||
    seed.added_or_changed !== "unknown" ||
    !Array.isArray(seed.observed_removals) ||
    seed.observed_removals.length !== 0
  ) {
    throw new Error("seed reconciliation boundary changed");
  }
  zero(seed.xhs_requests, "seed_reconciliation.xhs_requests");
  zero(seed.github_requests, "seed_reconciliation.github_requests");
  zero(seed.arxiv_requests, "seed_reconciliation.arxiv_requests");
  zero(seed.reddit_requests, "seed_reconciliation.reddit_requests");

  if (!Array.isArray(fixture.cases)) {
    throw new Error("cases must be an array");
  }
  const ids = new Set<string>();
  const expected = new Set<string>();
  for (const [index, value] of fixture.cases.entries()) {
    const testCase = object(value, `cases[${index}]`);
    exactKeys(
      testCase,
      ["id", "query", "expected_entry_id"],
      `cases[${index}]`,
    );
    ids.add(nonempty(testCase.id, `cases[${index}].id`));
    nonempty(testCase.query, `cases[${index}].query`);
    expected.add(
      nonempty(testCase.expected_entry_id, `cases[${index}].expected_entry_id`),
    );
  }
  if (fixture.cases.length !== 14 || ids.size !== 14 || expected.size !== 14) {
    throw new Error(
      "cases must map fourteen unique prompts to fourteen entries",
    );
  }
  return raw as ProvenanceRetrievalPrompts;
}

export function provenanceRetrievalEntries(
  answers: ReconstructionAnswer[],
  includeDisposition: boolean,
): NavigationEntry[] {
  return answers.map((answer) => ({
    kind: "available",
    title: answer.accepted_evidence.heading,
    target: answer.entry_id,
    text: includeDisposition
      ? [
          answer.limitation,
          answer.review,
          answer.seed_receipt,
          answer.integration,
          answer.rollback,
        ].join(" ")
      : "",
  }));
}

export function scoreProvenanceRetrieval(
  cases: ProvenanceRetrievalCase[],
  entries: NavigationEntry[],
): RetrievalScore {
  const outcomes = cases.map((testCase): RetrievalOutcome => {
    const selected = rankNavigation(testCase.query, entries)[0];
    return {
      id: testCase.id,
      expected_entry_id: testCase.expected_entry_id,
      selected_entry_id: selected?.target ?? null,
      exact: selected?.target === testCase.expected_entry_id,
      matched: selected?.matched ?? [],
      score: selected ? Number(selected.score.toFixed(6)) : null,
    };
  });
  return {
    supplied: outcomes.length,
    selected: outcomes.filter((outcome) => outcome.selected_entry_id !== null)
      .length,
    exact: outcomes.filter((outcome) => outcome.exact).length,
    outcomes,
  };
}

export function inspectProvenanceRetrieval(
  promptPath: string,
): Record<string, unknown> {
  const promptBytes = readFileSync(promptPath);
  if (digest(promptBytes) !== provenanceRetrievalPromptSha256) {
    throw new Error("provenance retrieval prompt digest mismatch");
  }
  const prompts = validateProvenanceRetrievalPrompts(
    JSON.parse(promptBytes.toString("utf8")),
  );
  const appDir = resolve(dirname(promptPath), "../..");
  const root = resolve(appDir, "../..");
  if (
    git(root, ["rev-parse", `${provenanceRetrievalPromptCommit}^`]) !==
    prompts.frozen_against_tip
  ) {
    throw new Error(
      "prompt commit is not the direct child of frozen_against_tip",
    );
  }
  const committedPrompt = git(root, [
    "show",
    `${provenanceRetrievalPromptCommit}:projects/scout-knowledge-lib.app/scripts/fixtures/${promptPath.split("/").at(-1)}`,
  ]);
  if (digest(`${committedPrompt}\n`) !== provenanceRetrievalPromptSha256) {
    throw new Error("committed provenance retrieval prompts changed");
  }
  git(root, [
    "merge-base",
    "--is-ancestor",
    provenanceRetrievalPromptCommit,
    "HEAD",
  ]);

  const replacementPath = resolve(
    dirname(promptPath),
    "scout-provenance-replacement-cycle413.json",
  );
  const answers = buildProvenanceReconstruction(replacementPath);
  const candidate = scoreProvenanceRetrieval(
    prompts.cases,
    provenanceRetrievalEntries(answers, true),
  );
  const headingOnly = scoreProvenanceRetrieval(
    prompts.cases,
    provenanceRetrievalEntries(answers, false),
  );

  return {
    ok: true,
    frozen_against_tip: prompts.frozen_against_tip,
    prompt_commit: provenanceRetrievalPromptCommit,
    prompt_sha256: provenanceRetrievalPromptSha256,
    seed_reconciliation: prompts.seed_reconciliation,
    candidate,
    anchor_heading_only: headingOnly,
    exact_gain: candidate.exact - headingOnly.exact,
    interpretation:
      "Producer-authored prompt replay measures deterministic top-one retrieval from accepted compact fields, not independent selection, later use, savings, or user outcomes.",
  };
}

if (import.meta.main) {
  const fixtureName = process.argv[2];
  if (
    !fixtureName ||
    !/^scout-provenance-retrieval-prompts-[a-z0-9-]+\.json$/u.test(fixtureName)
  ) {
    throw new Error(
      "pass one scout-provenance-retrieval-prompts-*.json fixture name",
    );
  }
  const promptPath = resolve(import.meta.dir, "fixtures", fixtureName);
  process.stdout.write(
    `${JSON.stringify(inspectProvenanceRetrieval(promptPath), null, 2)}\n`,
  );
}
