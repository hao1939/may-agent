import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
  resolveTaskTreePath,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "library-health";
export const description =
  "Deterministic Scout knowledge-library health observer. Builds a compact packet and wakes Scout only when library shape needs owner judgment.";

const projectId = "scout-knowledge-lib";

type Severity = "P0" | "P1" | "P2";

type Signal = {
  kind: string;
  severity: Severity;
  reason: string;
  evidence?: unknown;
};

type FileStat = {
  path: string;
  lines: number;
};

type FutureDateRef = {
  path: string;
  date: string;
  line?: number;
  text?: string;
};

type RepeatedSignal = {
  kind: string;
  consecutivePacketsIncludingCurrent: number;
};

type SignalTaskCoverage = {
  kind: string;
  taskId: string;
  state: string;
  hasProgressEvidence: boolean;
  progressEvidence?: string;
};

type ActiveTaskProgressIssue = {
  taskId: string;
  state: string;
  owner?: string;
  priority?: string;
  hasProgressEvidence: false;
};

function field(task: string, name: string): string | undefined {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "m");
  return task.match(pattern)?.[1]?.trim();
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
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function listMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  function visit(dir: string): void {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === ".git" || entry === "node_modules" || entry === ".state") {
        continue;
      }
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        visit(full);
      } else if (st.isFile() && entry.endsWith(".md")) {
        files.push(full);
      }
    }
  }
  visit(root);
  return files.sort();
}

function countFiles(root: string, suffix?: string): number {
  let count = 0;
  function visit(dir: string): void {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === ".git" || entry === "node_modules" || entry === ".state") {
        continue;
      }
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) visit(full);
      else if (st.isFile() && (!suffix || entry.endsWith(suffix))) count += 1;
    }
  }
  visit(root);
  return count;
}

function listRootMarkdownFiles(root: string): string[] {
  try {
    return readdirSync(root)
      .map((entry) => join(root, entry))
      .filter((path) => {
        try {
          return statSync(path).isFile() && path.endsWith(".md");
        } catch {
          return false;
        }
      })
      .map((path) => toPosix(relative(root, path)))
      .sort();
  } catch {
    return [];
  }
}

function compactFileStats(stats: FileStat[], limit = 8): FileStat[] {
  return [...stats].sort((a, b) => b.lines - a.lines).slice(0, limit);
}

function readJsonl(path: string): unknown[] {
  return safeRead(path)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return undefined;
      }
    })
    .filter((value): value is unknown => value !== undefined);
}

function signalKinds(packet: unknown): Set<string> {
  if (!packet || typeof packet !== "object") return new Set();
  const signals = (packet as { signals?: unknown }).signals;
  if (!Array.isArray(signals)) return new Set();
  return new Set(
    signals
      .map((signal) =>
        signal && typeof signal === "object"
          ? (signal as { kind?: unknown }).kind
          : undefined,
      )
      .filter(
        (kind): kind is string =>
          typeof kind === "string" &&
          kind.length > 0 &&
          kind !== "repeated-library-health-signal",
      ),
  );
}

function repeatedSignals(
  appDir: string,
  currentSignals: Signal[],
): RepeatedSignal[] {
  const currentKinds = new Set(
    currentSignals
      .map((signal) => signal.kind)
      .filter((kind) => kind !== "repeated-library-health-signal"),
  );
  if (currentKinds.size === 0) return [];

  const historyPath = join(appDir, ".state", "library-health-packets.jsonl");
  const previousPackets = readJsonl(historyPath).slice(-8).reverse();
  const repeated: RepeatedSignal[] = [];

  for (const kind of currentKinds) {
    const coverage = taskCoverageForSignal(appDir, kind);
    if (coverage?.hasProgressEvidence) continue;
    let previousConsecutive = 0;
    for (const packet of previousPackets) {
      if (!signalKinds(packet).has(kind)) break;
      previousConsecutive += 1;
    }
    if (previousConsecutive >= 2) {
      repeated.push({
        kind,
        consecutivePacketsIncludingCurrent: previousConsecutive + 1,
      });
    }
  }

  return repeated;
}

function parseTaskTree(appDir: string): Record<string, unknown> {
  try {
    const tree = JSON.parse(safeRead(resolveTaskTreePath(appDir))) as {
      tasks?: Record<string, unknown>;
    };
    return tree.tasks ?? {};
  } catch {
    return {};
  }
}

function taskCoverageForSignal(
  appDir: string,
  kind: string,
): SignalTaskCoverage | undefined {
  const taskBySignal: Record<string, string[]> = {
    "future-dated-library-content": ["repair-library-time-trust"],
    "oversized-canonical-notes": ["document-oversized-note-decisions"],
    "unsourced-backlog": ["source-unsourced-high-value-findings"],
  };
  const candidateIds = taskBySignal[kind] ?? [];
  const tasks = parseTaskTree(appDir);
  for (const taskId of candidateIds) {
    const task = tasks[taskId] as Record<string, unknown> | undefined;
    const state = typeof task?.state === "string" ? task.state : "";
    if (task && state !== "done") {
      const progressEvidence = taskProgressEvidence(task);
      return {
        kind,
        taskId,
        state,
        hasProgressEvidence: progressEvidence !== undefined,
        progressEvidence,
      };
    }
  }
  return undefined;
}

function activeTaskExists(appDir: string, taskId: string): boolean {
  const task = parseTaskTree(appDir)[taskId] as
    Record<string, unknown> | undefined;
  if (!task) return false;
  const state = typeof task.state === "string" ? task.state : "";
  return state !== "done";
}

function hasNonEmptyValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

function taskProgressEvidence(
  task: Record<string, unknown>,
): string | undefined {
  for (const key of ["result", "summary", "evidence", "updated_at"]) {
    if (hasNonEmptyValue(task[key])) return key;
  }

  const context = task.context;
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return undefined;
  }

  const contextRecord = context as Record<string, unknown>;
  for (const key of [
    "progress",
    "latest_progress",
    "last_action",
    "last_reviewed_at",
    "decision",
    "decisions",
    "accepted_reason",
    "accepted_reasons",
    "evidence",
  ]) {
    if (hasNonEmptyValue(contextRecord[key])) return `context.${key}`;
  }

  return undefined;
}

function taskCoverageForSignals(
  appDir: string,
  signals: Signal[],
): SignalTaskCoverage[] {
  const coverage: SignalTaskCoverage[] = [];
  for (const signal of signals) {
    const match = taskCoverageForSignal(appDir, signal.kind);
    if (match) coverage.push(match);
  }
  return coverage;
}

function activeFinishableTasksWithoutProgress(
  appDir: string,
  representedSignals: SignalTaskCoverage[],
): ActiveTaskProgressIssue[] {
  const standingTaskIds = new Set([
    "project",
    "ongoing-research",
    "explore-arxiv",
    "explore-hn",
    "explore-xhs",
    "explore-github",
    "daily-digest",
    "library-maintenance",
  ]);
  const representedTaskIds = new Set(
    representedSignals.map((signal) => signal.taskId),
  );
  const issues: ActiveTaskProgressIssue[] = representedSignals
    .filter((signal) => !signal.hasProgressEvidence)
    .map((signal) => ({
      taskId: signal.taskId,
      state: signal.state,
      hasProgressEvidence: false,
    }));

  for (const [taskId, task] of Object.entries(parseTaskTree(appDir))) {
    if (representedTaskIds.has(taskId) || standingTaskIds.has(taskId)) continue;
    if (!task || typeof task !== "object" || Array.isArray(task)) continue;
    const record = task as Record<string, unknown>;
    if (record.state !== "active") continue;
    const children = Array.isArray(record.children) ? record.children : [];
    if (children.length > 0) continue;
    if (taskProgressEvidence(record)) continue;
    issues.push({
      taskId,
      state: "active",
      owner: typeof record.owner === "string" ? record.owner : undefined,
      priority:
        typeof record.priority === "string" ? record.priority : undefined,
      hasProgressEvidence: false,
    });
  }

  return issues;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function validIsoDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
  );
}

function futureDateRefsInText(
  path: string,
  text: string,
  today: string,
  limit: number,
): FutureDateRef[] {
  const refs: FutureDateRef[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length && refs.length < limit; index += 1) {
    const line = lines[index] ?? "";
    for (const match of line.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
      const date = match[0];
      if (validIsoDate(date) && date > today) {
        refs.push({
          path,
          date,
          line: index + 1,
          text: line.trim().slice(0, 180),
        });
        if (refs.length >= limit) break;
      }
    }
  }
  return refs;
}

function futureDateRefsInPath(
  path: string,
  today: string,
  limit: number,
): FutureDateRef[] {
  const refs: FutureDateRef[] = [];
  for (const match of path.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
    const date = match[0];
    if (validIsoDate(date) && date > today) {
      refs.push({ path, date });
      if (refs.length >= limit) break;
    }
  }
  return refs;
}

function findFutureDateRefs(params: {
  appDir: string;
  projectDir: string;
  knowledgeDir: string;
  knowledgeRelFiles: string[];
  today: string;
  limit?: number;
}): FutureDateRef[] {
  const limit = params.limit ?? 40;
  const refs: FutureDateRef[] = [];
  const add = (next: FutureDateRef[]) => {
    for (const ref of next) {
      if (refs.length >= limit) return;
      refs.push(ref);
    }
  };

  const taskTreePath = resolveTaskTreePath(params.appDir);
  const focusedFiles = [
    {
      label: toPosix(
        relative(params.projectDir, join(params.projectDir, "README.md")),
      ),
      path: join(params.projectDir, "README.md"),
    },
    {
      label: toPosix(
        relative(params.projectDir, join(params.knowledgeDir, "INDEX.md")),
      ),
      path: join(params.knowledgeDir, "INDEX.md"),
    },
    {
      label: toPosix(relative(params.appDir, taskTreePath)),
      path: taskTreePath,
    },
  ];

  for (const file of focusedFiles) {
    add(
      futureDateRefsInText(
        file.label,
        safeRead(file.path),
        params.today,
        limit - refs.length,
      ),
    );
  }

  for (const relPath of params.knowledgeRelFiles) {
    if (refs.length >= limit) break;
    add(
      futureDateRefsInPath(
        `knowledge/${relPath}`,
        params.today,
        limit - refs.length,
      ),
    );
  }

  return refs;
}

function writePacket(appDir: string, packet: Record<string, unknown>): string {
  const stateDir = join(appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  const path = join(stateDir, "library-health-packets.jsonl");
  appendFileSync(path, `${JSON.stringify(packet)}\n`, "utf8");
  return path;
}

function buildPacket(ctx: WorkflowContext): {
  packet: Record<string, unknown>;
  signals: Signal[];
} {
  const appDir =
    field(ctx.task, "app") ?? "/app/projects/scout-knowledge-lib.app";
  const projectDir =
    field(ctx.task, "project") ?? "/app/projects/scout-knowledge-lib";
  const knowledgeDir = join(projectDir, "knowledge");
  const reportsDir = join(projectDir, "reports");
  const sharedKnowledgeDir =
    field(ctx.task, "sharedKnowledge") ?? join(ctx.sharedRoot, "knowledge");

  const indexPath = join(knowledgeDir, "INDEX.md");
  const indexText = safeRead(indexPath);
  const knowledgeReadmeExists = fileExists(join(knowledgeDir, "README.md"));
  const rootReportFiles = listRootMarkdownFiles(reportsDir);
  const knowledgeFiles = listMarkdownFiles(knowledgeDir);
  const knowledgeRelFiles = knowledgeFiles.map((path) =>
    toPosix(relative(knowledgeDir, path)),
  );

  const topLevelStats = knowledgeRelFiles
    .filter((path) => !path.includes("/") && path !== "INDEX.md")
    .map((path) => ({
      path,
      lines: lineCount(safeRead(join(knowledgeDir, path))),
    }));
  const oversizedTopLevel = topLevelStats.filter((file) => file.lines > 800);

  const oversizedFindings = knowledgeRelFiles
    .filter((path) => path.startsWith("findings/"))
    .map((path) => ({
      path,
      lines: lineCount(safeRead(join(knowledgeDir, path))),
    }))
    .filter((file) => file.lines > 1500);

  const nonInboxOrphans = knowledgeRelFiles.filter((path) => {
    if (path === "INDEX.md" || path.startsWith("inbox/")) return false;
    return !indexText.includes(path);
  });
  const structuralOrphans = nonInboxOrphans.filter(
    (path) => !path.startsWith("findings/"),
  );

  const unsourcedCount = (indexText.match(/Not yet sourced/g) ?? []).length;

  const digestCandidates = [
    join(projectDir, "agents/scout/workspace/digest/today.md"),
    join(appDir, "agents/scout/workspace/digest/today.md"),
  ];
  const digestStats = digestCandidates
    .map((path) => ({
      path: toPosix(path),
      lines: lineCount(safeRead(path)),
    }))
    .filter((file) => file.lines > 0);

  const sharedMdCount = countFiles(sharedKnowledgeDir, ".md");
  const sharedEntryCount = countFiles(
    join(sharedKnowledgeDir, "entries"),
    ".md",
  );
  const sharedLibraryCount = countFiles(
    join(sharedKnowledgeDir, "library"),
    ".md",
  );
  const sharedIndexExists =
    lineCount(safeRead(join(sharedKnowledgeDir, "INDEX.md"))) > 0;
  const sharedRouterIndexExists =
    lineCount(safeRead(join(sharedKnowledgeDir, "knowledge-index.json"))) > 0;

  const hasSharedConvergenceTask = activeTaskExists(
    appDir,
    "shared-knowledge-convergence",
  );
  const today = todayIsoDate();
  const futureDateRefs = findFutureDateRefs({
    appDir,
    projectDir,
    knowledgeDir,
    knowledgeRelFiles,
    today,
  });

  const signals: Signal[] = [];
  if (!knowledgeReadmeExists) {
    signals.push({
      kind: "human-navigation-missing",
      severity: "P1",
      reason:
        "knowledge/README.md is missing; humans only have the exhaustive INDEX.md, so Scout should create a short landing page.",
      evidence: {
        expectedPath: "knowledge/README.md",
      },
    });
  }
  if (oversizedTopLevel.length > 0) {
    signals.push({
      kind: "oversized-canonical-notes",
      severity: "P1",
      reason: `${oversizedTopLevel.length} top-level knowledge note(s) exceed 800 lines and need Scout split/rollup judgment.`,
      evidence: compactFileStats(oversizedTopLevel),
    });
  }
  if (unsourcedCount >= 50) {
    signals.push({
      kind: "unsourced-backlog",
      severity: "P1",
      reason: `${unsourcedCount} INDEX entries are marked Not yet sourced; findings are outpacing canonical absorption.`,
    });
  }
  const oversizedDigest = digestStats.filter((file) => file.lines > 1000);
  if (oversizedDigest.length > 0) {
    signals.push({
      kind: "digest-log-oversized",
      severity: "P1",
      reason: `${oversizedDigest.length} Scout digest today.md file(s) exceed 1000 lines and should be archived/reset by Scout.`,
      evidence: compactFileStats(oversizedDigest),
    });
  }
  if (structuralOrphans.length > 0) {
    signals.push({
      kind: "index-coverage-gap",
      severity: "P2",
      reason: `${structuralOrphans.length} non-finding knowledge markdown file(s) are not referenced by knowledge/INDEX.md.`,
      evidence: structuralOrphans.slice(0, 20),
    });
  }
  if (rootReportFiles.length > 0) {
    signals.push({
      kind: "reports-layout-backlog",
      severity: "P2",
      reason: `${rootReportFiles.length} report file(s) still live directly under reports/; Scout should move a small verified batch into reports/health, reports/merge, reports/triage, reports/migration, or reports/operations.`,
      evidence: rootReportFiles.slice(0, 30),
    });
  }
  if (sharedMdCount > 1000 && !hasSharedConvergenceTask) {
    signals.push({
      kind: "shared-corpus-unmapped",
      severity: "P2",
      reason:
        "shared/knowledge is a large external corpus but the Scout task tree has no convergence task to merge useful content and remove replaced source files.",
      evidence: {
        sharedMdCount,
        sharedEntryCount,
        sharedLibraryCount,
        sharedIndexExists,
        sharedRouterIndexExists,
      },
    });
  }
  if (futureDateRefs.length > 0) {
    signals.push({
      kind: "future-dated-library-content",
      severity: "P1",
      reason: `${futureDateRefs.length} future-dated project/library reference(s) were sampled after ${today}; Scout should correct them or record why they are intentional.`,
      evidence: futureDateRefs,
    });
  }
  const representedSignals = taskCoverageForSignals(appDir, signals);
  const activeTasksNotMoving = activeFinishableTasksWithoutProgress(
    appDir,
    representedSignals,
  );
  if (activeTasksNotMoving.length > 0) {
    signals.push({
      kind: "active-task-not-moving",
      severity: "P1",
      reason: `${activeTasksNotMoving.length} active finishable task(s) have no progress evidence; Scout should do a small real step, record proof, close with result, or escalate with a concrete reason.`,
      evidence: activeTasksNotMoving,
    });
  }
  const repeated = repeatedSignals(appDir, signals);
  if (repeated.length > 0) {
    signals.push({
      kind: "repeated-library-health-signal",
      severity: "P1",
      reason: `${repeated.length} library-health signal kind(s) have repeated across at least 3 consecutive packets; observation is working but closure may be weak.`,
      evidence: repeated,
    });
  }

  const packet = {
    generated_at: new Date().toISOString(),
    role: "observer",
    project: projectId,
    observations: {
      knowledge: {
        md_count: knowledgeFiles.length,
        index_lines: lineCount(indexText),
        has_readme: knowledgeReadmeExists,
        unsourced_count: unsourcedCount,
        oversized_top_level: compactFileStats(oversizedTopLevel, 12),
        oversized_findings: compactFileStats(oversizedFindings, 8),
        non_inbox_orphan_sample: nonInboxOrphans.slice(0, 30),
        structural_orphan_sample: structuralOrphans.slice(0, 30),
        future_date_sample: futureDateRefs,
      },
      digest: {
        files: digestStats,
      },
      reports: {
        root_markdown_count: rootReportFiles.length,
        root_markdown_sample: rootReportFiles.slice(0, 30),
      },
      process: {
        repeated_health_signals: repeated,
        represented_health_signals: representedSignals,
        active_tasks_not_moving: activeTasksNotMoving,
      },
      shared_knowledge: {
        path: toPosix(sharedKnowledgeDir),
        md_count: sharedMdCount,
        entries_count: sharedEntryCount,
        library_count: sharedLibraryCount,
        has_index: sharedIndexExists,
        has_router_index: sharedRouterIndexExists,
        convergence_task_exists: hasSharedConvergenceTask,
      },
    },
    signals,
  };

  return { packet, signals };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir =
    field(ctx.task, "app") ?? "/app/projects/scout-knowledge-lib.app";
  const { packet, signals } = buildPacket(ctx);
  const packetPath = writePacket(appDir, packet);

  ctx.emit({
    type: "project.library_health.observed",
    project: projectId,
    packetPath,
    signalCount: signals.length,
    signals,
  });

  if (signals.length > 0) {
    ctx.emit({
      type: "project.owner.requested",
      project: projectId,
      reason: "library-health-signal",
      params: {
        packetPath,
        signalCount: signals.length,
        signals,
        instruction:
          "Review the deterministic library-health packet. Update the task tree and perform the smallest useful maintenance step. For shared/knowledge cleanup, merge durable content into Scout-owned notes/reports, migrate references, then remove old source files only after the replacement is recorded.",
      },
    });
  }

  const summary =
    signals.length > 0
      ? `Library health observer recorded ${signals.length} signal(s); owner wake emitted.`
      : "Library health observer recorded packet with no owner wake.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`packet:${packetPath}`],
    actions: [],
  });
}
