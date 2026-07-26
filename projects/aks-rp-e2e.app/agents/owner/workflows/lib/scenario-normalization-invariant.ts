import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ScenarioNormalizationInput = {
  loopId?: unknown;
  originDevCommit?: unknown;
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

export type SourceOnlyNormalizationPosture = {
  accepted: boolean;
  specIds: string[];
  evidence: string[];
  missingSpecIds: string[];
  rejectedSpecIds: string[];
};

export type ScenarioNormalizationTerminalDisposition = {
  specId: string;
  status: string;
  specState: string;
};

export type ScenarioNormalizationTerminalDispositionCheck = {
  accepted: boolean;
  evidence: string[];
  problem?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function loadFeatureSpecs(
  workspaceDir: string,
): Map<string, { path: string; body: Record<string, unknown> }> {
  const featuresDir = join(workspaceDir, "features");
  const specs = new Map<
    string,
    { path: string; body: Record<string, unknown> }
  >();
  if (!existsSync(featuresDir)) return specs;
  for (const feature of readdirSync(featuresDir, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const specsDir = join(featuresDir, feature.name, "specs");
    if (!existsSync(specsDir)) continue;
    for (const entry of readdirSync(specsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const absolutePath = join(specsDir, entry.name);
      try {
        const body = record(JSON.parse(readFileSync(absolutePath, "utf8")));
        const id = text(body.id);
        if (id) {
          specs.set(id, {
            path: `features/${feature.name}/specs/${entry.name}`,
            body,
          });
        }
      } catch {
        // Invalid spec JSON is rejected below as a missing structured posture.
      }
    }
  }
  return specs;
}

export function sourceOnlyScenarioNormalizationPosture(
  workspaceDir: string,
  input: ScenarioNormalizationInput | undefined,
): SourceOnlyNormalizationPosture {
  const specIds = scenarioNormalizationSpecIds(input);
  if (input?.loopId !== "scenario-normalization" || specIds.length === 0) {
    return {
      accepted: false,
      specIds,
      evidence: [],
      missingSpecIds: [],
      rejectedSpecIds: specIds,
    };
  }

  const catalog = loadFeatureSpecs(workspaceDir);
  const evidence: string[] = [];
  const missingSpecIds: string[] = [];
  const rejectedSpecIds: string[] = [];
  for (const specId of specIds) {
    const entry = catalog.get(specId);
    if (!entry) {
      missingSpecIds.push(specId);
      continue;
    }
    const metadata = record(entry.body.metadata);
    const acceptedExecutionPosture = record(metadata.acceptedExecutionPosture);
    const executeMode = record(metadata.executeMode);
    const acceptedDecision = text(
      acceptedExecutionPosture.decision,
    ).toLowerCase();
    const executeStatus = text(executeMode.status).toLowerCase();
    const explicitNonlive =
      acceptedDecision.includes("nonlive") ||
      executeStatus.includes("source-check-only") ||
      executeStatus.includes("nonlive");
    if (metadata.noExecutionCoverageClaim !== true || !explicitNonlive) {
      rejectedSpecIds.push(specId);
      continue;
    }
    evidence.push(`source-only-spec:${specId}`);
    evidence.push(`source-only-spec-path:${entry.path}`);
    evidence.push("source-only-no-execution-coverage:true");
    if (acceptedDecision) {
      evidence.push(`source-only-accepted-decision:${acceptedDecision}`);
    }
    if (executeStatus) {
      evidence.push(`source-only-execute-status:${executeStatus}`);
    }
  }

  return {
    accepted:
      missingSpecIds.length === 0 &&
      rejectedSpecIds.length === 0 &&
      evidence.length > 0,
    specIds,
    evidence: [...new Set(evidence)],
    missingSpecIds,
    rejectedSpecIds,
  };
}

/** Validate an agent's terminal judgment against structured source facts. */
export function scenarioNormalizationTerminalDispositionCheck(
  workspaceDir: string,
  input: ScenarioNormalizationInput | undefined,
  disposition: ScenarioNormalizationTerminalDisposition | undefined,
): ScenarioNormalizationTerminalDispositionCheck {
  if (input?.loopId !== "scenario-normalization") {
    return {
      accepted: false,
      evidence: [],
      problem:
        "terminal-disposition is available only to scenario-normalization work",
    };
  }
  if (!disposition) {
    return {
      accepted: false,
      evidence: [],
      problem:
        "terminal-disposition requires structured specId, status, and specState",
    };
  }

  const selectedSpecIds = scenarioNormalizationSpecIds(input);
  if (
    selectedSpecIds.length !== 1 ||
    selectedSpecIds[0] !== disposition.specId
  ) {
    return {
      accepted: false,
      evidence: [],
      problem: `terminal-disposition specId ${disposition.specId || "(missing)"} does not match the exact selected spec ${selectedSpecIds.join(",") || "(missing)"}`,
    };
  }

  const entry = loadFeatureSpecs(workspaceDir).get(disposition.specId);
  if (!entry) {
    return {
      accepted: false,
      evidence: [],
      problem: `terminal-disposition spec ${disposition.specId} is missing from the normalized source`,
    };
  }
  const sourceStatus = text(entry.body.status);
  const sourceSpecState = text(entry.body.specState);
  if (
    sourceStatus !== disposition.status ||
    sourceSpecState !== disposition.specState
  ) {
    return {
      accepted: false,
      evidence: [],
      problem: `terminal-disposition does not match structured source fields: expected status=${disposition.status}, specState=${disposition.specState}; source has status=${sourceStatus || "(missing)"}, specState=${sourceSpecState || "(missing)"}`,
    };
  }
  if (!sourceStatus || !sourceSpecState) {
    return {
      accepted: false,
      evidence: [],
      problem:
        "terminal-disposition requires non-empty status and specState in the normalized spec",
    };
  }

  return {
    accepted: true,
    evidence: [
      `terminal-disposition-spec:${disposition.specId}`,
      `terminal-disposition-spec-path:${entry.path}`,
      `terminal-disposition-status:${sourceStatus}`,
      `terminal-disposition-spec-state:${sourceSpecState}`,
    ],
  };
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
