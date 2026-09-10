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
  tokenize,
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

type PosthocNavigationCase = {
  id: string;
  query: string;
  expected: {
    kind: "available";
    title: string;
    target: string;
  };
};

type PromptOverlapOutcome = {
  prompt_id: string;
  posthoc_id: string;
  shared_tokens: number;
  jaccard: number;
  shorter_query_coverage: number;
  posthoc_top_one: boolean;
};

export const provenanceRetrievalPromptCommit =
  "d5b9b3ff943c3c2446bfb50e91e4163ec291e88b";
export const provenanceRetrievalPromptSha256 =
  "d86a0173e94fb1ca281ade40d49ddfe974e02e3973eb242aeed8d536b05023d5";
export const provenanceRetrievalPosthocV3Commit =
  "3fd5c82a8412e279e65e2ccf3ace5456d6af4b7d";
export const provenanceRetrievalPosthocV3Sha256 =
  "cc5ab71b0ff5fe354abd5494fea35cb355a8b59b6827ac4e6b7308ddf7721324";

const posthocIdByEntryId: Record<string, string> = {
  "cycle-373-hexstrike": "hexstrike-client-contrast",
  "cycle-374-skillopt-lite": "skillopt-scale",
  "cycle-375-anchored-self-play": "anchored-self-play-transfer",
  "cycle-376-gameenginebench": "gameengine-runtime",
  "cycle-377-atomiccommitbench": "atomic-replay",
  "cycle-378-hidden-computation": "hidden-computation",
  "cycle-379-single-prover": "single-prover",
  "cycle-380-dscc": "dscc-composition",
  "cycle-381-coderabbit": "coderabbit-selection",
  "cycle-382-rlsr": "rlsr-abstention",
  "cycle-383-agentic-ttt": "agentic-ttt",
  "cycle-384-policy-repair": "aggregate-repair",
  "cycle-385-hase": "hase-coevolution",
  "cycle-386-veritas": "veritas-bundle",
};

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

function posthocNavigationCases(raw: unknown): PosthocNavigationCase[] {
  const fixture = object(raw, "post-hoc navigation fixture");
  if (
    fixture.schema !== "scout.navigation-heldout/v1" ||
    !Array.isArray(fixture.cases) ||
    fixture.cases.length !== 14
  ) {
    throw new Error("post-hoc navigation fixture shape changed");
  }
  return fixture.cases.map((value, index) => {
    const testCase = object(value, `post-hoc cases[${index}]`);
    const expected = object(
      testCase.expected,
      `post-hoc cases[${index}].expected`,
    );
    if (expected.kind !== "available") {
      throw new Error("post-hoc comparison requires available outcomes");
    }
    return {
      id: nonempty(testCase.id, `post-hoc cases[${index}].id`),
      query: nonempty(testCase.query, `post-hoc cases[${index}].query`),
      expected: {
        kind: "available",
        title: nonempty(
          expected.title,
          `post-hoc cases[${index}].expected.title`,
        ),
        target: nonempty(
          expected.target,
          `post-hoc cases[${index}].expected.target`,
        ),
      },
    };
  });
}

export function inspectProvenancePromptOverlap(
  prompts: ProvenanceRetrievalPrompts,
  answers: ReconstructionAnswer[],
  posthocPath: string,
): Record<string, unknown> {
  const posthocBytes = readFileSync(posthocPath);
  if (digest(posthocBytes) !== provenanceRetrievalPosthocV3Sha256) {
    throw new Error("post-hoc navigation prompt digest mismatch");
  }
  const posthoc = posthocNavigationCases(
    JSON.parse(posthocBytes.toString("utf8")),
  );
  const answerById = new Map(
    answers.map((answer) => [answer.entry_id, answer]),
  );
  const posthocById = new Map(
    posthoc.map((testCase) => [testCase.id, testCase]),
  );
  if (
    posthocById.size !== posthoc.length ||
    Object.keys(posthocIdByEntryId).length !== prompts.cases.length ||
    new Set(Object.values(posthocIdByEntryId)).size !== posthoc.length
  ) {
    throw new Error("post-hoc topic mapping must remain one-to-one");
  }

  const aligned = prompts.cases.map((testCase) => {
    const answer = answerById.get(testCase.expected_entry_id);
    if (!answer) throw new Error(`missing answer for ${testCase.id}`);
    const posthocCase = posthocById.get(
      posthocIdByEntryId[testCase.expected_entry_id],
    );
    if (!posthocCase) {
      throw new Error(`missing post-hoc topic mapping for ${testCase.id}`);
    }
    return { prompt: testCase, posthoc: posthocCase };
  });
  if (new Set(aligned.map(({ posthoc }) => posthoc.id)).size !== 14) {
    throw new Error("post-hoc comparison is not one-to-one");
  }

  const entries: NavigationEntry[] = aligned.map(({ posthoc }) => ({
    kind: "available",
    title: "",
    target: posthoc.id,
    text: posthoc.query,
  }));
  const outcomes: PromptOverlapOutcome[] = aligned.map(
    ({ prompt, posthoc }) => {
      const promptTokens = new Set(tokenize(prompt.query));
      const posthocTokens = new Set(tokenize(posthoc.query));
      const shared = [...promptTokens].filter((token) =>
        posthocTokens.has(token),
      );
      const union = new Set([...promptTokens, ...posthocTokens]);
      const top = rankNavigation(prompt.query, entries)[0];
      return {
        prompt_id: prompt.id,
        posthoc_id: posthoc.id,
        shared_tokens: shared.length,
        jaccard: Number((shared.length / union.size).toFixed(4)),
        shorter_query_coverage: Number(
          (
            shared.length / Math.min(promptTokens.size, posthocTokens.size)
          ).toFixed(4),
        ),
        posthoc_top_one: top?.target === posthoc.id,
      };
    },
  );
  const cyclicShared = Array.from({ length: 13 }, (_, index) => {
    const offset = index + 1;
    return aligned.reduce((total, { prompt }, promptIndex) => {
      const promptTokens = new Set(tokenize(prompt.query));
      const shiftedTokens = new Set(
        tokenize(
          aligned[(promptIndex + offset) % aligned.length].posthoc.query,
        ),
      );
      return (
        total +
        [...promptTokens].filter((token) => shiftedTokens.has(token)).length
      );
    }, 0);
  });

  return {
    posthoc_fixture_commit: provenanceRetrievalPosthocV3Commit,
    posthoc_fixture_sha256: provenanceRetrievalPosthocV3Sha256,
    aligned_pairs: outcomes.length,
    aligned_shared_tokens: outcomes.reduce(
      (total, outcome) => total + outcome.shared_tokens,
      0,
    ),
    aligned_mean_jaccard: Number(
      (
        outcomes.reduce((total, outcome) => total + outcome.jaccard, 0) /
        outcomes.length
      ).toFixed(4),
    ),
    aligned_mean_shorter_query_coverage: Number(
      (
        outcomes.reduce(
          (total, outcome) => total + outcome.shorter_query_coverage,
          0,
        ) / outcomes.length
      ).toFixed(4),
    ),
    posthoc_exact_top_one: outcomes.filter((outcome) => outcome.posthoc_top_one)
      .length,
    cyclic_shift_shared_tokens: cyclicShared,
    cyclic_shift_max_shared_tokens: Math.max(...cyclicShared),
    outcomes,
    interpretation:
      "The prompt set is not an independent retrieval sample: an explicit producer-authored topic mapping aligns it one-to-one with the earlier producer-authored post-hoc questions. Lexical overlap is uneven, so this is topic contamination rather than byte-near duplication.",
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
  const posthocPath = resolve(
    dirname(promptPath),
    "scout-navigation-heldout-v3.json",
  );
  const committedPosthoc = git(root, [
    "show",
    `${provenanceRetrievalPosthocV3Commit}:projects/scout-knowledge-lib.app/scripts/fixtures/scout-navigation-heldout-v3.json`,
  ]);
  if (digest(`${committedPosthoc}\n`) !== provenanceRetrievalPosthocV3Sha256) {
    throw new Error("committed post-hoc navigation prompts changed");
  }
  const promptOverlap = inspectProvenancePromptOverlap(
    prompts,
    answers,
    posthocPath,
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
    prompt_overlap_with_posthoc_v3: promptOverlap,
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
