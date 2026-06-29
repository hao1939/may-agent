import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

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

function compactFileStats(stats: FileStat[], limit = 8): FileStat[] {
  return [...stats].sort((a, b) => b.lines - a.lines).slice(0, limit);
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
  const sharedKnowledgeDir =
    field(ctx.task, "sharedKnowledge") ?? join(ctx.sharedRoot, "knowledge");

  const indexPath = join(knowledgeDir, "INDEX.md");
  const indexText = safeRead(indexPath);
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

  const treeText = safeRead(join(appDir, "tasks/tree.json"));
  const hasSharedConvergenceTask = treeText.includes(
    "shared-knowledge-convergence",
  );

  const signals: Signal[] = [];
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
  if (sharedMdCount > 1000 && !hasSharedConvergenceTask) {
    signals.push({
      kind: "shared-corpus-unmapped",
      severity: "P2",
      reason:
        "shared/knowledge is a large external corpus but the Scout task tree has no convergence task to classify how it should relate to the project library.",
      evidence: {
        sharedMdCount,
        sharedEntryCount,
        sharedLibraryCount,
        sharedIndexExists,
        sharedRouterIndexExists,
      },
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
        unsourced_count: unsourcedCount,
        oversized_top_level: compactFileStats(oversizedTopLevel, 12),
        oversized_findings: compactFileStats(oversizedFindings, 8),
        non_inbox_orphan_sample: nonInboxOrphans.slice(0, 30),
        structural_orphan_sample: structuralOrphans.slice(0, 30),
      },
      digest: {
        files: digestStats,
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
          "Review the deterministic library-health packet. Update the task tree and perform the smallest useful maintenance step. Do not bulk-migrate shared/knowledge; classify and promote only durable reusable knowledge.",
      },
    });
  }

  return ctx.done(
    signals.length > 0
      ? `Library health observer recorded ${signals.length} signal(s); owner wake emitted.`
      : "Library health observer recorded packet with no owner wake.",
  );
}
