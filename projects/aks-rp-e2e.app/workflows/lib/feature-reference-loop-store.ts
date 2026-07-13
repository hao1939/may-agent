import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

export type FeatureReferenceStatus =
  "pending" | "running" | "done" | "blocked" | "error" | "dormant" | "stale";

export type FeatureReferenceLoopHoldState = {
  mode: "dormant-backlog-preserved";
  staleFeatureKeys?: string[];
  dormantFeatureKeys?: string[];
  reopenDefaultFeatureKeys?: string[];
  noRefillNow?: boolean;
  note?: string | null;
  updatedAt?: string;
};

export type FeatureReferenceRecord = {
  featureKey: string;
  packetPath: string;
  packetKind: "capability" | "feature";
  layout:
    | "capability-root"
    | "branch-packet"
    | "legacy-branch-packet"
    | "migration-root-feature";
  capabilityId: string | null;
  coveredFeatureIds: string[];
};

export type FeatureReferenceSuppressionKind =
  "duplicate-churn" | "public-ceiling" | "supporting-context";

export type FeatureReferenceSuppression = {
  kind: FeatureReferenceSuppressionKind;
  note?: string | null;
  updatedAt?: string;
};

export type FeatureReferenceItemState = FeatureReferenceRecord & {
  status: FeatureReferenceStatus;
  taskId?: string | null;
  attempts: number;
  lastOutputPath: string | null;
  lastSummary: string | null;
  suppression?: FeatureReferenceSuppression | null;
  collectorContractVersion?: string | null;
  updatedAt: string;
};

export type FeatureReferenceLoopState = {
  loopTaskId: string;
  windowSize: number;
  cursor: number;
  features: Record<string, FeatureReferenceItemState>;
  holdState?: FeatureReferenceLoopHoldState;
};

export const featureReferenceCollectorContractVersion =
  "refs-v2-official-sections";

export type FeatureReferenceQuality = {
  hasOfficialDocumentation: boolean;
  hasOfficialApiSpec: boolean;
  missing: string[];
};

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function markdownSection(raw: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^##\\s+${escaped}\\s*$`, "im");
  const headingMatch = headingPattern.exec(raw);
  if (!headingMatch) return "";
  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = raw.slice(sectionStart);
  const nextHeading = /^##\s+/m.exec(rest);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

function hasRealReferenceLine(section: string, patterns: RegExp[]): boolean {
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .filter((line) => !/no matching reference found/i.test(line))
    .some((line) => patterns.some((pattern) => pattern.test(line)));
}

export function featureReferenceQuality(raw: string): FeatureReferenceQuality {
  const apiSection = markdownSection(raw, "Official API References");
  const docSection = markdownSection(raw, "Official Documentation References");
  const hasOfficialApiSpec =
    hasRealReferenceLine(apiSection, [
      /azure-rest-api-specs/i,
      /github\.com\/Azure\/azure-rest-api-specs/i,
      /specification\/containerservice/i,
    ]) ||
    /github\.com\/Azure\/azure-rest-api-specs/i.test(raw) ||
    /azure-rest-api-specs\/specification\/containerservice/i.test(raw) ||
    /specification\/containerservice\/[A-Za-z0-9._/-]+\.json/i.test(raw) ||
    /\b(?:managedClusters|agentPools|maintenanceConfigurations|trustedAccessRoleBindings|fleets)\.json\b/i.test(
      raw,
    );
  const hasOfficialDocumentation =
    hasRealReferenceLine(docSection, [
      /learn\.microsoft\.com/i,
      /^-\s+learn\//i,
      /docs\.microsoft\.com/i,
    ]) || /learn\.microsoft\.com/i.test(raw);
  const missing = [
    hasOfficialDocumentation ? "" : "official Microsoft Learn documentation",
    hasOfficialApiSpec ? "" : "Azure REST API spec",
  ].filter(Boolean);
  return { hasOfficialDocumentation, hasOfficialApiSpec, missing };
}

export function featureReferenceOutputQuality(input: {
  projectDir: string;
  outputPath: string | null | undefined;
  visited?: Set<string>;
}): FeatureReferenceQuality {
  if (!input.outputPath) {
    return {
      hasOfficialDocumentation: false,
      hasOfficialApiSpec: false,
      missing: ["feature-reference output file"],
    };
  }
  const absolutePath = input.outputPath.startsWith("/")
    ? input.outputPath
    : join(input.projectDir, input.outputPath);
  if (!existsSync(absolutePath)) {
    return {
      hasOfficialDocumentation: false,
      hasOfficialApiSpec: false,
      missing: [`feature-reference output file ${input.outputPath}`],
    };
  }
  const visited = input.visited ?? new Set<string>();
  if (visited.has(absolutePath)) {
    return featureReferenceQuality(readFileSync(absolutePath, "utf-8"));
  }
  visited.add(absolutePath);
  const raw = readFileSync(absolutePath, "utf-8");
  const direct = featureReferenceQuality(raw);
  if (direct.missing.length === 0) return direct;

  let hasOfficialDocumentation = direct.hasOfficialDocumentation;
  let hasOfficialApiSpec = direct.hasOfficialApiSpec;
  const refs = [
    ...new Set(raw.match(/evidence\/archive\/[A-Za-z0-9._/-]+\.md/g) ?? []),
  ].filter((ref) => ref !== input.outputPath);
  for (const ref of refs) {
    const nested = featureReferenceOutputQuality({
      projectDir: input.projectDir,
      outputPath: ref,
      visited,
    });
    hasOfficialDocumentation ||= nested.hasOfficialDocumentation;
    hasOfficialApiSpec ||= nested.hasOfficialApiSpec;
  }
  const missing = [
    hasOfficialDocumentation ? "" : "official Microsoft Learn documentation",
    hasOfficialApiSpec ? "" : "Azure REST API spec",
  ].filter(Boolean);
  return { hasOfficialDocumentation, hasOfficialApiSpec, missing };
}

export function findPromotableFeatureReferenceOutput(input: {
  projectDir: string;
  featureKey: string;
  outputPath: string | null | undefined;
}): string | null {
  const currentQuality = featureReferenceOutputQuality({
    projectDir: input.projectDir,
    outputPath: input.outputPath,
  });
  if (input.outputPath && currentQuality.missing.length === 0) {
    return input.outputPath;
  }
  const archiveDir = join(input.projectDir, "evidence", "archive");
  if (!existsSync(archiveDir)) return input.outputPath ?? null;
  const featureStem = safeKey(input.featureKey).toLowerCase();
  const candidates = readdirSync(archiveDir)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => name.toLowerCase().includes(featureStem))
    .filter((name) =>
      /public-official|public-reference|official-references|public-authority/i.test(
        name,
      ),
    )
    .map((name) => `evidence/archive/${name}`)
    .sort((a, b) => b.localeCompare(a));
  for (const candidate of candidates) {
    const quality = featureReferenceOutputQuality({
      projectDir: input.projectDir,
      outputPath: candidate,
    });
    if (quality.missing.length === 0) return candidate;
  }
  return input.outputPath ?? null;
}

function statusAfterQualityCheck(input: {
  projectDir: string;
  status: FeatureReferenceStatus;
  outputPath: string | null | undefined;
  suppression?: FeatureReferenceSuppression | null;
}): FeatureReferenceStatus {
  if (input.suppression) return "done";
  const quality = featureReferenceOutputQuality({
    projectDir: input.projectDir,
    outputPath: input.outputPath,
  });
  if (quality.missing.length === 0) return "done";
  if (input.status !== "done") return input.status;
  return "pending";
}

function trimYamlScalar(value: string): string {
  return value
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function yamlScalar(raw: string, key: string): string {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? trimYamlScalar(match[1]) : "";
}

function yamlStringList(raw: string, key: string): string[] {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(new RegExp(`^${key}:`)));
  if (start < 0) return [];
  const first = lines[start].replace(new RegExp(`^${key}:\\s*`), "").trim();
  if (first.startsWith("[") && first.endsWith("]")) {
    return first.slice(1, -1).split(",").map(trimYamlScalar).filter(Boolean);
  }
  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const item = line.match(/^\s*-\s*(.+)$/);
    if (item) values.push(trimYamlScalar(item[1]));
  }
  return values;
}

function fileStem(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
}

function isSupportPacketPath(path: string): boolean {
  const stem = fileStem(path).toLowerCase();
  return (
    stem.includes("source-packet") ||
    stem.includes("source-investigation") ||
    stem.includes("investigation") ||
    stem.includes("fail-analysis")
  );
}

function safeKey(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "feature"
  );
}

function readPacketRecord(input: {
  projectDir: string;
  absolutePath: string;
  layout: FeatureReferenceRecord["layout"];
  fallbackCapabilityId?: string;
  allowFileStemFallback?: boolean;
}): FeatureReferenceRecord | null {
  if (isSupportPacketPath(input.absolutePath)) return null;
  const raw = readFileSync(input.absolutePath, "utf-8");
  const capabilityId =
    yamlScalar(raw, "capabilityId") || input.fallbackCapabilityId || "";
  const featureId = yamlScalar(raw, "featureId");
  const sourcePacketId = yamlScalar(raw, "sourcePacketId");
  const investigationId = yamlScalar(raw, "investigationId");
  if (sourcePacketId || investigationId) return null;
  const isBranchLayout =
    input.layout === "branch-packet" || input.layout === "legacy-branch-packet";
  if (isBranchLayout && !featureId) return null;
  const packetPath = relative(input.projectDir, input.absolutePath);
  const fallbackKey = input.allowFileStemFallback
    ? fileStem(input.absolutePath)
    : "";
  const rootFeatureKey = featureId || capabilityId || fallbackKey;
  if (!featureId && !capabilityId && !input.allowFileStemFallback) return null;
  const layout =
    input.layout === "capability-root" &&
    featureId &&
    !yamlScalar(raw, "capabilityId")
      ? "migration-root-feature"
      : input.layout;
  const resolvedFeatureKey = safeKey(rootFeatureKey);
  if (!resolvedFeatureKey) return null;
  return {
    featureKey: resolvedFeatureKey,
    packetPath,
    packetKind:
      layout === "capability-root" && capabilityId ? "capability" : "feature",
    layout,
    capabilityId: capabilityId || null,
    coveredFeatureIds: yamlStringList(raw, "coveredFeatureIds"),
  };
}

function packetRecordKey(record: FeatureReferenceRecord): string {
  return `${record.featureKey}\0${record.packetPath}`;
}

export function defaultFeatureReferenceLoopStatePath(appDir: string): string {
  return join(appDir, ".state", "feature-reference-loop", "state.json");
}

export function defaultFeatureReferenceDraftDir(projectDir: string): string {
  return join(projectDir, "evidence", "archive");
}

export function safeFeatureReferenceTaskId(featureKey: string): string {
  return safeKey(`collect-feature-reference-${featureKey}`);
}

export function safeFeatureReferenceFileKey(featureKey: string): string {
  return safeKey(featureKey);
}

export function loadFeatureReferencePackets(
  projectDir: string,
): FeatureReferenceRecord[] {
  const featuresDir = join(projectDir, "features");
  if (!existsSync(featuresDir)) return [];
  const records: FeatureReferenceRecord[] = [];

  for (const name of readdirSync(featuresDir)
    .filter((name) => name.endsWith(".yaml"))
    .sort((a, b) => a.localeCompare(b))) {
    const absolutePath = join(featuresDir, name);
    if (!statSync(absolutePath).isFile()) continue;
    const record = readPacketRecord({
      projectDir,
      absolutePath,
      layout: "capability-root",
      allowFileStemFallback: true,
    });
    if (record) records.push(record);
  }

  for (const capabilityDirName of readdirSync(featuresDir).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const capabilityDir = join(featuresDir, capabilityDirName);
    if (!statSync(capabilityDir).isDirectory()) continue;

    const preferredPacketsDir = join(capabilityDir, "packets");
    if (existsSync(preferredPacketsDir)) {
      for (const name of readdirSync(preferredPacketsDir)
        .filter((entry) => entry.endsWith(".yaml"))
        .sort((a, b) => a.localeCompare(b))) {
        const absolutePath = join(preferredPacketsDir, name);
        if (!statSync(absolutePath).isFile()) continue;
        const record = readPacketRecord({
          projectDir,
          absolutePath,
          layout: "branch-packet",
          fallbackCapabilityId: capabilityDirName,
        });
        if (record) records.push(record);
      }
    }

    for (const name of readdirSync(capabilityDir)
      .filter((entry) => entry.endsWith(".yaml"))
      .sort((a, b) => a.localeCompare(b))) {
      const absolutePath = join(capabilityDir, name);
      if (!statSync(absolutePath).isFile()) continue;
      const record = readPacketRecord({
        projectDir,
        absolutePath,
        layout: "legacy-branch-packet",
        fallbackCapabilityId: capabilityDirName,
      });
      if (record) records.push(record);
    }
  }

  const unique = new Map<string, FeatureReferenceRecord>();
  for (const record of records) unique.set(packetRecordKey(record), record);
  return [...unique.values()].sort((a, b) =>
    a.featureKey.localeCompare(b.featureKey),
  );
}

function previousFeatureState(
  previous: Record<string, FeatureReferenceItemState>,
  record: FeatureReferenceRecord,
): FeatureReferenceItemState | undefined {
  return (
    previous[record.featureKey] ??
    Object.values(previous).find(
      (item) => item.packetPath === record.packetPath,
    )
  );
}

export function loadFeatureReferenceLoopState(input: {
  appDir: string;
  projectDir: string;
  loopTaskId: string;
  windowSize: number;
  statePath?: string;
}): { state: FeatureReferenceLoopState; path: string; created: boolean } {
  const path =
    input.statePath ?? defaultFeatureReferenceLoopStatePath(input.appDir);
  const now = new Date().toISOString();
  if (existsSync(path)) {
    const state = readJson<FeatureReferenceLoopState>(path, {
      loopTaskId: input.loopTaskId,
      windowSize: input.windowSize,
      cursor: 0,
      features: {},
    });
    state.loopTaskId ||= input.loopTaskId;
    state.windowSize ||= input.windowSize;
    const previous = state.features || {};
    const holdState = state.holdState;
    const preservedStale = new Set(holdState?.staleFeatureKeys ?? []);
    const preservedDormant = new Set(holdState?.dormantFeatureKeys ?? []);
    const preserveHeldStatuses = holdState?.noRefillNow !== false;
    const features: Record<string, FeatureReferenceItemState> = {};
    for (const record of loadFeatureReferencePackets(input.projectDir)) {
      const existing = previousFeatureState(previous, record);
      const existingTaskId = existing?.taskId ?? null;
      const suppression = existing?.suppression ?? null;
      const existingStatus = suppression
        ? "done"
        : existing?.status === "running" && !existingTaskId
          ? "pending"
          : preserveHeldStatuses && preservedStale.has(record.featureKey)
            ? "stale"
            : preserveHeldStatuses && preservedDormant.has(record.featureKey)
              ? "dormant"
              : existing?.status === "stale" || existing?.status === "dormant"
                ? "pending"
                : existing?.status === "blocked"
                  ? "error"
                  : (existing?.status ?? "pending");
      const promotedOutputPath = findPromotableFeatureReferenceOutput({
        projectDir: input.projectDir,
        featureKey: record.featureKey,
        outputPath: existing?.lastOutputPath,
      });
      const qualityCheckedStatus = statusAfterQualityCheck({
        projectDir: input.projectDir,
        status: existingStatus,
        outputPath: promotedOutputPath,
        suppression,
      });
      features[record.featureKey] = {
        ...record,
        status: qualityCheckedStatus,
        taskId:
          suppression ||
          qualityCheckedStatus === "stale" ||
          qualityCheckedStatus === "dormant"
            ? null
            : existingTaskId,
        attempts: existing?.attempts ?? 0,
        lastOutputPath: promotedOutputPath,
        lastSummary: suppression
          ? (existing?.lastSummary ?? null)
          : existingStatus === "done" && qualityCheckedStatus !== "done"
            ? `Reopened feature-reference collection because ${featureReferenceOutputQuality({ projectDir: input.projectDir, outputPath: existing?.lastOutputPath }).missing.join(" and ")} was missing from the accepted artifact.`
            : (existing?.lastSummary ?? null),
        suppression,
        collectorContractVersion: existing?.collectorContractVersion ?? null,
        updatedAt: now,
      };
    }
    state.features = features;
    return { state, path, created: false };
  }

  const features: Record<string, FeatureReferenceItemState> = {};
  for (const record of loadFeatureReferencePackets(input.projectDir)) {
    features[record.featureKey] = {
      ...record,
      status: "pending",
      taskId: null,
      attempts: 0,
      lastOutputPath: null,
      lastSummary: null,
      collectorContractVersion: null,
      updatedAt: now,
    };
  }
  const state: FeatureReferenceLoopState = {
    loopTaskId: input.loopTaskId,
    windowSize: input.windowSize,
    cursor: 0,
    features,
  };
  writeJson(path, state);
  return { state, path, created: true };
}

export function saveFeatureReferenceLoopState(
  path: string,
  state: FeatureReferenceLoopState,
): void {
  writeJson(path, state);
}

export function orderedPendingFeatureKeys(
  state: FeatureReferenceLoopState,
): string[] {
  return Object.keys(state.features)
    .filter((featureKey) => {
      const feature = state.features[featureKey];
      if (feature?.suppression) return false;
      return ["pending", "error"].includes(String(feature?.status));
    })
    .sort((a, b) => a.localeCompare(b));
}

export function updateFeatureReferenceItem(
  state: FeatureReferenceLoopState,
  featureKey: string,
  patch: Partial<FeatureReferenceItemState>,
): void {
  const previous = state.features[featureKey] ?? {
    featureKey,
    packetPath: `features/${featureKey}.yaml`,
    packetKind: "feature" as const,
    layout: "migration-root-feature" as const,
    capabilityId: null,
    coveredFeatureIds: [],
    status: "pending" as const,
    taskId: null,
    attempts: 0,
    lastOutputPath: null,
    lastSummary: null,
    suppression: null,
    collectorContractVersion: null,
    updatedAt: new Date().toISOString(),
  };
  const next = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (patch.suppression === undefined && next.suppression) {
    next.status = "done";
    next.taskId = null;
  }
  state.features[featureKey] = next;
}
