import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "library-health";
export const description =
  "Deterministic Scout library observer. Records bounded domain facts and wakes Scout only for new, worse, or review-due facts.";

const projectId = "scout-knowledge-lib";
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
  | "future-dated-library-truth";

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

function field(task: string, name: string): string | undefined {
  return task.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

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
    if (
      !packet.wake_decisions?.some(
        (decision) => decision.key === key && decision.wake,
      )
    )
      continue;
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
}): LibraryHealthPacket {
  const now = input.now ?? Date.now();
  const history = readHistory(input.appDir);
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

function writePacket(appDir: string, packet: LibraryHealthPacket): string {
  const stateDir = join(appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  const path = join(stateDir, packetFile);
  appendFileSync(path, `${JSON.stringify(packet)}\n`, "utf8");
  return path;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir =
    ctx.appDir ??
    field(ctx.task, "app") ??
    "/app/projects/scout-knowledge-lib.app";
  const projectDir =
    ctx.projectDir ??
    field(ctx.task, "project") ??
    "/app/projects/scout-knowledge-lib";
  const packet = buildLibraryHealthPacket({ appDir, projectDir });
  const packetPath = writePacket(appDir, packet);

  ctx.emit({
    type: "project.library_health.observed",
    project: projectId,
    packetPath,
    factCount: packet.facts.length,
    wakeCount: packet.wake_signals.length,
    wakeSignals: packet.wake_signals,
  });

  if (packet.wake_signals.length > 0) {
    ctx.emit({
      type: "project.owner.requested",
      project: projectId,
      reason: "library-health-signal",
      params: {
        packetPath,
        signalCount: packet.wake_signals.length,
        signals: packet.wake_signals,
        instruction:
          "Review the deterministic Scout-library facts and perform the smallest useful maintenance step or record an exact no-op reason.",
      },
    });
  }

  const summary =
    packet.wake_signals.length > 0
      ? `Library health recorded ${packet.facts.length} fact(s) and requested owner review for ${packet.wake_signals.length}.`
      : `Library health recorded ${packet.facts.length} fact(s); no owner wake was needed.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`packet:${packetPath}`],
    actions: [],
  });
}
