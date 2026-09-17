import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  ACCEPTED_SOURCE_OUTPUTS_METRIC_ID,
  RETIRED_ACCEPTED_SOURCE_OUTPUTS_24H_METRIC_ID,
} from "../../../scripts/accepted-source-outputs.js";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "library-health";
export const description =
  "Deterministic Scout library observer. Records bounded domain facts and wakes Scout only for new, worse, or review-due facts.";

const projectId = "scout-knowledge-lib";
export const KNOWLEDGE_PREAMBLE_COVERAGE_METRIC_ID =
  "scout.knowledge-preamble-coverage";
export const RETIRED_KNOWLEDGE_PRACTICE_LOADED_METRIC_ID =
  "scout.knowledge-practice-loaded";
const packetFile = "library-health-packets.jsonl";
const maxFacts = 50;
const maxWakeSignals = 16;
const historyPackets = 64;

type Severity = "P0" | "P1" | "P2";

type FactKind =
  | "human-navigation-missing"
  | "oversized-canonical-note"
  | "unsourced-backlog"
  | "digest-log-oversized"
  | "index-coverage-gap"
  | "reports-layout-backlog"
  | "future-dated-library-truth"
  | "artifact-identity-collision";

export type LibraryHealthFact = {
  key: string;
  kind: FactKind;
  subject: string;
  severity: Severity;
  reason: string;
  observedValue: string | number | boolean;
  fingerprint: string;
  evidence?: unknown;
};

export type WakeDecision = {
  key: string;
  wake: boolean;
  reason: "new" | "worse" | "review-due" | "unchanged";
};

export type LibraryHealthPacket = {
  schema_version: 2;
  /** Stable identity of the admitted Task wake; absent on historical packets. */
  observation_id?: string;
  generated_at: string;
  role: "observer";
  project: string;
  facts: LibraryHealthFact[];
  wake_decisions: WakeDecision[];
  wake_signals: LibraryHealthFact[];
  truncated: boolean;
  observations: Record<string, unknown>;
};

type FileStat = { path: string; lines: number };
type FutureTruth = { path: string; field: string; date: string; line?: number };
type ArtifactIdentityOccurrence = {
  source: string;
  date: string;
  scanId: string;
  title: string;
  path: string;
  kind: "finding" | "digest";
};

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function lineCount(text: string): number {
  return text ? text.split(/\r?\n/).length : 0;
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function listMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === ".git" || entry === "node_modules" || entry === ".state")
        continue;
      const path = join(dir, entry);
      try {
        const stat = statSync(path);
        if (stat.isDirectory()) visit(path);
        else if (stat.isFile() && entry.endsWith(".md")) files.push(path);
      } catch {
        // Ignore files that disappear during observation.
      }
    }
  };
  visit(root);
  return files.sort();
}

function listRootMarkdownFiles(root: string): string[] {
  try {
    return readdirSync(root)
      .filter((entry) => {
        try {
          return statSync(join(root, entry)).isFile() && entry.endsWith(".md");
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

export function knowledgePreambleCoverage(projectDir: string): {
  value: number;
  sampleSize: number;
} {
  const files = listMarkdownFiles(join(projectDir, "knowledge"));
  if (files.length === 0) return { value: 1, sampleSize: 0 };
  const withPreamble = files.filter((path) =>
    safeRead(path).slice(0, 8192).includes("<ai_context>"),
  ).length;
  return {
    value: Number((withPreamble / files.length).toFixed(4)),
    sampleSize: files.length,
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizedSource(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function explicitScanTitle(
  title: string,
): { source: string; scanId: string; title: string } | undefined {
  const match =
    /^([a-z][a-z0-9.-]*)\s+scan\s+#([a-z0-9][a-z0-9._-]*)\s+[—–-]\s+(.+)$/i.exec(
      title.trim(),
    );
  if (!match) return undefined;
  return {
    source: normalizedSource(match[1]),
    scanId: match[2].toLowerCase(),
    title: title.trim().replace(/\s+/g, " "),
  };
}

function frontmatterField(content: string, name: string): string | undefined {
  const end = content.startsWith("---\n") ? content.indexOf("\n---", 4) : -1;
  const block = end >= 0 ? content.slice(4, end) : "";
  if (!block) return undefined;
  const value = block.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1];
  return value ? unquote(value) : undefined;
}

function findingArtifactIdentity(
  projectDir: string,
  path: string,
): ArtifactIdentityOccurrence | undefined {
  const content = safeRead(path);
  const title = frontmatterField(content, "title");
  const date = frontmatterField(content, "date");
  const declaredSource = frontmatterField(content, "source");
  if (!title || !date || !declaredSource || !validIsoDate(date)) return;
  const explicit = explicitScanTitle(title);
  if (!explicit) return;
  const source = normalizedSource(declaredSource);
  if (!source || source !== explicit.source) return;
  return {
    source,
    date,
    scanId: explicit.scanId,
    title: explicit.title,
    path: toPosix(relative(projectDir, path)),
    kind: "finding",
  };
}

function digestArtifactIdentities(
  appDir: string,
  path: string,
): ArtifactIdentityOccurrence[] {
  const result: ArtifactIdentityOccurrence[] = [];
  for (const line of safeRead(path).split(/\r?\n/)) {
    const heading = /^#{2,3}\s+(.+?)\s+\((20\d{2}-\d{2}-\d{2})\)\s*$/.exec(
      line,
    );
    if (!heading || !validIsoDate(heading[2])) continue;
    const explicit = explicitScanTitle(heading[1]);
    if (!explicit) continue;
    result.push({
      source: explicit.source,
      date: heading[2],
      scanId: explicit.scanId,
      title: explicit.title,
      path: toPosix(relative(appDir, path)),
      kind: "digest",
    });
  }
  return result;
}

function latestArchivedDigest(digestDir: string): string | undefined {
  try {
    return readdirSync(digestDir)
      .filter((entry) =>
        /^(?:20\d{2}-\d{2}-\d{2}|digest-[a-f0-9]{64})\.md$/.test(entry),
      )
      .map((entry) => {
        const path = join(digestDir, entry);
        return { path, modified: statSync(path).mtimeMs };
      })
      .sort((a, b) => a.modified - b.modified || a.path.localeCompare(b.path))
      .at(-1)?.path;
  } catch {
    return undefined;
  }
}

function artifactIdentityCollisionFacts(input: {
  appDir: string;
  projectDir: string;
  knowledgeFiles: string[];
  digestPath: string;
}): LibraryHealthFact[] {
  const digestDir = join(
    input.appDir,
    "agents",
    "scout",
    "workspace",
    "digest",
  );
  const archive = latestArchivedDigest(digestDir);
  const occurrences = [
    ...input.knowledgeFiles
      .filter((path) =>
        toPosix(relative(input.projectDir, path)).startsWith(
          "knowledge/findings/",
        ),
      )
      .flatMap((path) => {
        const identity = findingArtifactIdentity(input.projectDir, path);
        return identity ? [identity] : [];
      }),
    ...[input.digestPath, ...(archive ? [archive] : [])].flatMap((path) =>
      digestArtifactIdentities(input.appDir, path),
    ),
  ];
  const byIdentity = new Map<string, ArtifactIdentityOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.source}:${occurrence.date}:${occurrence.scanId}`;
    const current = byIdentity.get(key) ?? [];
    current.push(occurrence);
    byIdentity.set(key, current);
  }
  return [...byIdentity.entries()].flatMap(([subject, entries]) => {
    const titles = new Map<string, string>();
    for (const entry of entries) {
      titles.set(entry.title.toLowerCase(), entry.title);
    }
    if (titles.size < 2) return [];
    return [
      fact({
        kind: "artifact-identity-collision",
        subject,
        severity: "P1",
        reason: `${subject} maps to ${titles.size} distinct explicit titles.`,
        observedValue: titles.size,
        evidence: {
          findingPaths: [
            ...new Set(
              entries
                .filter((entry) => entry.kind === "finding")
                .map((entry) => entry.path),
            ),
          ],
          digestHeadings: entries
            .filter((entry) => entry.kind === "digest")
            .map((entry) => ({ path: entry.path, heading: entry.title })),
          titles: [...titles.values()].sort(),
        },
      }),
    ];
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fact(
  input: Omit<LibraryHealthFact, "key" | "fingerprint">,
): LibraryHealthFact {
  const key = `${input.kind}:${input.subject}`;
  const fingerprint = createHash("sha256")
    .update(canonical({ key, ...input }))
    .digest("hex")
    .slice(0, 16);
  return { ...input, key, fingerprint };
}

function readHistory(appDir: string): LibraryHealthPacket[] {
  return safeRead(join(appDir, ".state", packetFile))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as LibraryHealthPacket;
      } catch {
        return undefined;
      }
    })
    .filter(
      (packet): packet is LibraryHealthPacket =>
        packet?.schema_version === 2 && Array.isArray(packet.facts),
    )
    .slice(-historyPackets);
}

function validIsoDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
  );
}

function futureDatesInPaths(
  projectDir: string,
  paths: string[],
  today: string,
): FutureTruth[] {
  const result: FutureTruth[] = [];
  for (const path of paths) {
    const relativePath = toPosix(relative(projectDir, path));
    for (const match of relativePath.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
      if (validIsoDate(match[0]) && match[0] > today) {
        result.push({ path: relativePath, field: "filename", date: match[0] });
      }
    }
  }
  return result;
}

function futureTruthFields(
  projectDir: string,
  paths: string[],
  today: string,
): FutureTruth[] {
  const result: FutureTruth[] = [];
  const pattern =
    /^\s*(date|last_updated|generated_at)\s*:\s*["']?(20\d{2}-\d{2}-\d{2})/i;
  for (const path of paths) {
    const lines = safeRead(path).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index]?.match(pattern);
      if (!match || !validIsoDate(match[2]) || match[2] <= today) continue;
      result.push({
        path: toPosix(relative(projectDir, path)),
        field: match[1].toLowerCase(),
        date: match[2],
        line: index + 1,
      });
      if (result.length >= 40) return result;
    }
  }
  return result;
}

function reviewIntervalMs(kind: FactKind): number {
  switch (kind) {
    case "oversized-canonical-note":
    case "unsourced-backlog":
    case "future-dated-library-truth":
      return 7 * 24 * 60 * 60_000;
    default:
      return 24 * 60 * 60_000;
  }
}

function worseningDelta(kind: FactKind): number {
  switch (kind) {
    case "oversized-canonical-note":
      return 100;
    case "unsourced-backlog":
      return 10;
    case "digest-log-oversized":
      return 100;
    default:
      return 1;
  }
}

function materiallyWorse(
  current: LibraryHealthFact,
  previous: LibraryHealthFact,
): boolean {
  if (
    typeof current.observedValue === "number" &&
    typeof previous.observedValue === "number"
  ) {
    return (
      current.observedValue - previous.observedValue >=
      worseningDelta(current.kind)
    );
  }
  if (
    current.kind === "future-dated-library-truth" &&
    typeof current.observedValue === "string" &&
    typeof previous.observedValue === "string"
  ) {
    return current.observedValue > previous.observedValue;
  }
  return false;
}

function lastWakeAt(
  history: LibraryHealthPacket[],
  key: string,
): number | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const packet = history[index];
    // Eligibility before the packet limit is not an owner signal.
    if (!packet.wake_signals?.some((signal) => signal.key === key)) continue;
    const timestamp = Date.parse(packet.generated_at);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return undefined;
}

function decideWakes(
  facts: LibraryHealthFact[],
  history: LibraryHealthPacket[],
  now: number,
): WakeDecision[] {
  const previousFacts = new Map(
    (history.at(-1)?.facts ?? []).map((item) => [item.key, item]),
  );
  return facts.map((current) => {
    const previous = previousFacts.get(current.key);
    if (!previous) return { key: current.key, wake: true, reason: "new" };
    if (materiallyWorse(current, previous))
      return { key: current.key, wake: true, reason: "worse" };
    const lastWake = lastWakeAt(history, current.key);
    if (
      lastWake === undefined ||
      now - lastWake >= reviewIntervalMs(current.kind)
    ) {
      return { key: current.key, wake: true, reason: "review-due" };
    }
    return { key: current.key, wake: false, reason: "unchanged" };
  });
}

export function buildLibraryHealthPacket(input: {
  appDir: string;
  projectDir: string;
  now?: number;
  observationId?: string;
}): LibraryHealthPacket {
  const now = input.now ?? Date.now();
  // A retry after publication/history append must reconstruct the first
  // attempt, not treat its own packet as prior observation history.
  const history = readHistory(input.appDir).filter(
    (packet) =>
      !input.observationId || packet.observation_id !== input.observationId,
  );
  const knowledgeDir = join(input.projectDir, "knowledge");
  const reportsDir = join(input.projectDir, "reports");
  const knowledgeFiles = listMarkdownFiles(knowledgeDir);
  const reportFiles = listMarkdownFiles(reportsDir);
  const indexPath = join(knowledgeDir, "INDEX.md");
  const indexText = safeRead(indexPath);
  const facts: LibraryHealthFact[] = [];

  if (!fileExists(join(knowledgeDir, "README.md"))) {
    facts.push(
      fact({
        kind: "human-navigation-missing",
        subject: "knowledge/README.md",
        severity: "P1",
        reason: "The short human-facing knowledge landing page is missing.",
        observedValue: false,
      }),
    );
  }

  const topLevelStats: FileStat[] = knowledgeFiles
    .map((path) => ({
      path: toPosix(relative(knowledgeDir, path)),
      lines: lineCount(safeRead(path)),
    }))
    .filter((item) => !item.path.includes("/") && item.path !== "INDEX.md");
  for (const item of topLevelStats.filter(
    (candidate) => candidate.lines > 800,
  )) {
    facts.push(
      fact({
        kind: "oversized-canonical-note",
        subject: `knowledge/${item.path}`,
        severity: "P1",
        reason: `${item.path} has ${item.lines} lines and needs periodic split/rollup review.`,
        observedValue: item.lines,
      }),
    );
  }

  const unsourcedCount = (indexText.match(/Not yet sourced/g) ?? []).length;
  if (unsourcedCount >= 50) {
    const previousValue = history
      .at(-1)
      ?.facts.find(
        (item) => item.key === "unsourced-backlog:knowledge/INDEX.md",
      )?.observedValue;
    let unchangedWindows = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const value = history[index]?.facts.find(
        (item) => item.key === "unsourced-backlog:knowledge/INDEX.md",
      )?.observedValue;
      if (value !== unsourcedCount) break;
      unchangedWindows += 1;
    }
    facts.push(
      fact({
        kind: "unsourced-backlog",
        subject: "knowledge/INDEX.md",
        severity: "P1",
        reason: `${unsourcedCount} INDEX entries remain marked Not yet sourced.`,
        observedValue: unsourcedCount,
        evidence: {
          previous:
            typeof previousValue === "number" ? previousValue : undefined,
          delta:
            typeof previousValue === "number"
              ? unsourcedCount - previousValue
              : undefined,
          unchanged_windows: unchangedWindows,
        },
      }),
    );
  }

  const digestPath = join(
    input.appDir,
    "agents",
    "scout",
    "workspace",
    "digest",
    "today.md",
  );
  const digestLines = lineCount(safeRead(digestPath));
  if (digestLines > 1000) {
    facts.push(
      fact({
        kind: "digest-log-oversized",
        subject: "agents/scout/workspace/digest/today.md",
        severity: "P1",
        reason: `The current digest accumulator has ${digestLines} lines.`,
        observedValue: digestLines,
      }),
    );
  }

  facts.push(
    ...artifactIdentityCollisionFacts({
      appDir: input.appDir,
      projectDir: input.projectDir,
      knowledgeFiles,
      digestPath,
    }),
  );

  const structuralOrphans = knowledgeFiles
    .map((path) => toPosix(relative(knowledgeDir, path)))
    .filter(
      (path) =>
        path !== "INDEX.md" &&
        !path.startsWith("inbox/") &&
        !path.startsWith("findings/") &&
        !indexText.includes(path),
    );
  if (structuralOrphans.length > 0) {
    facts.push(
      fact({
        kind: "index-coverage-gap",
        subject: "knowledge/INDEX.md",
        severity: "P2",
        reason: `${structuralOrphans.length} canonical knowledge file(s) are not referenced by INDEX.md.`,
        observedValue: structuralOrphans.length,
        evidence: structuralOrphans.slice(0, 20),
      }),
    );
  }

  const rootReports = listRootMarkdownFiles(reportsDir);
  if (rootReports.length > 0) {
    facts.push(
      fact({
        kind: "reports-layout-backlog",
        subject: "reports",
        severity: "P2",
        reason: `${rootReports.length} report file(s) remain directly under reports/.`,
        observedValue: rootReports.length,
        evidence: rootReports.slice(0, 20),
      }),
    );
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const futureTruth = [
    ...futureDatesInPaths(
      input.projectDir,
      [...knowledgeFiles, ...reportFiles],
      today,
    ),
    ...futureTruthFields(
      input.projectDir,
      [
        join(input.projectDir, "README.md"),
        indexPath,
        ...knowledgeFiles,
        ...reportFiles,
      ],
      today,
    ),
  ];
  const distinctFutureTruth = [
    ...new Map(
      futureTruth.map((item) => [
        `${item.path}:${item.field}:${item.date}`,
        item,
      ]),
    ).values(),
  ].slice(0, 40);
  for (const item of distinctFutureTruth) {
    facts.push(
      fact({
        kind: "future-dated-library-truth",
        subject: `${item.path}:${item.field}`,
        severity: "P1",
        reason: `${item.path} declares future ${item.field} ${item.date}.`,
        observedValue: item.date,
        evidence: item.line ? { line: item.line } : undefined,
      }),
    );
  }

  const distinctFacts = [
    ...new Map(facts.map((item) => [item.key, item])).values(),
  ].sort((left, right) => left.key.localeCompare(right.key));
  const boundedFacts = distinctFacts.slice(0, maxFacts);
  const wakeDecisions = decideWakes(boundedFacts, history, now);
  const wakeKeys = new Set(
    wakeDecisions
      .filter((decision) => decision.wake)
      .map((decision) => decision.key),
  );
  const wakeSignals = boundedFacts
    .filter((item) => wakeKeys.has(item.key))
    .slice(0, maxWakeSignals);

  return {
    schema_version: 2,
    ...(input.observationId ? { observation_id: input.observationId } : {}),
    generated_at: new Date(now).toISOString(),
    role: "observer",
    project: projectId,
    facts: boundedFacts,
    wake_decisions: wakeDecisions,
    wake_signals: wakeSignals,
    truncated:
      distinctFacts.length > maxFacts || wakeKeys.size > maxWakeSignals,
    observations: {
      knowledge: {
        markdown_files: knowledgeFiles.length,
        index_lines: lineCount(indexText),
        unsourced_count: unsourcedCount,
        structural_orphan_count: structuralOrphans.length,
      },
      digest: { lines: digestLines },
      reports: { root_markdown_count: rootReports.length },
      history_packets_considered: history.length,
    },
  };
}

function writePacket(path: string, packet: LibraryHealthPacket): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(packet)}\n`, "utf8");
}

export function acceptedSourceOutputsMetricDefinition() {
  return {
    id: ACCEPTED_SOURCE_OUTPUTS_METRIC_ID,
    name: "Latest accepted Scout source outputs (retired JSON source)",
    owner: "scout",
    project: projectId,
    type: "gauge",
    unit: "count",
    priority: "P2",
    status: "retired",
    description:
      "Retired because its source command reads the historical JSON Task projection, not live Host state. Retained samples cannot establish current output health. Inspect current source Task evidence through supported Task reads; do not restore the obsolete projection or infer quality from an output count.",
  } as const;
}

function packetAlreadyRecorded(appDir: string, observationId: string): boolean {
  return readHistory(appDir).some(
    (packet) => packet.observation_id === observationId,
  );
}

function retainedPacket(value: unknown): LibraryHealthPacket | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const packet = value as Partial<LibraryHealthPacket>;
  return packet.schema_version === 2 &&
    typeof packet.generated_at === "string" &&
    Array.isArray(packet.facts) &&
    Array.isArray(packet.wake_decisions) &&
    Array.isArray(packet.wake_signals)
    ? (packet as LibraryHealthPacket)
    : undefined;
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  if (!ctx.workspace)
    return ctx.blocked("Library health requires a canonical App workspace");
  const appDir = ctx.workspace.appRoot;
  const projectDir = ctx.workspace.projectRoot;
  ctx.metrics.define({
    id: RETIRED_KNOWLEDGE_PRACTICE_LOADED_METRIC_ID,
    name: "Scout knowledge practice loaded (invalid proxy)",
    owner: "scout",
    project: projectId,
    type: "health",
    unit: "boolean",
    priority: "P2",
    status: "retired",
    description:
      "Retired because instruction-file text does not prove that an attempt loaded or followed the instructions; Runtime agent-configuration health covers deployment validity.",
  });
  ctx.metrics.define({
    id: KNOWLEDGE_PREAMBLE_COVERAGE_METRIC_ID,
    name: "Scout knowledge preamble coverage",
    owner: "scout",
    project: projectId,
    type: "gauge",
    target: 0.25,
    threshold: 0.15,
    unit: "ratio",
    priority: "P3",
    alertOp: "<",
    status: "active",
    config: { alert: { mode: "disabled", disabled: true } },
    description:
      "Advisory share of canonical Scout knowledge Markdown files whose first 8 KiB contains an <ai_context> preamble.",
  });
  ctx.metrics.define({
    id: RETIRED_ACCEPTED_SOURCE_OUTPUTS_24H_METRIC_ID,
    name: "Accepted Scout source outputs in the last 24 hours (unsupported)",
    owner: "scout",
    project: projectId,
    type: "gauge",
    unit: "count",
    priority: "P2",
    status: "retired",
    description:
      "Retired because canonical completed Scout attempts do not retain structured durable-output evidence for successive runs; latest task resources cannot prove rolling-window coverage.",
  });
  ctx.metrics.define(acceptedSourceOutputsMetricDefinition());
  const preambleCoverage = knowledgePreambleCoverage(projectDir);
  await ctx.metrics.record(
    KNOWLEDGE_PREAMBLE_COVERAGE_METRIC_ID,
    preambleCoverage.value,
    {
      sampleSize: preambleCoverage.sampleSize,
      measuredBy: `workflow:${name}`,
    },
  );
  const localKey = taskEmissionKey(ctx, "library-health-observed");
  const retained = await ctx.events.read(
    "project.library_health.observed",
    localKey,
  );
  const packetPath = join(appDir, ".state", packetFile);
  const publishedPacket = retainedPacket(retained?.data.packet);
  if (retained && !publishedPacket) {
    const summary =
      "Library health publication was retained, but its legacy payload has no packet snapshot; history was not reconstructed from changed files.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      facts: [
        `publication:project.library_health.observed:${localKey}`,
        "history:legacy-publication-packet-unavailable",
      ],
      actions: [],
    });
  }
  const packet =
    publishedPacket ??
    buildLibraryHealthPacket({
      appDir,
      projectDir,
      observationId: localKey,
    });
  const publication = retained?.data ?? {
    project: projectId,
    packetPath,
    factCount: packet.facts.length,
    wakeCount: packet.wake_signals.length,
    wakeSignals: packet.wake_signals,
    packet,
  };

  if (!retained) {
    await ctx.events.emit({
      type: "project.library_health.observed",
      localKey,
      target: { appId: projectId, project: projectId },
      data: publication,
    });
  }
  // The retained publication is authoritative across a lost acknowledgement:
  // filesystem changes cannot alter this wake's key/payload. Record its packet
  // once after publication so later, genuinely new ticks see reminder history.
  if (!packetAlreadyRecorded(appDir, localKey)) writePacket(packetPath, packet);

  const summary =
    packet.wake_signals.length > 0
      ? `Library health recorded ${packet.facts.length} fact(s) and published ${packet.wake_signals.length} actionable signal(s).`
      : `Library health recorded ${packet.facts.length} fact(s); no owner wake was needed.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    facts: [`packet:${packetPath}`],
    actions: [],
  });
}
