import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captureLegacyVerificationBaseline,
  runnerDebt,
  verifyLegacyBranchCandidate,
} from "./legacy-branch-verifier.ts";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  }).trim();
}

function commit(repo: string, message: string): string {
  git(repo, "add", ".");
  git(repo, "commit", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

function fixture(): string {
  const repo = mkdtempSync(join(tmpdir(), "aks-legacy-verifier-"));
  roots.push(repo);
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "runner"), { recursive: true });
  writeFileSync(
    join(repo, "scenario-debt.json"),
    `${JSON.stringify({
      missingScenarioFiles: [],
      newSpecReferencedPlainScenarioUnits: [],
      newRepoPlainScenarioFiles: ["features/existing/tests/plain.ts"],
    })}\n`,
  );
  writeFileSync(
    join(repo, "runner-debt.json"),
    `${JSON.stringify([
      "features/windows-gpu/compact/staging.plan.json: stale fields",
    ])}\n`,
  );
  writeFileSync(
    join(repo, "scripts", "check-scenario-tests.ts"),
    [
      'const guard = await Bun.file("scenario-debt.json").json();',
      "console.log(JSON.stringify({ guard }));",
      "if (Object.values(guard).some((rows) => Array.isArray(rows) && rows.length)) process.exit(1);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(repo, "scripts", "check-scenario-tests.test.ts"),
    [
      'import { expect, test } from "bun:test";',
      'test("fixture contract", () => expect(true).toBe(true));',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(repo, "runner", "check.ts"),
    [
      'const debt = await Bun.file("runner-debt.json").json();',
      'console.log("Running checks [fixture]...");',
      "if (debt.length) {",
      '  console.log("fast-checks: FAILED [1ms]");',
      '  console.log("== compact-plan-targets failed, re-running for output ==");',
      '  console.log("Compact staging plan target drift detected.");',
      "  for (const row of debt) console.log(`- ${row}`);",
      "  process.exit(1);",
      "}",
      'console.log("All checks passed.");',
      "",
    ].join("\n"),
  );
  writeFileSync(join(repo, "README.md"), "base\n");
  commit(repo, "base");
  return repo;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("legacy branch verifier", () => {
  test("allows existing base debt and rejects new debt in the same runner check", () => {
    const repo = fixture();
    const base = git(repo, "rev-parse", "HEAD");
    const baseline = captureLegacyVerificationBaseline(repo);
    mkdirSync(join(repo, "features", "demo", "tests"), { recursive: true });
    writeFileSync(
      join(repo, "features", "demo", "tests", "demo.test.ts"),
      [
        'import { expect, test } from "bun:test";',
        'test("candidate", () => expect(1).toBe(1));',
        "",
      ].join("\n"),
    );
    commit(repo, "passing candidate");

    expect(
      verifyLegacyBranchCandidate(repo, repo, base, baseline),
    ).toMatchObject({ passed: true });

    const nextBase = git(repo, "rev-parse", "HEAD");
    const nextBaseline = captureLegacyVerificationBaseline(repo);
    writeFileSync(
      join(repo, "runner-debt.json"),
      `${JSON.stringify([
        "features/windows-gpu/compact/staging.plan.json: stale fields",
        "features/demo/compact/staging.plan.json: new stale fields",
      ])}\n`,
    );
    commit(repo, "add runner debt in existing category");
    const result = verifyLegacyBranchCandidate(
      repo,
      repo,
      nextBase,
      nextBaseline,
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("features/demo/compact/staging.plan.json");
  });

  test("rejects new scenario debt", () => {
    const repo = fixture();
    const base = git(repo, "rev-parse", "HEAD");
    const baseline = captureLegacyVerificationBaseline(repo);
    writeFileSync(
      join(repo, "scenario-debt.json"),
      `${JSON.stringify({
        missingScenarioFiles: ["features/demo/tests/missing.test.ts"],
        newSpecReferencedPlainScenarioUnits: [],
        newRepoPlainScenarioFiles: ["features/existing/tests/plain.ts"],
      })}\n`,
    );
    commit(repo, "add scenario debt");
    const result = verifyLegacyBranchCandidate(repo, repo, base, baseline);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain(
      "missing:features/demo/tests/missing.test.ts",
    );
  });

  test("runs changed plain carriers in their check-only mode", () => {
    const repo = fixture();
    let base = git(repo, "rev-parse", "HEAD");
    let baseline = captureLegacyVerificationBaseline(repo);
    mkdirSync(join(repo, "features", "demo", "tests"), { recursive: true });
    writeFileSync(
      join(repo, "features", "demo", "tests", "passing.ts"),
      'if (import.meta.main && process.argv.includes("--check")) process.exit(0);\n',
    );
    commit(repo, "passing check carrier");
    expect(
      verifyLegacyBranchCandidate(repo, repo, base, baseline),
    ).toMatchObject({ passed: true });

    base = git(repo, "rev-parse", "HEAD");
    baseline = captureLegacyVerificationBaseline(repo);
    writeFileSync(
      join(repo, "features", "demo", "tests", "failing.ts"),
      'if (import.meta.main && process.argv.includes("--check")) process.exit(1);\n',
    );
    commit(repo, "failing check carrier");
    const result = verifyLegacyBranchCandidate(repo, repo, base, baseline);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("check:features/demo/tests/failing.ts");
  });

  test("normalizes timing while retaining failure details", () => {
    const first = runnerDebt(
      "Running checks [x]...\nfast-checks: FAILED [1ms]\n== one failed, re-running for output ==\n- a",
    );
    const second = runnerDebt(
      "Running checks [x]...\nfast-checks: FAILED [999ms]\n== one failed, re-running for output ==\n- a\n- b",
    );
    expect([...second].filter((entry) => !first.has(entry))).toEqual([
      "detail:one:- b",
    ]);
  });
});
