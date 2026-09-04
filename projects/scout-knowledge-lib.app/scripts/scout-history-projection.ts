import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectRelativeLinks } from "./scout-relative-links.js";
import {
  navigate,
  parseNavigationEntries,
  type NavigationOutcome,
} from "./scout-navigation-outcomes.js";

type ProjectionFixture = {
  schema: "scout.history-projection/v1";
  frozen_against_tip: string;
  range: { from_exclusive: string; through_inclusive: string };
  projected_files: string[];
  navigation_fixtures: string[];
};

type NavigationExpected =
  | {
      kind: "available" | "unavailable";
      title: string;
      target?: string;
      intended_target?: string;
    }
  | { kind: "ambiguous"; targets: string[] }
  | { kind: "miss" };

type NavigationFixture = {
  schema: "scout.navigation-heldout/v1";
  cases: Array<{ id: string; query: string; expected: NavigationExpected }>;
};

export type ProjectedBlame = {
  contents: string;
  removedLines: string[];
  removedByCommit: Record<string, number>;
};

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

export function projectPorcelainBlame(
  porcelain: string,
  removedCommits: Set<string>,
  hadTrailingNewline = true,
): ProjectedBlame {
  const kept: string[] = [];
  const removedLines: string[] = [];
  const removedByCommit: Record<string, number> = {};
  let commit = "";

  for (const line of porcelain.split("\n")) {
    const header = line.match(/^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/u);
    if (header) {
      commit = header[1];
      continue;
    }
    if (!line.startsWith("\t")) continue;
    const contents = line.slice(1);
    if (removedCommits.has(commit)) {
      removedLines.push(contents);
      removedByCommit[commit] = (removedByCommit[commit] ?? 0) + 1;
    } else {
      kept.push(contents);
    }
  }

  return {
    contents: `${kept.join("\n")}${hadTrailingNewline ? "\n" : ""}`,
    removedLines,
    removedByCommit,
  };
}

export function literalInventory(contents: string): {
  headings: string[];
  commitRefs: string[];
  timestamps: string[];
  urls: string[];
} {
  const unique = (matches: IterableIterator<RegExpMatchArray>) =>
    [...new Set([...matches].map((match) => match[1]))].sort();
  return {
    headings: unique(contents.matchAll(/^#{1,6}\s+(.+)$/gmu)),
    commitRefs: unique(contents.matchAll(/`([0-9a-f]{7,40})`/gu)),
    timestamps: unique(
      contents.matchAll(
        /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\b/gu,
      ),
    ),
    urls: unique(contents.matchAll(/\b(https?:\/\/[^\s)>]+)/gu)),
  };
}

function matchesExpected(
  outcome: NavigationOutcome,
  expected: NavigationExpected,
): boolean {
  if (outcome.kind !== expected.kind) return false;
  if (outcome.kind === "miss" && expected.kind === "miss") return true;
  if (outcome.kind === "ambiguous" && expected.kind === "ambiguous") {
    return (
      JSON.stringify(outcome.entries.map((entry) => entry.target).sort()) ===
      JSON.stringify([...expected.targets].sort())
    );
  }
  if (
    (outcome.kind === "available" || outcome.kind === "unavailable") &&
    (expected.kind === "available" || expected.kind === "unavailable")
  ) {
    return (
      outcome.entry.title === expected.title &&
      outcome.entry.target === (expected.target ?? expected.intended_target)
    );
  }
  return false;
}

if (import.meta.main) {
  const fixtureName = process.argv[2];
  if (
    !fixtureName ||
    !/^scout-history-projection-[a-z0-9-]+\.json$/u.test(fixtureName)
  ) {
    throw new Error("pass one scout-history-projection-*.json fixture name");
  }
  const appDir = resolve(import.meta.dir, "..");
  const root = resolve(appDir, "../..");
  const fixture = JSON.parse(
    readFileSync(resolve(import.meta.dir, "fixtures", fixtureName), "utf8"),
  ) as ProjectionFixture;
  if (fixture.schema !== "scout.history-projection/v1") {
    throw new Error("unsupported projection fixture schema");
  }
  git(root, [
    "merge-base",
    "--is-ancestor",
    fixture.range.from_exclusive,
    fixture.range.through_inclusive,
  ]);
  git(root, [
    "merge-base",
    "--is-ancestor",
    fixture.range.through_inclusive,
    fixture.frozen_against_tip,
  ]);
  git(root, [
    "merge-base",
    "--is-ancestor",
    fixture.frozen_against_tip,
    "HEAD",
  ]);
  const commits = new Set(
    git(root, [
      "rev-list",
      `${fixture.range.from_exclusive}..${fixture.range.through_inclusive}`,
    ])
      .trim()
      .split("\n")
      .filter(Boolean),
  );
  const allTracked = git(root, ["ls-tree", "-r", "--name-only", "HEAD"])
    .trim()
    .split("\n")
    .filter(Boolean);
  const tracked = allTracked.filter((path) =>
    path.startsWith("projects/scout-knowledge-lib/"),
  );
  const trackedSet = new Set(allTracked);
  const projected = new Map<string, ProjectedBlame>();

  for (const path of fixture.projected_files) {
    if (!trackedSet.has(path))
      throw new Error(`projected file is not tracked: ${path}`);
    const original = git(root, ["show", `HEAD:${path}`]);
    projected.set(
      path,
      projectPorcelainBlame(
        git(root, ["blame", "--line-porcelain", "HEAD", "--", path]),
        commits,
        original.endsWith("\n"),
      ),
    );
  }

  const markdownPaths = tracked.filter((path) => path.endsWith(".md"));
  const documents = markdownPaths.map((path) => ({
    path: resolve(root, path),
    contents:
      projected.get(path)?.contents ?? git(root, ["show", `HEAD:${path}`]),
  }));
  const pathExists = (absolutePath: string) => {
    const path = relative(root, absolutePath);
    return (
      trackedSet.has(path) ||
      allTracked.some((candidate) => candidate.startsWith(`${path}/`))
    );
  };
  const links = inspectRelativeLinks(documents, pathExists);

  const index = parseNavigationEntries(
    git(root, ["show", "HEAD:projects/scout-knowledge-lib/knowledge/INDEX.md"]),
  );
  const navigation = fixture.navigation_fixtures.map((name) => {
    if (!/^scout-navigation-heldout-v\d+\.json$/u.test(name)) {
      throw new Error(`invalid navigation fixture name: ${name}`);
    }
    const heldout = JSON.parse(
      readFileSync(resolve(import.meta.dir, "fixtures", name), "utf8"),
    ) as NavigationFixture;
    const passed = heldout.cases.filter((testCase) =>
      matchesExpected(navigate(testCase.query, index), testCase.expected),
    ).length;
    return { fixture: name, passed, total: heldout.cases.length };
  });

  const retainedCorpus = documents
    .map((document) => document.contents)
    .join("\n");
  const files = [...projected.entries()].map(([path, result]) => {
    const removed = result.removedLines.join("\n");
    const inventory = literalInventory(removed);
    const absent = (values: string[]) =>
      values.filter((value) => !retainedCorpus.includes(value));
    return {
      path,
      removed_lines: result.removedLines.length,
      removed_bytes: Buffer.byteLength(removed),
      removed_by_commit: result.removedByCommit,
      removed_literals: {
        headings: inventory.headings.length,
        commit_refs: inventory.commitRefs.length,
        timestamps: inventory.timestamps.length,
        urls: inventory.urls.length,
      },
      absent_after_projection: {
        headings: absent(inventory.headings),
        commit_refs: absent(inventory.commitRefs),
        timestamps: absent(inventory.timestamps),
        urls: absent(inventory.urls),
      },
    };
  });
  const absentAfterProjection = {
    headings: [
      ...new Set(
        files.flatMap((file) => file.absent_after_projection.headings),
      ),
    ].sort(),
    commit_refs: [
      ...new Set(
        files.flatMap((file) => file.absent_after_projection.commit_refs),
      ),
    ].sort(),
    timestamps: [
      ...new Set(
        files.flatMap((file) => file.absent_after_projection.timestamps),
      ),
    ].sort(),
    urls: [
      ...new Set(files.flatMap((file) => file.absent_after_projection.urls)),
    ].sort(),
  };
  const result = {
    schema: fixture.schema,
    head: git(root, ["rev-parse", "HEAD"]).trim(),
    frozen_against_tip: fixture.frozen_against_tip,
    range: fixture.range,
    removed_commit_count: commits.size,
    files,
    totals: {
      removed_lines: files.reduce(
        (total, file) => total + file.removed_lines,
        0,
      ),
      removed_bytes: files.reduce(
        (total, file) => total + file.removed_bytes,
        0,
      ),
    },
    absent_literal_counts: {
      headings: absentAfterProjection.headings.length,
      commit_refs: absentAfterProjection.commit_refs.length,
      timestamps: absentAfterProjection.timestamps.length,
      urls: absentAfterProjection.urls.length,
    },
    absent_after_projection: absentAfterProjection,
    navigation,
    broad_links: {
      ok: links.ok,
      documents: documents.length,
      checked: links.checked,
      errors: links.errors,
    },
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!links.ok) process.exitCode = 1;
}
