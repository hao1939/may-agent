import { spawnSync } from "node:child_process";

export type ScenarioNormalizationInput = {
  loopId?: unknown;
  scenarioTestPath?: unknown;
  adapterPath?: unknown;
  specId?: unknown;
  specIds?: unknown;
};

export type ScenarioNormalizationInvariant = {
  path: string;
  kind: "plain-carrier" | "missing-adapter";
  stillListed: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function scenarioNormalizationSpecIds(
  input: ScenarioNormalizationInput | undefined,
): string[] {
  if (!input) return [];
  const values = [
    ...(Array.isArray(input.specIds) ? input.specIds : []),
    ...text(input.specId).split(","),
  ];
  return [
    ...new Set(values.map((value) => text(value)).filter(Boolean)),
  ].sort();
}

export function isRunnableScenarioNormalization(
  input: ScenarioNormalizationInput | undefined,
): boolean {
  return (
    input?.loopId === "scenario-normalization" &&
    scenarioNormalizationSpecIds(input).length > 0
  );
}

export function scenarioNormalizationInvariant(
  workspaceDir: string,
  input: ScenarioNormalizationInput | undefined,
): ScenarioNormalizationInvariant | null {
  if (input?.loopId !== "scenario-normalization") return null;
  const scenarioTestPath = text(input.scenarioTestPath);
  const adapterPath = text(input.adapterPath);
  if (!scenarioTestPath && !adapterPath) return null;

  const result = spawnSync(
    "bun",
    ["scripts/check-scenario-tests.ts", "--strict", "--json"],
    {
      cwd: workspaceDir,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  try {
    const parsed = JSON.parse(result.stdout ?? "") as {
      report?: { missingAdapterFiles?: unknown };
      guard?: {
        remainingSpecReferencedPlainScenarioUnits?: unknown;
        remainingRepoPlainScenarioFiles?: unknown;
      };
    };
    if (scenarioTestPath) {
      const units = Array.isArray(
        parsed.guard?.remainingSpecReferencedPlainScenarioUnits,
      )
        ? parsed.guard.remainingSpecReferencedPlainScenarioUnits
        : [];
      const files = Array.isArray(parsed.guard?.remainingRepoPlainScenarioFiles)
        ? parsed.guard.remainingRepoPlainScenarioFiles
        : [];
      return {
        path: scenarioTestPath,
        kind: "plain-carrier",
        stillListed:
          units.some(
            (unit) =>
              unit &&
              typeof unit === "object" &&
              !Array.isArray(unit) &&
              (unit as { scenarioTestPath?: unknown }).scenarioTestPath ===
                scenarioTestPath,
          ) || files.includes(scenarioTestPath),
      };
    }

    const missingAdapters = Array.isArray(parsed.report?.missingAdapterFiles)
      ? parsed.report.missingAdapterFiles
      : [];
    return {
      path: adapterPath,
      kind: "missing-adapter",
      stillListed: missingAdapters.includes(adapterPath),
    };
  } catch {
    throw new Error(
      `Unable to validate scenario normalization invariant: ${result.stderr || "strict inventory returned invalid JSON"}`,
    );
  }
}
