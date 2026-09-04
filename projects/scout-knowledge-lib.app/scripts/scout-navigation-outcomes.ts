import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type NavigationEntry = {
  kind: "available" | "unavailable";
  title: string;
  target: string;
  text: string;
};

type ExpectedOutcome =
  | {
      kind: "available" | "unavailable";
      title: string;
      target?: string;
      intended_target?: string;
    }
  | { kind: "ambiguous"; titles: string[]; targets: string[] }
  | { kind: "miss" };

type NavigationCase = {
  id: string;
  query: string;
  expected: ExpectedOutcome;
};

type NavigationFixture = {
  schema: "scout.navigation-heldout/v1";
  frozen_at: string;
  frozen_against_tip: string;
  source_basis: string;
  cases: NavigationCase[];
};

const defaultFixtureName = "scout-navigation-heldout-v1.json";
const fixtureNamePattern = /^scout-navigation-heldout-v\d+\.json$/u;

export function navigationFixtureName(value: string | undefined): string {
  const name = value ?? defaultFixtureName;
  if (!fixtureNamePattern.test(name)) {
    throw new Error(
      "--fixture must name a versioned scout-navigation-heldout-vN.json fixture",
    );
  }
  return name;
}

type RankedEntry = NavigationEntry & {
  matched: string[];
  coverage: number;
  score: number;
};

export type NavigationRankingDiagnostics = {
  schema: "scout.navigation-ranking-diagnostics/v1";
  ranked_count: number;
  top_tie_count: number;
  runner_up: Pick<RankedEntry, "kind" | "title" | "target" | "score"> | null;
  second_score_tier: Array<
    Pick<RankedEntry, "kind" | "title" | "target" | "score">
  >;
  second_score_includes_top: boolean;
  absolute_gap: number | null;
  relative_gap: number | null;
};

export type NavigationOutcome =
  | { kind: "available" | "unavailable"; entry: RankedEntry }
  | { kind: "ambiguous"; entries: RankedEntry[] }
  | { kind: "miss" };

const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "not",
  "of",
  "on",
  "or",
  "the",
  "to",
  "under",
  "with",
]);

function stem(token: string): string {
  if (token.length < 5 || /^\d+$/u.test(token)) return token;
  return token
    .replace(/(?:izations?|isations?|iations?|ational|fulness|iveness)$/u, "")
    .replace(/(?:ments?|ations?|ities|ingly|edly)$/u, "")
    .replace(/(?:ing|ed|es|s|e)$/u, "");
}

export function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .normalize("NFKD")
        .toLowerCase()
        .replace(/\p{Mark}/gu, "")
        .split(/[^\p{Letter}\p{Number}]+/u)
        .filter(Boolean)
        .filter((token) => !stopWords.has(token))
        .map(stem)
        .filter((token) => token.length > 1),
    ),
  ];
}

function stripMarkdown(value: string): string {
  return value
    .replace(/[`*_~]/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function parseNavigationEntries(contents: string): NavigationEntry[] {
  const entries: NavigationEntry[] = [];
  const bullets = contents.split(/\n(?=- )/u);

  for (const bullet of bullets) {
    if (!bullet.startsWith("- ") || bullet.startsWith("- ~~")) continue;

    const unavailable = bullet.match(
      /^- \*\*([^*]+)\*\* \*\(accepted target unavailable; intended path: `([^`]+)`;[\s\S]*?\)\*\s*—\s*([\s\S]*)$/u,
    );
    if (unavailable) {
      entries.push({
        kind: "unavailable",
        title: unavailable[1].trim(),
        target: unavailable[2].trim(),
        text: stripMarkdown(unavailable[3]),
      });
      continue;
    }

    const available = bullet.match(
      /^- \[([^\]]+)\]\(([^)]+)\)\s*(?:—|←)?\s*([\s\S]*)$/u,
    );
    if (available) {
      entries.push({
        kind: "available",
        title: available[1].trim(),
        target: available[2].trim(),
        text: stripMarkdown(available[3]),
      });
    }
  }

  return entries;
}

export function rankNavigation(
  query: string,
  entries: NavigationEntry[],
): RankedEntry[] {
  const queryTokens = tokenize(query);
  const tokenSets = entries.map((entry) => ({
    title: new Set(tokenize(entry.title)),
    text: new Set(tokenize(entry.text)),
  }));
  const documentFrequency = new Map<string, number>();
  for (const token of queryTokens) {
    documentFrequency.set(
      token,
      tokenSets.filter(
        (tokens) => tokens.title.has(token) || tokens.text.has(token),
      ).length,
    );
  }

  return entries
    .map((entry, index): RankedEntry | null => {
      const tokens = tokenSets[index];
      const matched = queryTokens.filter(
        (token) => tokens.title.has(token) || tokens.text.has(token),
      );
      const coverage = queryTokens.length
        ? matched.length / queryTokens.length
        : 0;
      if (matched.length < 2 || coverage < 0.25) return null;
      const score = matched.reduce((total, token) => {
        const frequency = documentFrequency.get(token) ?? 0;
        const inverseFrequency =
          Math.log((entries.length + 1) / (frequency + 1)) + 1;
        return total + inverseFrequency * (tokens.title.has(token) ? 3 : 1);
      }, coverage * 2);
      return { ...entry, matched, coverage, score };
    })
    .filter((entry): entry is RankedEntry => entry !== null)
    .sort((left, right) =>
      right.score === left.score
        ? left.target.localeCompare(right.target)
        : right.score - left.score,
    );
}

export function navigate(
  query: string,
  entries: NavigationEntry[],
): NavigationOutcome {
  const ranked = rankNavigation(query, entries);
  if (!ranked.length) return { kind: "miss" };
  const tied = ranked.filter(
    (entry) => Math.abs(entry.score - ranked[0].score) < 1e-9,
  );
  if (tied.length > 1) return { kind: "ambiguous", entries: tied };
  return { kind: ranked[0].kind, entry: ranked[0] };
}

export function rankingDiagnostics(
  ranked: RankedEntry[],
): NavigationRankingDiagnostics {
  const first = ranked[0];
  const second = ranked[1];
  if (!first || !second) {
    return {
      schema: "scout.navigation-ranking-diagnostics/v1",
      ranked_count: ranked.length,
      top_tie_count: first ? 1 : 0,
      runner_up: null,
      second_score_tier: [],
      second_score_includes_top: false,
      absolute_gap: null,
      relative_gap: null,
    };
  }
  const absoluteGap = first.score - second.score;
  const conciseIdentity = (entry: RankedEntry) => ({
    kind: entry.kind,
    title: entry.title,
    target: entry.target,
    score: Number(entry.score.toFixed(6)),
  });
  return {
    schema: "scout.navigation-ranking-diagnostics/v1",
    ranked_count: ranked.length,
    top_tie_count: ranked.filter(
      (entry) => Math.abs(entry.score - first.score) < 1e-9,
    ).length,
    runner_up: conciseIdentity(second),
    second_score_tier: ranked
      .filter((entry) => Math.abs(entry.score - second.score) < 1e-9)
      .map(conciseIdentity),
    second_score_includes_top: Math.abs(absoluteGap) < 1e-9,
    absolute_gap: Number(absoluteGap.toFixed(6)),
    relative_gap: Number((absoluteGap / first.score).toFixed(6)),
  };
}

function matchesExpected(
  outcome: NavigationOutcome,
  expected: ExpectedOutcome,
): boolean {
  if (outcome.kind !== expected.kind) return false;
  if (outcome.kind === "miss" && expected.kind === "miss") return true;
  if (outcome.kind === "ambiguous" && expected.kind === "ambiguous") {
    const actual = outcome.entries.map((entry) => entry.target).sort();
    return (
      JSON.stringify(actual) === JSON.stringify([...expected.targets].sort())
    );
  }
  if (
    (outcome.kind === "available" || outcome.kind === "unavailable") &&
    (expected.kind === "available" || expected.kind === "unavailable")
  ) {
    const target = expected.target ?? expected.intended_target;
    return (
      outcome.entry.title === expected.title && outcome.entry.target === target
    );
  }
  return false;
}

function readIndex(reference: string | undefined): string {
  const indexPath = "projects/scout-knowledge-lib/knowledge/INDEX.md";
  if (!reference) {
    return readFileSync(
      resolve(import.meta.dir, "../../scout-knowledge-lib/knowledge/INDEX.md"),
      "utf8",
    );
  }
  const root = resolve(import.meta.dir, "../../..");
  const result = spawnSync("git", ["show", `${reference}:${indexPath}`], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || `cannot read index at ${reference}`,
    );
  }
  return result.stdout;
}

function conciseOutcome(outcome: NavigationOutcome): unknown {
  if (outcome.kind === "miss") return outcome;
  if (outcome.kind === "ambiguous") {
    return {
      kind: outcome.kind,
      entries: outcome.entries.map(
        ({ kind, title, target, matched, coverage, score }) => ({
          kind,
          title,
          target,
          matched,
          coverage: Number(coverage.toFixed(4)),
          score: Number(score.toFixed(6)),
        }),
      ),
    };
  }
  const { kind, title, target, matched, coverage, score } = outcome.entry;
  return {
    kind,
    title,
    target,
    matched,
    coverage: Number(coverage.toFixed(4)),
    score: Number(score.toFixed(6)),
  };
}

if (import.meta.main) {
  const referenceIndex = process.argv.indexOf("--ref");
  const reference =
    referenceIndex >= 0 ? process.argv[referenceIndex + 1] : undefined;
  const minimumIndex = process.argv.indexOf("--minimum-passed");
  const minimumPassed =
    minimumIndex >= 0 ? Number(process.argv[minimumIndex + 1]) : undefined;
  if (
    minimumPassed !== undefined &&
    (!Number.isSafeInteger(minimumPassed) || minimumPassed < 0)
  ) {
    throw new Error("--minimum-passed must be a non-negative integer");
  }
  const fixtureIndex = process.argv.indexOf("--fixture");
  if (fixtureIndex >= 0 && process.argv[fixtureIndex + 1] === undefined) {
    throw new Error("--fixture requires a fixture name");
  }
  const fixtureName = navigationFixtureName(
    fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : undefined,
  );
  const fixture = JSON.parse(
    readFileSync(resolve(import.meta.dir, "fixtures", fixtureName), "utf8"),
  ) as NavigationFixture;
  if (fixture.schema !== "scout.navigation-heldout/v1") {
    throw new Error("unsupported navigation fixture schema");
  }
  const entries = parseNavigationEntries(readIndex(reference));
  const cases = fixture.cases.map((testCase) => {
    const ranked = rankNavigation(testCase.query, entries);
    const outcome = navigate(testCase.query, entries);
    return {
      id: testCase.id,
      expected: testCase.expected,
      outcome: conciseOutcome(outcome),
      diagnostics: rankingDiagnostics(ranked),
      pass: matchesExpected(outcome, testCase.expected),
    };
  });
  const passed = cases.filter((testCase) => testCase.pass).length;
  process.stdout.write(
    `${JSON.stringify(
      {
        schema: "scout.navigation-outcomes/v1",
        fixture: {
          name: fixtureName,
          frozen_at: fixture.frozen_at,
          frozen_against_tip: fixture.frozen_against_tip,
          source_basis: fixture.source_basis,
        },
        index_reference: reference ?? "working-tree",
        entry_count: entries.length,
        summary: {
          cases: cases.length,
          passed,
          failed: cases.length - passed,
          minimum_passed: minimumPassed ?? null,
          gate_pass: minimumPassed === undefined || passed >= minimumPassed,
        },
        cases,
      },
      null,
      2,
    )}\n`,
  );
  if (minimumPassed !== undefined && passed < minimumPassed) {
    process.exitCode = 1;
  }
}
