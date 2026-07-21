import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export type VerificationStep = {
  label: string;
  command: string;
  status: number;
  output: string;
};

export type LegacyBranchVerification = {
  passed: boolean;
  changedFiles: string[];
  steps: VerificationStep[];
  reason?: string;
};

type CommandResult = { status: number; stdout: string; stderr: string };

function run(
  cwd: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? "",
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
}

function boundedOutput(result: CommandResult): string {
  const text = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return text.length <= 4_000 ? text : text.slice(-4_000);
}

function step(
  cwd: string,
  label: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): VerificationStep {
  const result = run(cwd, command, args, env);
  return {
    label,
    command: [command, ...args].join(" "),
    status: result.status,
    output: boundedOutput(result),
  };
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type ScenarioGuard = {
  missingScenarioFiles?: string[];
  newSpecReferencedPlainScenarioUnits?: Array<{
    scenarioTestPath?: string;
  }>;
  newRepoPlainScenarioFiles?: string[];
};

function scenarioDebt(cwd: string): {
  step: VerificationStep;
  debt: Set<string> | null;
} {
  const result = run(cwd, "bun", [
    "scripts/check-scenario-tests.ts",
    "--guard",
    "--json",
  ]);
  const verificationStep: VerificationStep = {
    label: "scenario-frontier",
    command: "bun scripts/check-scenario-tests.ts --guard --json",
    status: result.status,
    output: boundedOutput(result),
  };
  try {
    const parsed = JSON.parse(result.stdout) as { guard?: ScenarioGuard };
    const guard = parsed.guard ?? {};
    return {
      step: verificationStep,
      debt: new Set([
        ...(guard.missingScenarioFiles ?? []).map((path) => `missing:${path}`),
        ...(guard.newSpecReferencedPlainScenarioUnits ?? []).map(
          (row) => `plain-ref:${row.scenarioTestPath ?? "unknown"}`,
        ),
        ...(guard.newRepoPlainScenarioFiles ?? []).map(
          (path) => `plain-file:${path}`,
        ),
      ]),
    };
  } catch {
    return { step: verificationStep, debt: null };
  }
}

export function runnerDebt(output: string): Set<string> {
  const debt = new Set<string>();
  let section = "runner";
  for (const line of lines(output)) {
    const rerun = line.match(/^==\s+(.+?)\s+failed/);
    if (rerun) {
      section = rerun[1];
      debt.add(`check:${section}`);
      continue;
    }
    const summary = line.match(/^([A-Za-z0-9._-]+):\s+FAILED/);
    if (summary) {
      debt.add(`check:${summary[1]}`);
      continue;
    }
    if (
      /^Running checks /.test(line) ||
      /^fast-checks: FAILED \[\d+ms\]$/.test(line)
    ) {
      continue;
    }
    debt.add(`detail:${section}:${line}`);
  }
  return debt;
}

function newSetEntries(
  candidate: Set<string>,
  baseline: Set<string>,
): string[] {
  return [...candidate].filter((entry) => !baseline.has(entry)).sort();
}

function changedFiles(cwd: string, baseCommit: string): string[] {
  const result = run(cwd, "git", [
    "diff",
    "--name-only",
    "--diff-filter=ACMRT",
    baseCommit,
    "HEAD",
  ]);
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "git diff failed");
  }
  return lines(result.stdout).sort();
}

export function verifyLegacyBranchCandidate(
  workspaceDir: string,
  projectDir: string,
  baseCommit: string,
  baseline: {
    scenarioDebt: Set<string>;
    runnerDebt: Set<string>;
  },
): LegacyBranchVerification {
  const files = changedFiles(workspaceDir, baseCommit);
  const steps: VerificationStep[] = [];
  const nodePath = join(projectDir, "node_modules");
  const checkEnv = {
    AKS_TEST_MODE: "check",
    ...(existsSync(nodePath) ? { NODE_PATH: nodePath } : {}),
  };

  for (const path of files.filter((path) => path.endsWith(".json"))) {
    try {
      JSON.parse(readFileSync(join(workspaceDir, path), "utf8"));
      steps.push({
        label: `json:${path}`,
        command: `parse ${path}`,
        status: 0,
        output: "valid JSON",
      });
    } catch (error) {
      steps.push({
        label: `json:${path}`,
        command: `parse ${path}`,
        status: 1,
        output: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const tests = files.filter(
    (path) => path.startsWith("features/") && path.endsWith(".test.ts"),
  );
  if (tests.length) {
    steps.push(
      step(
        workspaceDir,
        "changed-feature-tests",
        "bun",
        ["test", ...tests.map((path) => `./${path}`), "--timeout", "30000"],
        checkEnv,
      ),
    );
  }

  for (const path of files.filter(
    (path) =>
      path.startsWith("features/") &&
      path.includes("/tests/") &&
      path.endsWith(".ts") &&
      !path.endsWith(".test.ts"),
  )) {
    const text = readFileSync(join(workspaceDir, path), "utf8");
    if (!text.includes("--check") && !text.includes("AKS_TEST_MODE")) {
      steps.push({
        label: `check:${path}`,
        command: `bun ${path} --check`,
        status: 1,
        output: "Changed carrier has no conventional non-mutating check mode",
      });
      continue;
    }
    steps.push(
      step(workspaceDir, `check:${path}`, "bun", [path, "--check"], checkEnv),
    );
  }

  steps.push(
    step(
      workspaceDir,
      "scenario-contract-tests",
      "bun",
      ["test", "./scripts/check-scenario-tests.test.ts"],
      checkEnv,
    ),
  );
  const scenario = scenarioDebt(workspaceDir);
  steps.push(scenario.step);
  if (!scenario.debt) {
    return {
      passed: false,
      changedFiles: files,
      steps,
      reason: "Scenario frontier did not return parseable JSON",
    };
  }
  const newScenarioDebt = newSetEntries(scenario.debt, baseline.scenarioDebt);
  if (newScenarioDebt.length) {
    return {
      passed: false,
      changedFiles: files,
      steps,
      reason: `Candidate introduced scenario debt: ${newScenarioDebt.join(", ")}`,
    };
  }

  const runner = step(
    workspaceDir,
    "repository-runner-check",
    "bun",
    ["runner/check.ts"],
    checkEnv,
  );
  steps.push(runner);
  const newRunnerFailures = newSetEntries(
    runnerDebt(runner.output),
    baseline.runnerDebt,
  );
  if (newRunnerFailures.length) {
    return {
      passed: false,
      changedFiles: files,
      steps,
      reason: `Candidate introduced runner failures: ${newRunnerFailures.join(", ")}`,
    };
  }

  const failed = steps.filter((entry) => {
    if (entry.status === 0) return false;
    if (entry.label === "scenario-frontier") return false;
    if (entry.label === "repository-runner-check") {
      return newRunnerFailures.length > 0;
    }
    return true;
  });
  return {
    passed: failed.length === 0,
    changedFiles: files,
    steps,
    ...(failed.length
      ? {
          reason: `Verification failed: ${failed.map((entry) => entry.label).join(", ")}`,
        }
      : {}),
  };
}

export function captureLegacyVerificationBaseline(workspaceDir: string): {
  scenarioDebt: Set<string>;
  runnerDebt: Set<string>;
  steps: VerificationStep[];
} {
  const scenario = scenarioDebt(workspaceDir);
  if (!scenario.debt) {
    throw new Error(
      "Current origin/dev scenario frontier returned invalid JSON",
    );
  }
  const runner = step(workspaceDir, "baseline-repository-runner-check", "bun", [
    "runner/check.ts",
  ]);
  return {
    scenarioDebt: scenario.debt,
    runnerDebt: runnerDebt(runner.output),
    steps: [scenario.step, runner],
  };
}
