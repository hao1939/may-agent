import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type InventoryScenarioSignals = {
  hasCheckModeGuard?: unknown;
  hasExecuteFlag?: unknown;
  hasMutationGateEnv?: unknown;
  writesArchiveEvidence?: unknown;
  hasCleanupSignal?: unknown;
  mentionsSharedFixture?: unknown;
  hasHardCodedSubscriptionDefault?: unknown;
};

export type InventoryRowRecord = {
  specId?: unknown;
  specFile?: unknown;
  featureId?: unknown;
  scenarioTestPath?: unknown;
  adapterPath?: unknown;
  directVitestImplementation?: unknown;
  scenarioSignals?: unknown;
};

export type QualityIssue = {
  code: string;
  detail: string;
};

export const qualityStructuralIssueCodes = [
  "missing-check-mode-guard",
  "missing-execute-flag",
  "missing-mutation-gate-env",
  "hard-coded-target-fallback",
  "missing-cleanup-or-fixture-ownership",
  "missing-learn-api-grounding",
  "migration-only-scaffolding",
] as const;

export type ScenarioQualityInput = {
  normalizationScope?: unknown;
  scenarioTestPath?: unknown;
  specId?: unknown;
  specIds?: unknown;
  qualityIssueCodes?: unknown;
};

export type ScenarioQualityInvariant = {
  applies: boolean;
  accepted: boolean;
  citedIssueCodes: string[];
  currentIssueCodes: string[];
  remainingIssueCodes: string[];
  evidence: string[];
  problem?: string;
};

type ScenarioInventory = {
  report?: { rows?: unknown };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .map((entry) => entry.trim())
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function selectedSpecIds(input: ScenarioQualityInput | undefined): string[] {
  if (!input) return [];
  return [
    ...new Set([
      ...stringList(input.specIds),
      ...text(input.specId)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ]),
  ].sort();
}

function citedStructuralIssueCodes(
  input: ScenarioQualityInput | undefined,
): string[] {
  return [
    ...new Set(
      stringList(input?.qualityIssueCodes).filter(
        (code) => code !== "current-source-staging-live-proof",
      ),
    ),
  ].sort();
}

function isOfficialGroundingRef(value: string): boolean {
  const ref = value.trim();
  if (!ref) return false;
  if (/^https:\/\/learn\.microsoft\.com\//i.test(ref)) return true;
  return /^https:\/\/(?:raw\.)?githubusercontent\.com\//i.test(ref)
    ? /\/azure-rest-api-specs\//i.test(ref)
    : /^https:\/\/github\.com\//i.test(ref) &&
        /\/azure\/azure-rest-api-specs(?:\/|$)/i.test(ref);
}

function scenarioSignals(value: unknown): Required<InventoryScenarioSignals> {
  const raw = record(value);
  return {
    hasCheckModeGuard: raw.hasCheckModeGuard === true,
    hasExecuteFlag: raw.hasExecuteFlag === true,
    hasMutationGateEnv: raw.hasMutationGateEnv === true,
    writesArchiveEvidence: raw.writesArchiveEvidence === true,
    hasCleanupSignal: raw.hasCleanupSignal === true,
    mentionsSharedFixture: raw.mentionsSharedFixture === true,
    hasHardCodedSubscriptionDefault:
      raw.hasHardCodedSubscriptionDefault === true,
  };
}

export function migrationOnlyScaffolding(
  scenarioText: string,
  scenarioTestPath: string,
): boolean {
  const legacyPath = scenarioTestPath.replace(/\.test\.ts$/, ".ts");
  if (/vitest-scenario-adapter/.test(scenarioText)) return true;
  if (
    scenarioText.includes(legacyPath) &&
    /(execFile|spawn|run\(|bun",\s*\[|bun',\s*\[|bun`)/.test(scenarioText)
  ) {
    return true;
  }
  return (
    /--execute/.test(scenarioText) &&
    /(execFile|spawn|run\(|promisify\(execFile\))/.test(scenarioText) &&
    /\.ts["'`]/.test(scenarioText)
  );
}

export function directCarrierQualityIssues(
  worktreeDir: string,
  row: InventoryRowRecord,
): QualityIssue[] {
  const scenarioTestPath = String(row.scenarioTestPath ?? "").trim();
  if (!scenarioTestPath.endsWith(".test.ts")) return [];

  const specFile = String(row.specFile ?? "").trim();
  let specBody: Record<string, unknown> = {};
  if (specFile) {
    try {
      specBody = record(
        JSON.parse(readFileSync(join(worktreeDir, specFile), "utf8")),
      );
    } catch {
      specBody = {};
    }
  }
  const scenarioPath = join(worktreeDir, scenarioTestPath);
  const scenarioText = existsSync(scenarioPath)
    ? readFileSync(scenarioPath, "utf8")
    : "";
  const signals = scenarioSignals(row.scenarioSignals);
  const issues: QualityIssue[] = [];

  if (!signals.hasCheckModeGuard) {
    issues.push({
      code: "missing-check-mode-guard",
      detail:
        "Direct .test.ts carrier lacks an explicit nonmutating check-mode guard.",
    });
  }
  if (!signals.hasExecuteFlag) {
    issues.push({
      code: "missing-execute-flag",
      detail:
        "Direct .test.ts carrier does not expose an explicit execute/live mode.",
    });
  }
  if (!signals.hasMutationGateEnv) {
    issues.push({
      code: "missing-mutation-gate-env",
      detail:
        "Direct .test.ts carrier lacks the explicit AKS_RP_E2E_ALLOW_CLOUD_MUTATION safety gate.",
    });
  }
  if (signals.hasHardCodedSubscriptionDefault) {
    issues.push({
      code: "hard-coded-target-fallback",
      detail:
        "Direct .test.ts carrier still falls back to a hard-coded target/subscription default.",
    });
  }

  const clusterLifecycle = record(specBody.clusterLifecycle);
  const hasFixtureOwnership =
    typeof clusterLifecycle.fixtureOwnership === "string" &&
    clusterLifecycle.fixtureOwnership.trim().length > 0;
  const hasSharedFixtureFlag =
    typeof clusterLifecycle.sharedClusterFixture === "boolean";
  const hasCleanupPolicy =
    (typeof clusterLifecycle.cleanup === "string" &&
      clusterLifecycle.cleanup.trim().length > 0) ||
    (Array.isArray(specBody.cleanup) && specBody.cleanup.length > 0);
  if (
    !hasFixtureOwnership &&
    !hasSharedFixtureFlag &&
    !hasCleanupPolicy &&
    !signals.hasCleanupSignal &&
    !signals.mentionsSharedFixture
  ) {
    issues.push({
      code: "missing-cleanup-or-fixture-ownership",
      detail:
        "Spec/direct-carrier contract does not declare explicit cleanup or fixture ownership.",
    });
  }

  const candidateRefs = stringList(specBody.sourceRefs);
  if (!candidateRefs.some(isOfficialGroundingRef)) {
    const sourceScenario = record(specBody.sourceScenario);
    const sourceScenarioCandidates = [
      sourceScenario.id,
      sourceScenario.title,
      sourceScenario.suite,
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
    const candidateDetails = [
      candidateRefs.length > 0
        ? `sourceRefs=${candidateRefs.join(",")}`
        : "sourceRefs=none",
      sourceScenarioCandidates.length > 0
        ? `sourceScenario=${sourceScenarioCandidates.join(",")}`
        : "sourceScenario=none",
    ].join("; ");
    issues.push({
      code: "missing-learn-api-grounding",
      detail: `Spec lacks official Learn/API grounding for the direct .test.ts carrier; candidate facts: ${candidateDetails}.`,
    });
  }

  if (migrationOnlyScaffolding(scenarioText, scenarioTestPath)) {
    issues.push({
      code: "migration-only-scaffolding",
      detail:
        "Direct .test.ts carrier still behaves like migration-only wrapper/scaffolding instead of a standalone implementation.",
    });
  }

  return issues;
}

export function evaluateScenarioQualityInvariant(
  worktreeDir: string,
  input: ScenarioQualityInput | undefined,
  inventory: ScenarioInventory,
): ScenarioQualityInvariant {
  const citedIssueCodes = citedStructuralIssueCodes(input);
  const scenarioTestPath = text(input?.scenarioTestPath);
  const specIds = selectedSpecIds(input);
  const applies =
    input?.normalizationScope === "quality" && citedIssueCodes.length > 0;
  const baseEvidence = [
    `quality-invariant-scope:${text(input?.normalizationScope) || "none"}`,
    ...(scenarioTestPath
      ? [`quality-invariant-scenario:${scenarioTestPath}`]
      : []),
    ...citedIssueCodes.map((code) => `quality-invariant-cited:${code}`),
  ];
  if (!applies) {
    return {
      applies: false,
      accepted: true,
      citedIssueCodes,
      currentIssueCodes: [],
      remainingIssueCodes: [],
      evidence: baseEvidence,
    };
  }

  const supportedCodes = new Set<string>(qualityStructuralIssueCodes);
  const unsupportedCodes = citedIssueCodes.filter(
    (code) => !supportedCodes.has(code),
  );
  if (unsupportedCodes.length > 0) {
    return {
      applies: true,
      accepted: false,
      citedIssueCodes,
      currentIssueCodes: [],
      remainingIssueCodes: unsupportedCodes,
      evidence: [
        ...baseEvidence,
        ...unsupportedCodes.map(
          (code) => `quality-invariant-unsupported:${code}`,
        ),
      ],
      problem: `quality task cites unsupported structural issue codes: ${unsupportedCodes.join(", ")}`,
    };
  }
  if (!scenarioTestPath || specIds.length === 0) {
    return {
      applies: true,
      accepted: false,
      citedIssueCodes,
      currentIssueCodes: [],
      remainingIssueCodes: citedIssueCodes,
      evidence: [...baseEvidence, "quality-invariant-finding:missing-scope"],
      problem:
        "quality task requires one exact scenarioTestPath and at least one exact spec id",
    };
  }

  const rows = Array.isArray(inventory.report?.rows)
    ? inventory.report.rows.map((row) => record(row) as InventoryRowRecord)
    : [];
  const matchingRows = rows.filter(
    (row) =>
      text(row.scenarioTestPath) === scenarioTestPath &&
      specIds.includes(text(row.specId)),
  );
  const representedSpecIds = new Set(
    matchingRows.map((row) => text(row.specId)).filter(Boolean),
  );
  const missingSpecIds = specIds.filter(
    (specId) => !representedSpecIds.has(specId),
  );
  const currentIssues = matchingRows.flatMap((row) =>
    directCarrierQualityIssues(worktreeDir, row),
  );
  const currentIssueCodes = [
    ...new Set(currentIssues.map((issue) => issue.code)),
  ].sort();
  const currentIssueSet = new Set(currentIssueCodes);
  const remainingIssueCodes = citedIssueCodes.filter((code) =>
    currentIssueSet.has(code),
  );
  const accepted =
    matchingRows.length > 0 &&
    missingSpecIds.length === 0 &&
    remainingIssueCodes.length === 0;
  const problem =
    missingSpecIds.length > 0
      ? `strict quality inventory has no exact ${scenarioTestPath} row for: ${missingSpecIds.join(", ")}`
      : matchingRows.length === 0
        ? `strict quality inventory has no exact rows for ${scenarioTestPath}`
        : remainingIssueCodes.length > 0
          ? `quality task still has cited structural issues: ${remainingIssueCodes.join(", ")}`
          : undefined;

  return {
    applies: true,
    accepted,
    citedIssueCodes,
    currentIssueCodes,
    remainingIssueCodes,
    evidence: [
      ...baseEvidence,
      ...specIds.map((specId) => `quality-invariant-spec:${specId}`),
      ...currentIssueCodes.map((code) => `quality-invariant-current:${code}`),
      ...remainingIssueCodes.map(
        (code) => `quality-invariant-remaining:${code}`,
      ),
      ...missingSpecIds.map(
        (specId) => `quality-invariant-missing-spec:${specId}`,
      ),
      `quality-invariant-accepted:${String(accepted)}`,
    ],
    ...(problem ? { problem } : {}),
  };
}

export function scenarioQualityInvariant(
  worktreeDir: string,
  input: ScenarioQualityInput | undefined,
): ScenarioQualityInvariant {
  const citedIssueCodes = citedStructuralIssueCodes(input);
  if (input?.normalizationScope !== "quality" || citedIssueCodes.length === 0) {
    return evaluateScenarioQualityInvariant(worktreeDir, input, {});
  }

  const result = spawnSync(
    "bun",
    ["scripts/check-scenario-tests.ts", "--strict", "--json"],
    {
      cwd: worktreeDir,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  try {
    return evaluateScenarioQualityInvariant(
      worktreeDir,
      input,
      JSON.parse(result.stdout ?? "") as ScenarioInventory,
    );
  } catch {
    return {
      applies: true,
      accepted: false,
      citedIssueCodes,
      currentIssueCodes: [],
      remainingIssueCodes: citedIssueCodes,
      evidence: [
        "quality-invariant-finding:invalid-strict-inventory",
        ...citedIssueCodes.map((code) => `quality-invariant-remaining:${code}`),
      ],
      problem: `unable to evaluate exact quality invariant: ${result.stderr || "strict inventory returned invalid JSON"}`,
    };
  }
}
