import { spawnSync } from "node:child_process";
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk";

export type ScenarioTestInventoryObservation = {
  observedAt: string;
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

export function parseScenarioTestInventory(
  stdout: string,
  commandStatus: number | null,
  stderr = "",
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
    return {
      observedAt: new Date().toISOString(),
      state: "error",
      strictPassed: null,
      activeSpecCount: 0,
      referencedPlainActiveSpecCount: 0,
      referencedScenarioWithAdapterCount: 0,
      directVitestImplementationCount: 0,
      remainingSpecReferencedPlainScenarioCount: 0,
      remainingRepoPlainScenarioFileCount: 0,
      missingAdapterFiles: [],
      error:
        stderr.trim() ||
        (error instanceof Error ? error.message : String(error)),
    };
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

/** Observe strict inventory and emit a semantic fact; never reads or mutates task state. */
export async function observeScenarioTestInventory(
  ctx: ProjectAppContext,
): Promise<unknown> {
  const result = spawnSync(
    "bun",
    ["scripts/check-scenario-tests.ts", "--strict", "--json"],
    {
      cwd: ctx.appPath("../aks-rp-e2e"),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const observation = parseScenarioTestInventory(
    result.stdout ?? "",
    result.status,
    result.stderr || result.error?.message || "",
  );
  ctx.emit(scenarioTestInventoryObservationEvent(observation));
  return {
    observed: observation.state,
    missingAdapterCount: observation.missingAdapterFiles.length,
  };
}
