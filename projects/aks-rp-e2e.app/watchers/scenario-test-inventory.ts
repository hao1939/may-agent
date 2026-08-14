import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk/legacy";

export type ScenarioTestInventoryObservation = {
  observedAt: string;
  sourceRef: string;
  sourceCommit: string | null;
  sourceKind: "clean-ref-worktree" | "error";
  state: "clean" | "red" | "error";
  strictPassed: boolean | null;
  activeSpecCount: number;
  referencedPlainActiveSpecCount: number;
  referencedScenarioWithAdapterCount: number;
  directVitestImplementationCount: number;
  remainingSpecReferencedPlainScenarioCount: number;
  remainingRepoPlainScenarioFileCount: number;
  missingAdapterFiles: string[];
  error?: string;
};

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function baseObservation(error: string): ScenarioTestInventoryObservation {
  return {
    observedAt: new Date().toISOString(),
    sourceRef: "origin/dev",
    sourceCommit: null,
    sourceKind: "error",
    state: "error",
    strictPassed: null,
    activeSpecCount: 0,
    referencedPlainActiveSpecCount: 0,
    referencedScenarioWithAdapterCount: 0,
    directVitestImplementationCount: 0,
    remainingSpecReferencedPlainScenarioCount: 0,
    remainingRepoPlainScenarioFileCount: 0,
    missingAdapterFiles: [],
    error,
  };
}

export function parseScenarioTestInventory(
  stdout: string,
  commandStatus: number | null,
  stderr = "",
  source: {
    ref?: string;
    commit?: string | null;
    kind?: ScenarioTestInventoryObservation["sourceKind"];
  } = {},
): ScenarioTestInventoryObservation {
  try {
    const parsed = JSON.parse(stdout) as {
      report?: Record<string, unknown>;
      guard?: Record<string, unknown>;
    };
    const report = parsed.report ?? {};
    const guard = parsed.guard ?? {};
    if (typeof guard.passed !== "boolean") {
      throw new Error("strict inventory output is missing guard.passed");
    }
    const missingAdapterFiles = Array.isArray(report.missingAdapterFiles)
      ? report.missingAdapterFiles.filter(
          (value): value is string =>
            typeof value === "string" && Boolean(value),
        )
      : [];
    const remainingSpecReferencedPlainScenarioCount = Array.isArray(
      guard.remainingSpecReferencedPlainScenarioUnits,
    )
      ? guard.remainingSpecReferencedPlainScenarioUnits.length
      : 0;
    const remainingRepoPlainScenarioFileCount = Array.isArray(
      guard.remainingRepoPlainScenarioFiles,
    )
      ? guard.remainingRepoPlainScenarioFiles.length
      : 0;
    return {
      observedAt:
        typeof report.generatedAt === "string"
          ? report.generatedAt
          : new Date().toISOString(),
      sourceRef: source.ref ?? "origin/dev",
      sourceCommit: source.commit ?? null,
      sourceKind: source.kind ?? "clean-ref-worktree",
      state: guard.passed ? "clean" : "red",
      strictPassed: guard.passed,
      activeSpecCount: numberField(report.activeSpecCount),
      referencedPlainActiveSpecCount: numberField(
        report.referencedPlainActiveSpecCount,
      ),
      referencedScenarioWithAdapterCount: numberField(
        report.referencedScenarioWithAdapterCount,
      ),
      directVitestImplementationCount: numberField(
        report.directVitestImplementationCount,
      ),
      remainingSpecReferencedPlainScenarioCount,
      remainingRepoPlainScenarioFileCount,
      missingAdapterFiles,
      ...(commandStatus === null || (commandStatus !== 0 && guard.passed)
        ? {
            state: "error" as const,
            error:
              stderr.trim() ||
              (commandStatus === null
                ? "strict inventory did not exit normally"
                : `strict inventory exited ${commandStatus} after reporting clean`),
          }
        : {}),
    };
  } catch (error) {
    return baseObservation(
      stderr.trim() || (error instanceof Error ? error.message : String(error)),
    );
  }
}

export function scenarioTestInventoryObservationEvent(
  observation: ScenarioTestInventoryObservation,
): ProjectAppEvent {
  return {
    type: "aks.scenario-test-inventory.observed",
    source: "aks-scenario-test-inventory-watcher",
    target: { project: "aks-rp-e2e" },
    data: {
      project: "aks-rp-e2e",
      observation,
    },
  };
}

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          status: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          ...(error ? { error } : {}),
        });
      },
    );
  });
}

/** Observe strict inventory and emit a semantic fact; never reads or changes task state. */
export async function observeScenarioTestInventory(
  ctx: ProjectAppContext,
): Promise<unknown> {
  const projectDir = ctx.appPath("../aks-rp-e2e");
  const sourceRef = "origin/dev";
  let worktreeDir: string | null = null;
  let observation: ScenarioTestInventoryObservation;

  try {
    const fetch = await run(
      "git",
      ["fetch", "origin", "dev", "--quiet"],
      projectDir,
    );
    if (fetch.status !== 0) {
      observation = baseObservation(
        fetch.stderr?.trim() ||
          fetch.error?.message ||
          `git fetch origin dev exited ${String(fetch.status)}`,
      );
    } else {
      const rev = await run(
        "git",
        ["rev-parse", "--verify", sourceRef],
        projectDir,
      );
      const sourceCommit = rev.stdout?.trim() || null;
      if (rev.status !== 0 || !sourceCommit) {
        observation = baseObservation(
          rev.stderr?.trim() ||
            rev.error?.message ||
            `git rev-parse --verify ${sourceRef} exited ${String(rev.status)}`,
        );
      } else {
        worktreeDir = mkdtempSync(join(tmpdir(), "aks-scenario-inventory-"));
        const add = await run(
          "git",
          ["worktree", "add", "--detach", worktreeDir, sourceRef],
          projectDir,
        );
        if (add.status !== 0) {
          observation = baseObservation(
            add.stderr?.trim() ||
              add.error?.message ||
              `git worktree add ${sourceRef} exited ${String(add.status)}`,
          );
        } else {
          const result = await run(
            "bun",
            ["scripts/check-scenario-tests.ts", "--strict", "--json"],
            worktreeDir,
          );
          observation = parseScenarioTestInventory(
            result.stdout ?? "",
            result.status,
            result.stderr || result.error?.message || "",
            {
              ref: sourceRef,
              commit: sourceCommit,
              kind: "clean-ref-worktree",
            },
          );
        }
      }
    }
  } finally {
    if (worktreeDir) {
      const removed = await run(
        "git",
        ["worktree", "remove", "--force", worktreeDir],
        projectDir,
      );
      if (removed.status !== 0) {
        rmSync(worktreeDir, { recursive: true, force: true });
      }
    }
  }

  ctx.emit(scenarioTestInventoryObservationEvent(observation));
  return {
    observed: observation.state,
    sourceRef: observation.sourceRef,
    sourceCommit: observation.sourceCommit,
    missingAdapterCount: observation.missingAdapterFiles.length,
  };
}
