import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  findOwnedCase,
  listOwnedCases,
  readBenchmark,
  resolveCaseDirectory,
  resolveBenchmarkName,
} from "../src/cases/catalog";
import { validateCaseCatalog } from "../src/cases/validate";
import {
  fingerprintTree,
  fingerprintValue,
  loadLabels,
  loadSuite,
  materializeScenarioOrInlineCase,
} from "../src/loop/store";
import { withTempDir } from "./support/temp-dir";
import { assertOutcomeCompletionApprovalHistory, outcomeCompletionRevisions } from "../benchmarks/outcome-completion/approach-drafts.test";

const root = resolve(import.meta.dirname, ".."),
  archive = join(root, "archive/pre-purpose-layout");
const counts = {
  "bounded-task-completion": 1,
  "user-intent-and-authority": 2,
  "worktree-scope-and-preservation": 2,
  "workflow-ownership": 1,
  "improvement-stage-selection": 1,
  "improvement-routing": 1,
  "outcome-completion": 5,
  "adoption-and-simplicity": 3,
  "repair-and-verification": 3,
  "research-evidence": 4,
  "verified-code-work": 5,
  "intent-and-follow-through": 78,
  "outcome-coordination": 16,
};
function fixture(root: string, benchmark: string, id: string, inline = true) {
  const dir = join(root, "benchmarks", benchmark);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "suite.json"),
    JSON.stringify({
      name: benchmark,
      version: 1,
      purpose: "Fixture purpose",
      case_ids: [id],
      ...(inline
        ? { cases: [{ id, task: "Fixture task", expected: {} }] }
        : {}),
    }),
  );
  return dir;
}

test("122 active cases have one purpose owner, not an agent-owned or global home", () => {
  const entries = listOwnedCases(root);
  expect(entries).toHaveLength(122);
  expect(new Set(entries.map((item) => item.id)).size).toBe(122);
  expect(
    Object.fromEntries(
      Object.keys(counts).map((name) => [
        name,
        entries.filter((item) => item.benchmark === name).length,
      ]),
    ),
  ).toEqual(counts);
  expect(existsSync(join(root, "scenarios"))).toBe(false);
  expect(validateCaseCatalog(root).issues).toEqual([]);
  expect(
    entries.filter((item) => item.suite.core_cases?.includes(item.id)),
  ).toHaveLength(17);
  for (const name of Object.keys(counts)) {
    const { suite, path } = readBenchmark(root, name),
      raw = JSON.parse(readFileSync(path, "utf8"));
    expect(suite.purpose).toBeTruthy();
    expect(suite.defaults?.agent_type).toBeUndefined();
    expect(raw.scenarios).toBeUndefined();
    expect(raw.core_scenarios).toBeUndefined();
  }
});

test("duplicate case ownership is rejected", () =>
  withTempDir((dir) => {
    fixture(dir, "one-purpose", "same-case");
    fixture(dir, "other-purpose", "same-case");
    expect(() => listOwnedCases(dir)).toThrow("exactly one benchmark owner");
  }));

test("a benchmark cannot borrow a foreign case by listing its ID", () =>
  withTempDir((dir) => {
    fixture(dir, "one-purpose", "owned-case");
    fixture(dir, "other-purpose", "owned-case", false);
    expect(() => listOwnedCases(dir)).toThrow();
  }));

test("a case directory cannot point outside its owner", () =>
  withTempDir((dir) => {
    const owner = fixture(dir, "one-purpose", "case-a", false),
      outside = join(dir, "outside");
    mkdirSync(outside);
    mkdirSync(join(owner, "cases"));
    symlinkSync(outside, join(owner, "cases/case-a"));
    expect(() => listOwnedCases(dir)).toThrow("escapes its owning benchmark");
  }));

for (const id of ["forgotten", "namespace/forgotten"]) {
  test(`unlisted directory case is rejected: ${id}`, () =>
    withTempDir((dir) => {
      const owner = fixture(dir, "one-purpose", "case-a"),
        extra = join(owner, "cases", id);
      mkdirSync(extra, { recursive: true });
      writeFileSync(join(extra, "case.json"), "{}");
      expect(() => listOwnedCases(dir)).toThrow("Unlisted case");
    }));
}

test("compatibility does not resurrect agent-named collections or unowned cases", () => {
  expect(resolveBenchmarkName(root, "may-alignment")).toBe(
    "intent-and-follow-through",
  );
  expect(resolveBenchmarkName(root, "core-behavior")).toBe(
    "verified-code-work",
  );
  expect(() => resolveBenchmarkName(root, "bob-judgment")).toThrow(
    "Retired benchmark",
  );
  expect(findOwnedCase(root, "phantom-fix")).toBeUndefined();
  expect(resolveCaseDirectory(root, "phantom-fix", true)).toBe(
    join(archive, "scenarios/phantom-fix"),
  );
  expect(() => resolveCaseDirectory(root, "../outside", true)).toThrow(
    "Invalid case ID",
  );
});

test("directory cases with no fixture files survive a tracked-files-only checkout", () =>
  withTempDir((dir) => {
    const owner = fixture(dir, "one-purpose", "case-a", false),
      body = join(owner, "cases/case-a");
    mkdirSync(body, { recursive: true });
    writeFileSync(join(body, "case.json"), JSON.stringify({ name: "case-a" }));
    writeFileSync(join(body, "task.md"), "A decision without input files");
    writeFileSync(join(body, "expected.json"), "{}");
    const { suite } = readBenchmark(dir, "one-purpose"),
      destination = join(dir, "input");
    materializeScenarioOrInlineCase({
      scenario: "case-a",
      suite,
      sourceBenchmarkDir: owner,
      evaluatorOwner: null,
      destination,
    });
    expect(existsSync(join(destination, "environment"))).toBe(true);
    expect(existsSync(join(body, "environment"))).toBe(false);
  }));

test("active expectations never come from a foreign evaluator overlay", () =>
  withTempDir((dir) => {
    const owner = fixture(dir, "one-purpose", "case-a"),
      evaluator = join(dir, "benchmarks/shared-tools");
    mkdirSync(join(evaluator, "scenarios/case-a"), { recursive: true });
    writeFileSync(
      join(evaluator, "scenarios/case-a/semantic_criteria.md"),
      "Foreign answer key",
    );
    const { suite } = readBenchmark(dir, "one-purpose"),
      destination = join(dir, "input");
    materializeScenarioOrInlineCase({
      scenario: "case-a",
      suite,
      sourceBenchmarkDir: owner,
      evaluatorOwner: evaluator,
      destination,
    });
    expect(existsSync(join(destination, "semantic_criteria.md"))).toBe(false);
  }));

test("materialization rejects escaping fixtures and unregistered case selections", () =>
  withTempDir((dir) => {
    const owner = fixture(dir, "one-purpose", "case-a"),
      { suite } = readBenchmark(dir, "one-purpose");
    suite.cases![0]!.files = { "../../escaped": "Must not be written" };
    const options = {
      suite,
      sourceBenchmarkDir: owner,
      evaluatorOwner: null,
      destination: join(dir, "input"),
    };
    expect(() =>
      materializeScenarioOrInlineCase({ ...options, scenario: "case-a" }),
    ).toThrow("Fixture path escapes");
    expect(existsSync(join(dir, "escaped"))).toBe(false);
    expect(() =>
      materializeScenarioOrInlineCase({ ...options, scenario: "foreign-case" }),
    ).toThrow("is not in this benchmark");
  }));

test("migration preserves all 119 assignments, fixtures, answers and approval records outside explicit versioned calibration revisions", () =>
  withTempDir((temp) => {
    const active = listOwnedCases(root),
      compared = new Set<string>();
    for (const oldName of [
      "may-alignment",
      "may-app-outcome-management",
      "may-judgment",
      "alex-judgment",
      "bob-judgment",
      "tech-lead-judgment",
      "scout-judgment",
      "core-behavior",
    ]) {
      const { suite: previous } = loadSuite(oldName, undefined, archive),
        oldLabels = loadLabels(oldName, previous, archive).catalog!;
      for (const id of previous.scenarios) {
        const current = active.find((item) => item.id === id)!;
        expect(current).toBeDefined();
        compared.add(id);
        const before = join(temp, "before", id),
          after = join(temp, "after", id),
          oldDir = join(archive, "benchmarks", oldName);
        materializeScenarioOrInlineCase({
          scenario: id,
          suite: previous,
          sourceBenchmarkDir: oldDir,
          evaluatorOwner: previous.evaluator
            ? dirname(resolve(oldDir, previous.evaluator))
            : null,
          destination: before,
        });
        materializeScenarioOrInlineCase({
          scenario: id,
          suite: current.suite,
          sourceBenchmarkDir: current.benchmarkDir,
          evaluatorOwner: current.suite.evaluator
            ? dirname(resolve(current.benchmarkDir, current.suite.evaluator))
            : null,
          destination: after,
        });
        for (const file of [
          "task.md",
          "expected.json",
          "environment",
          "semantic_criteria.md",
          "semantic_controls.json",
        ]) {
          const outcomeRevision = outcomeCompletionRevisions[id]?.[file];
          if (outcomeRevision) {
            expect(current.suite.version).toBe(3);
            expect(fingerprintTree(join(before, file))).toBe(outcomeRevision[0]);
            expect(fingerprintTree(join(after, file))).toBe(outcomeRevision[1]);
            continue;
          }
          // Bind exact old/new bytes for justified measurement revisions,
          // including newly added semantic files; keep all other bytes equal.
          const revisions: Record<string, Record<string, [string | null, string | null]>> = {
            "may-judge-act-with-clear-authority": {
              "semantic_criteria.md": [
                "27808dd9dc67960d35ff5cdf233b1f9876f5eb319e901487d72c4b71c28ce566",
                "56f99699e034601e4e293676731a2137e01b82ec7908a560726c4d8a5228835e",
              ],
              "semantic_controls.json": [
                "681ae395726a2a0b5ea137cc25ea1e9bb20aa6c39c36479f27e338a1d382791d",
                "e0071bbe1653e2201727728c7d6b295562dc12621dba82f8a6bc34f6bf22981f",
              ],
            },
            "tech-lead-judge-preserve-creator-test-and-fix-source": {
              "task.md": ["667e252ae7460ffb4fa4e2b02930cf944d6d0f9066eb84a00e26c7d7e8504061", "41ed12b28be47b89327b5b9b3597a6625c3753216b53faa11978ccc856f01c37"],
              "semantic_criteria.md": ["6efc6b88c19a173cb5a2650c609325d41c4a0c4a5393746ac9eb1a884100a598", "c4d284a9433d52c7086c64b59ed9a33b7396e619dec363fa3fc0e7b71ae12fec"],
              "semantic_controls.json": ["4457c8145e85f773eaf7acfca517e151b9cfa10172bb67232f4ad50fc4352e3b", "baa2fe8ad41c2a8af5da924157f343126552fa3903a91a22707c3634a9047c16"],
            },
            "tech-lead-judge-fast-targeted-checks-and-local-commit-boundary": {
              "semantic_criteria.md": [null, "e294a67013be48e51837c01e8a11fb912dc28fa2cf9874ec108e093e20b88932"],
              "semantic_controls.json": [null, "e774b74e4f7b9e716f0c284fc136296a9f380253856bdfb516b0fbadfdc39496"],
            },
          };
          const revised = revisions[id]?.[file];
          if (revised) {
            expect(current.suite.version).toBe(2);
            for (const [directory, hash] of [[before, revised[0]], [after, revised[1]]] as const) {
              expect(existsSync(join(directory, file))).toBe(hash !== null);
              if (hash !== null) expect(fingerprintTree(join(directory, file))).toBe(hash);
            }
          } else {
            expect(existsSync(join(before, file))).toBe(existsSync(join(after, file)));
            if (existsSync(join(before, file))) expect(fingerprintTree(join(after, file))).toBe(
              fingerprintTree(join(before, file)),
            );
          }
        }
        const meta = (dir: string) =>
          JSON.parse(
            readFileSync(
              join(
                dir,
                existsSync(join(dir, "case.json"))
                  ? "case.json"
                  : "scenario.json",
              ),
              "utf8",
            ),
          );
        expect(fingerprintValue(meta(after))).toBe(
          fingerprintValue(meta(before)),
        );
        const currentLabel = loadLabels(current.benchmark, current.suite).catalog!.labels[id]!;
        if (!assertOutcomeCompletionApprovalHistory(id, oldLabels.labels[id]!, currentLabel)) {
          expect(currentLabel).toEqual(oldLabels.labels[id]);
        }
      }
    }
    expect(compared.size).toBe(119);
  }));

for (const args of [
  ["test", "--benchmark", "verified-code-work", "--core"], // No target: do not infer an agent from folder names.
  ["test", "--case", "phantom-fix", "--target", "tech-lead"], // Legacy is not an active benchmark.
  [
    "test",
    "--case",
    "may-judge-act-with-clear-authority",
    "--case",
    "scout-judge-complete-supported-evidence-check",
    "--target",
    "may",
  ],
  [
    "test",
    "--benchmark",
    "research-evidence",
    "--case",
    "may-judge-act-with-clear-authority",
    "--target",
    "may",
  ],
]) {
  test(`invalid selection fails before a run or model call: ${args.join(" ")}`, () =>
    withTempDir((dir) => {
      const state = join(dir, "must-not-execute");
      const child = Bun.spawnSync(
        ["bun", join(root, "src/loop/cli.ts"), ...args],
        {
          env: { ...process.env, GYM_STATE_DIR: state },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(child.exitCode).not.toBe(0);
      expect(existsSync(state)).toBe(false);
    }));
}
