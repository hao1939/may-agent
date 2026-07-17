import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type MaintainedSurfaceKind =
  | "spec.probeRef"
  | "spec.implementation.path"
  | "packet.probeRef"
  | "packet.replayRef"
  | "packet.path"
  | "compact.replay"
  | "compact.scenarioTestPath";

type MaintainedSurfaceRef = {
  kind: MaintainedSurfaceKind;
  file: string;
  referencedPath: string;
};

export type FeatureScenarioCarrierViolation = {
  code:
    | "feature-scenario-carrier-plain-output"
    | "feature-scenario-carrier-maintained-surface-points-plain"
    | "feature-scenario-carrier-direct-has-plain-sibling"
    | "feature-scenario-carrier-wrapper-plus-plain";
  scenarioBase: string;
  summary: string;
  files: string[];
};

const FEATURE_TEST_PATH_RE = /^features\/[^/]+\/tests\/[^/]+\.(?:test\.ts|ts)$/;
const SPEC_PATH_RE = /^features\/[^/]+\/specs\/[^/]+\.json$/;
const PACKET_PATH_RE = /^features\/[^/]+\/packets\/[^/]+\.ya?ml$/;
const COMPACT_PATH_RE = /^features\/[^/]+\/compact\/[^/]+\.json$/;

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function uniq(values: string[]): string[] {
  return [
    ...new Set(values.map((value) => normalizePath(value)).filter(Boolean)),
  ];
}

function fileExists(projectDir: string, relativePath: string): boolean {
  return existsSync(resolve(projectDir, relativePath));
}

function readText(projectDir: string, relativePath: string): string {
  return readFileSync(resolve(projectDir, relativePath), "utf8");
}

function isFeatureTestPath(relativePath: string): boolean {
  return FEATURE_TEST_PATH_RE.test(normalizePath(relativePath));
}

function isDirectCarrierPath(relativePath: string): boolean {
  return (
    isFeatureTestPath(relativePath) &&
    normalizePath(relativePath).endsWith(".test.ts")
  );
}

function isPlainCarrierPath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  return (
    isFeatureTestPath(normalized) &&
    normalized.endsWith(".ts") &&
    !normalized.endsWith(".test.ts")
  );
}

function scenarioBaseFromCarrierPath(relativePath: string): string | null {
  const normalized = normalizePath(relativePath);
  if (normalized.endsWith(".test.ts"))
    return normalized.slice(0, -".test.ts".length);
  if (normalized.endsWith(".ts")) return normalized.slice(0, -".ts".length);
  return null;
}

function directCarrierPathForBase(scenarioBase: string): string {
  return `${normalizePath(scenarioBase)}.test.ts`;
}

function plainCarrierPathForBase(scenarioBase: string): string {
  return `${normalizePath(scenarioBase)}.ts`;
}

function featureRootForScenarioBase(scenarioBase: string): string {
  const normalized = normalizePath(scenarioBase);
  const parts = normalized.split("/");
  return parts.slice(0, 2).join("/");
}

function listFilesRecursive(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolutePath));
      continue;
    }
    if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

function scenarioCarrierSourceText(text: string): boolean {
  return (
    /(^|\n)\s*#!\/usr\/bin\/env\s+bun\b/.test(text) ||
    /\bconst\s+probeName\b/.test(text) ||
    /\bconst\s+specId\b/.test(text) ||
    /\bAKS_RP_E2E_ALLOW_CLOUD_MUTATION\b/.test(text) ||
    /\bfeatures\/[^/]+\/specs\/[^\s"'`]+\.json\b/.test(text) ||
    /\bSpec:\s*spec\./.test(text) ||
    /\bScenario_[A-Za-z0-9_]+\b/.test(text)
  );
}

function directCarrierIntegrityMarker(text: string): boolean {
  return /\blegacySiblingFsPath\b/.test(text);
}

function wrapperSpawnsSiblingPlainCarrier(
  text: string,
  plainCarrierPath: string,
): boolean {
  return (
    text.includes(plainCarrierPath) &&
    /\b(execFile|execFileSync|spawn|spawnSync)\b/.test(text) &&
    /\b(run|promisify|bun)\b/.test(text)
  );
}

function parseSpecCarrierRefs(
  projectDir: string,
  specPath: string,
): MaintainedSurfaceRef[] {
  try {
    const spec = JSON.parse(readText(projectDir, specPath)) as Record<
      string,
      unknown
    >;
    const implementation =
      spec.implementation &&
      typeof spec.implementation === "object" &&
      !Array.isArray(spec.implementation)
        ? (spec.implementation as Record<string, unknown>)
        : {};
    const refs: MaintainedSurfaceRef[] = [];
    if (typeof spec.probeRef === "string" && isFeatureTestPath(spec.probeRef)) {
      refs.push({
        kind: "spec.probeRef",
        file: specPath,
        referencedPath: normalizePath(spec.probeRef),
      });
    }
    if (
      typeof implementation.path === "string" &&
      isFeatureTestPath(implementation.path)
    ) {
      refs.push({
        kind: "spec.implementation.path",
        file: specPath,
        referencedPath: normalizePath(String(implementation.path)),
      });
    }
    return refs;
  } catch {
    return [];
  }
}

function escapedForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMaintainedSurfaceRefsInText(
  text: string,
  file: string,
  carrierPath: string,
  kinds: MaintainedSurfaceKind[],
): MaintainedSurfaceRef[] {
  const refs: MaintainedSurfaceRef[] = [];
  const escapedPath = escapedForRegex(carrierPath);
  const patterns: Array<{ kind: MaintainedSurfaceKind; re: RegExp }> = [
    {
      kind: "packet.probeRef",
      re: new RegExp(`\\bprobeRef:\\s*${escapedPath}\\b`),
    },
    {
      kind: "packet.replayRef",
      re: new RegExp(`\\breplayRef:\\s*${escapedPath}\\b`),
    },
    { kind: "packet.path", re: new RegExp(`\\bpath:\\s*${escapedPath}\\b`) },
    {
      kind: "compact.replay",
      re: new RegExp(`"replay"\\s*:\\s*"${escapedPath}"`),
    },
    {
      kind: "compact.scenarioTestPath",
      re: new RegExp(`"scenarioTestPath"\\s*:\\s*"${escapedPath}"`),
    },
  ];
  for (const pattern of patterns) {
    if (!kinds.includes(pattern.kind)) continue;
    if (pattern.re.test(text)) {
      refs.push({ kind: pattern.kind, file, referencedPath: carrierPath });
    }
  }
  return refs;
}

function scanFeatureMaintainedSurfaceRefs(
  projectDir: string,
  scenarioBase: string,
  filesToScan?: string[],
): { directRefs: MaintainedSurfaceRef[]; plainRefs: MaintainedSurfaceRef[] } {
  const directCarrierPath = directCarrierPathForBase(scenarioBase);
  const plainCarrierPath = plainCarrierPathForBase(scenarioBase);
  const featureRoot = featureRootForScenarioBase(scenarioBase);
  const candidateFiles = filesToScan
    ? uniq(filesToScan)
    : listFilesRecursive(resolve(projectDir, featureRoot))
        .map((absolutePath) =>
          normalizePath(relative(projectDir, absolutePath)),
        )
        .filter(
          (relativePath) =>
            SPEC_PATH_RE.test(relativePath) ||
            PACKET_PATH_RE.test(relativePath) ||
            COMPACT_PATH_RE.test(relativePath),
        );

  const directRefs: MaintainedSurfaceRef[] = [];
  const plainRefs: MaintainedSurfaceRef[] = [];

  for (const file of candidateFiles) {
    if (SPEC_PATH_RE.test(file)) {
      for (const ref of parseSpecCarrierRefs(projectDir, file)) {
        if (ref.referencedPath === directCarrierPath) directRefs.push(ref);
        if (ref.referencedPath === plainCarrierPath) plainRefs.push(ref);
      }
      continue;
    }
    if (!PACKET_PATH_RE.test(file) && !COMPACT_PATH_RE.test(file)) continue;
    if (!fileExists(projectDir, file)) continue;
    let text = "";
    try {
      text = readText(projectDir, file);
    } catch {
      continue;
    }
    directRefs.push(
      ...findMaintainedSurfaceRefsInText(text, file, directCarrierPath, [
        "packet.probeRef",
        "packet.replayRef",
        "packet.path",
        "compact.replay",
        "compact.scenarioTestPath",
      ]),
    );
    plainRefs.push(
      ...findMaintainedSurfaceRefsInText(text, file, plainCarrierPath, [
        "packet.probeRef",
        "packet.replayRef",
        "packet.path",
        "compact.replay",
        "compact.scenarioTestPath",
      ]),
    );
  }

  return { directRefs, plainRefs };
}

function violationsForScenarioBase(input: {
  projectDir: string;
  scenarioBase: string;
  directContractRequired: boolean;
  outputPaths?: string[];
  maintainedSurfaceFiles?: string[];
  allowPlainSiblingInventory?: boolean;
}): FeatureScenarioCarrierViolation[] {
  const scenarioBase = normalizePath(input.scenarioBase);
  const directCarrierPath = directCarrierPathForBase(scenarioBase);
  const plainCarrierPath = plainCarrierPathForBase(scenarioBase);
  const violations: FeatureScenarioCarrierViolation[] = [];
  const outputPaths = uniq(input.outputPaths ?? []);
  const directCarrierExists = fileExists(input.projectDir, directCarrierPath);
  const plainCarrierExists = fileExists(input.projectDir, plainCarrierPath);
  const directCarrierText = directCarrierExists
    ? readText(input.projectDir, directCarrierPath)
    : "";
  const plainCarrierText = plainCarrierExists
    ? readText(input.projectDir, plainCarrierPath)
    : "";
  const outputIncludesDirectCarrier = outputPaths.includes(directCarrierPath);
  const outputIncludesPlainCarrier = outputPaths.includes(plainCarrierPath);
  const plainOutputLooksScenarioCarrier =
    outputIncludesPlainCarrier &&
    plainCarrierExists &&
    scenarioCarrierSourceText(plainCarrierText);

  const { directRefs, plainRefs } = scanFeatureMaintainedSurfaceRefs(
    input.projectDir,
    scenarioBase,
    input.maintainedSurfaceFiles,
  );
  const directRefsPresent =
    directRefs.length > 0 ||
    input.directContractRequired ||
    outputIncludesDirectCarrier;

  if (plainOutputLooksScenarioCarrier) {
    violations.push({
      code: "feature-scenario-carrier-plain-output",
      scenarioBase,
      summary:
        "Task output includes a new plain feature scenario carrier; newly authored or materially rewritten scenarios must be direct .test.ts files.",
      files: uniq([plainCarrierPath]),
    });
  }

  if (directRefsPresent && plainRefs.length > 0) {
    violations.push({
      code: "feature-scenario-carrier-maintained-surface-points-plain",
      scenarioBase,
      summary:
        "Maintained spec/model/coverage surfaces still point at a plain scenario carrier after the direct .test.ts contract is in play.",
      files: uniq([
        directCarrierPath,
        plainCarrierPath,
        ...plainRefs.map((ref) => ref.file),
      ]),
    });
  }

  if (
    directRefsPresent &&
    plainCarrierExists &&
    !input.allowPlainSiblingInventory
  ) {
    violations.push({
      code: "feature-scenario-carrier-direct-has-plain-sibling",
      scenarioBase,
      summary:
        "Direct feature-owned .test.ts scenario still has a sibling plain .ts carrier; keep one direct carrier only.",
      files: uniq([directCarrierPath, plainCarrierPath]),
    });
  }

  if (
    directRefsPresent &&
    plainCarrierExists &&
    directCarrierExists &&
    wrapperSpawnsSiblingPlainCarrier(directCarrierText, plainCarrierPath)
  ) {
    violations.push({
      code: "feature-scenario-carrier-wrapper-plus-plain",
      scenarioBase,
      summary:
        "Direct .test.ts scenario is only a wrapper that spawns a sibling plain carrier; author one direct feature-owned .test.ts file instead.",
      files: uniq([directCarrierPath, plainCarrierPath]),
    });
  }

  return uniqViolations(violations);
}

function uniqViolations(
  violations: FeatureScenarioCarrierViolation[],
): FeatureScenarioCarrierViolation[] {
  const seen = new Set<string>();
  const deduped: FeatureScenarioCarrierViolation[] = [];
  for (const violation of violations) {
    const key = `${violation.code}::${violation.scenarioBase}::${uniq(violation.files).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...violation,
      files: uniq(violation.files),
    });
  }
  return deduped;
}

function candidateScenarioBasesFromOutputs(
  projectDir: string,
  outputPaths: string[],
): Set<string> {
  const candidates = new Set<string>();
  for (const outputPath of uniq(outputPaths)) {
    if (isFeatureTestPath(outputPath)) {
      const scenarioBase = scenarioBaseFromCarrierPath(outputPath);
      if (scenarioBase) candidates.add(scenarioBase);
      continue;
    }
    if (!SPEC_PATH_RE.test(outputPath) || !fileExists(projectDir, outputPath))
      continue;
    for (const ref of parseSpecCarrierRefs(projectDir, outputPath)) {
      const scenarioBase = scenarioBaseFromCarrierPath(ref.referencedPath);
      if (scenarioBase) candidates.add(scenarioBase);
    }
  }
  return candidates;
}

function relevantMaintainedSurfaceOutputs(
  outputPaths: string[],
  scenarioBase: string,
): string[] {
  const directCarrierPath = directCarrierPathForBase(scenarioBase);
  const plainCarrierPath = plainCarrierPathForBase(scenarioBase);
  return uniq(outputPaths).filter((outputPath) => {
    if (
      SPEC_PATH_RE.test(outputPath) ||
      PACKET_PATH_RE.test(outputPath) ||
      COMPACT_PATH_RE.test(outputPath)
    ) {
      return true;
    }
    return outputPath === directCarrierPath || outputPath === plainCarrierPath;
  });
}

export function featureScenarioCarrierViolationsForTaskOutputs(input: {
  projectDir: string;
  outputPaths: string[];
}): FeatureScenarioCarrierViolation[] {
  const outputPaths = uniq(input.outputPaths);
  const violations: FeatureScenarioCarrierViolation[] = [];
  for (const scenarioBase of candidateScenarioBasesFromOutputs(
    input.projectDir,
    outputPaths,
  )) {
    const directCarrierPath = directCarrierPathForBase(scenarioBase);
    const directContractRequired = outputPaths.includes(directCarrierPath);
    violations.push(
      ...violationsForScenarioBase({
        projectDir: input.projectDir,
        scenarioBase,
        directContractRequired,
        outputPaths,
        maintainedSurfaceFiles: relevantMaintainedSurfaceOutputs(
          outputPaths,
          scenarioBase,
        ),
        allowPlainSiblingInventory: false,
      }),
    );
  }
  return uniqViolations(violations);
}

export function directFeatureScenarioCarrierViolations(
  projectDir: string,
): FeatureScenarioCarrierViolation[] {
  const featuresRoot = resolve(projectDir, "features");
  if (!existsSync(featuresRoot)) return [];
  const violations: FeatureScenarioCarrierViolation[] = [];
  for (const absoluteFile of listFilesRecursive(featuresRoot)) {
    const relativeFile = normalizePath(relative(projectDir, absoluteFile));
    if (!SPEC_PATH_RE.test(relativeFile)) continue;
    const refs = parseSpecCarrierRefs(projectDir, relativeFile);
    for (const ref of refs.filter((entry) =>
      entry.referencedPath.endsWith(".test.ts"),
    )) {
      const scenarioBase = scenarioBaseFromCarrierPath(ref.referencedPath);
      if (!scenarioBase) continue;
      const directCarrierPath = directCarrierPathForBase(scenarioBase);
      if (!fileExists(projectDir, directCarrierPath)) continue;
      const directCarrierText = readText(projectDir, directCarrierPath);
      if (!directCarrierIntegrityMarker(directCarrierText)) continue;
      violations.push(
        ...violationsForScenarioBase({
          projectDir,
          scenarioBase,
          directContractRequired: true,
          maintainedSurfaceFiles: undefined,
          allowPlainSiblingInventory: false,
        }),
      );
    }
  }
  return uniqViolations(violations);
}
