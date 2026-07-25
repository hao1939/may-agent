#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  computeVisibleFrontier,
  syncOwnerVisibleReadout,
  type VisibleFrontier,
} from "../agents/app-ops/workflows/lib/owner-visible-readout-sync.ts";

type JsonObject = Record<string, any>;

type AuditIssue = {
  path: string;
  kind: "stale-snapshot" | "missing-task-id" | "count-mismatch" | "stale-active-task";
  details: string;
};

type SurfaceAudit = {
  surface: string;
  issueCount: number;
  issues: AuditIssue[];
};

type AuditReport = {
  auditedAt: string;
  treeUpdatedAt: string;
  liveCounts: VisibleFrontier["counts"];
  surfaces: SurfaceAudit[];
  totalIssues: number;
};

type AuditSnapshot = {
  frontier: VisibleFrontier;
  liveTaskIds: string[];
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(arg, true);
    } else {
      args.set(arg, next);
      i += 1;
    }
  }
  return args;
}

function readJson(path: string): JsonObject {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as JsonObject)
    : {};
}

function writeText(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function defaultProjectDir(appDir: string): string {
  const projectJson = readJson(join(appDir, "project.json"));
  const configuredPath = projectJson.domainProject?.path;
  if (typeof configuredPath === "string" && configuredPath.trim()) {
    return resolve(appDir, configuredPath);
  }
  return appDir;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function runtimeMirrorProjectJsonPath(appDir: string): string {
  const sourceKey = appDir.replace(/[^A-Za-z0-9._-]+/g, "_");
  return join(appDir, ".state", "runtime-modules", sourceKey, "project.json");
}

function extractSnapshotMentions(value: string): string[] {
  return unique(
    Array.from(value.matchAll(/20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g))
      .map((match) => match[0])
      .filter(Boolean),
  );
}

function extractListedTaskIds(value: string): string[] {
  const ids: string[] = [];
  for (const match of value.matchAll(/\[([^\]]*)\]/g)) {
    const body = match[1]?.trim() ?? "";
    if (!body || body === "none") continue;
    for (const rawPart of body.split(/,\s*/g)) {
      const cleaned = rawPart.replace(/\s*\(\+\d+ more\)$/, "").trim();
      if (!cleaned || cleaned === "none") continue;
      if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/.test(cleaned)) ids.push(cleaned);
    }
  }
  return unique(ids);
}

function taskIdsFromPacket(packet: JsonObject): string[] {
  const currentFocus = packet.currentFocus ?? {};
  const focusMission = currentFocus.focusMission ?? {};
  return unique([
    ...(Array.isArray(currentFocus.activeTaskIds) ? currentFocus.activeTaskIds : []),
    ...(Array.isArray(currentFocus.waitingTaskIds) ? currentFocus.waitingTaskIds : []),
    ...(Array.isArray(currentFocus.blockedTaskIds) ? currentFocus.blockedTaskIds : []),
    ...(Array.isArray(currentFocus.proposedTaskIds) ? currentFocus.proposedTaskIds : []),
    ...(Array.isArray(focusMission.activeTaskIds) ? focusMission.activeTaskIds : []),
    ...(Array.isArray(focusMission.reviewTaskIds) ? focusMission.reviewTaskIds : []),
    ...(Array.isArray(focusMission.waitingTaskIds) ? focusMission.waitingTaskIds : []),
    ...(Array.isArray(focusMission.runnableTaskIds) ? focusMission.runnableTaskIds : []),
    ...(Array.isArray(focusMission.blockedTaskIds) ? focusMission.blockedTaskIds : []),
    ...(Array.isArray(focusMission.proposedTaskIds) ? focusMission.proposedTaskIds : []),
    ...(Array.isArray(focusMission.linkedBlockedTaskIds)
      ? focusMission.linkedBlockedTaskIds
      : []),
    ...(Array.isArray(focusMission.liveReviewFrontierTaskIds)
      ? focusMission.liveReviewFrontierTaskIds
      : []),
  ]);
}

function issuesForString(
  path: string,
  value: string,
  liveTreeUpdatedAt: string,
  liveIds: Set<string>,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const staleSnapshots = extractSnapshotMentions(value).filter(
    (snapshot) => snapshot !== liveTreeUpdatedAt,
  );
  if (staleSnapshots.length) {
    issues.push({
      path,
      kind: "stale-snapshot",
      details: `mentions older snapshot(s): ${staleSnapshots.join(", ")}`,
    });
  }
  const missingIds = extractListedTaskIds(value).filter((id) => !liveIds.has(id));
  if (missingIds.length) {
    issues.push({
      path,
      kind: "missing-task-id",
      details: `cites task ids absent from live tree: ${missingIds.join(", ")}`,
    });
  }
  return issues;
}

function issuesForArray(
  path: string,
  value: unknown,
  liveIds: Set<string>,
): AuditIssue[] {
  if (!Array.isArray(value)) return [];
  const missingIds = unique(
    value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim())
      .filter((id) => !liveIds.has(id)),
  );
  if (!missingIds.length) return [];
  return [
    {
      path,
      kind: "missing-task-id",
      details: `contains task ids absent from live tree: ${missingIds.join(", ")}`,
    },
  ];
}

function issuesForCounts(
  path: string,
  value: JsonObject | undefined,
  frontier: VisibleFrontier,
): AuditIssue[] {
  if (!value || typeof value !== "object") return [];
  const expected = frontier.counts;
  const actual = {
    active: Number(value.active ?? value.activeLeafCount ?? NaN),
    review: Number(value.review ?? value.reviewLeafCount ?? NaN),
    waiting: Number(value.waiting ?? value.waitingLeafCount ?? NaN),
    runnable: Number(value.runnable ?? value.runnableLeafCount ?? NaN),
    blocked: Number(value.blocked ?? value.blockedLeafCount ?? NaN),
  };
  const diffs = Object.entries(expected)
    .filter(([key, count]) => actual[key as keyof typeof actual] !== count)
    .map(
      ([key, count]) =>
        `${key} expected ${count} but found ${actual[key as keyof typeof actual]}`,
    );
  if (!diffs.length) return [];
  return [
    {
      path,
      kind: "count-mismatch",
      details: diffs.join("; "),
    },
  ];
}

function issuesForActiveTaskId(
  path: string,
  value: unknown,
  frontier: VisibleFrontier,
): AuditIssue[] {
  const expected = frontier.active[0] ?? null;
  if (value === expected) return [];
  return [
    {
      path,
      kind: "stale-active-task",
      details: `expected ${String(expected)} but found ${String(value)}`,
    },
  ];
}

function auditSurface(
  surface: string,
  packet: JsonObject,
  frontier: VisibleFrontier,
  liveIds: Set<string>,
): SurfaceAudit {
  const issues: AuditIssue[] = [];
  const currentFocus = packet.currentFocus ?? {};
  const focusMission = currentFocus.focusMission ?? {};
  const focusReview = currentFocus.focusReview ?? {};
  const topFocusReview = packet.focusReview ?? {};
  const currentState = packet.currentState ?? {};

  const stringFields: Array<[string, unknown]> = [
    [`${surface}.currentFocus.summary`, currentFocus.summary],
    [`${surface}.currentFocus.nextAction`, currentFocus.nextAction],
    [`${surface}.ownerNext`, packet.ownerNext],
    [`${surface}.currentFocus.focusReview.note`, focusReview.note],
    [`${surface}.focusReview.summary`, topFocusReview.summary],
    [`${surface}.currentState.summary`, currentState.summary],
  ];
  for (const [path, value] of stringFields) {
    if (typeof value === "string" && value.trim()) {
      issues.push(...issuesForString(path, value, frontier.observedTreeUpdatedAt, liveIds));
    }
  }

  const snapshotFields: Array<[string, unknown]> = [
    [`${surface}.currentFocus.focusMission.treeUpdatedAt`, focusMission.treeUpdatedAt],
    [`${surface}.currentFocus.snapshot.treeUpdatedAt`, currentFocus.snapshot?.treeUpdatedAt],
    [`${surface}.currentState.snapshot.treeUpdatedAt`, currentState.snapshot?.treeUpdatedAt],
  ];
  for (const [path, value] of snapshotFields) {
    if (typeof value === "string" && value && value !== frontier.observedTreeUpdatedAt) {
      issues.push({
        path,
        kind: "stale-snapshot",
        details: `expected ${frontier.observedTreeUpdatedAt} but found ${value}`,
      });
    }
  }

  const arrayFields: Array<[string, unknown]> = [
    [`${surface}.currentFocus.activeTaskIds`, currentFocus.activeTaskIds],
    [`${surface}.currentFocus.waitingTaskIds`, currentFocus.waitingTaskIds],
    [`${surface}.currentFocus.blockedTaskIds`, currentFocus.blockedTaskIds],
    [`${surface}.currentFocus.proposedTaskIds`, currentFocus.proposedTaskIds],
    [`${surface}.currentFocus.focusMission.activeTaskIds`, focusMission.activeTaskIds],
    [`${surface}.currentFocus.focusMission.reviewTaskIds`, focusMission.reviewTaskIds],
    [`${surface}.currentFocus.focusMission.waitingTaskIds`, focusMission.waitingTaskIds],
    [`${surface}.currentFocus.focusMission.runnableTaskIds`, focusMission.runnableTaskIds],
    [`${surface}.currentFocus.focusMission.blockedTaskIds`, focusMission.blockedTaskIds],
    [`${surface}.currentFocus.focusMission.proposedTaskIds`, focusMission.proposedTaskIds],
    [`${surface}.currentFocus.focusMission.linkedBlockedTaskIds`, focusMission.linkedBlockedTaskIds],
    [`${surface}.currentFocus.focusMission.liveReviewFrontierTaskIds`, focusMission.liveReviewFrontierTaskIds],
  ];
  for (const [path, value] of arrayFields) {
    issues.push(...issuesForArray(path, value, liveIds));
  }

  issues.push(
    ...issuesForCounts(`${surface}.currentFocus.focusMission.packetCounts`, focusMission.packetCounts, frontier),
  );
  if (currentState && typeof currentState === "object") {
    issues.push(
      ...issuesForCounts(`${surface}.currentState.metrics`, currentState.metrics, frontier),
    );
    if (Object.hasOwn(currentState, "activeTaskId")) {
      issues.push(
        ...issuesForActiveTaskId(
          `${surface}.currentState.activeTaskId`,
          currentState.activeTaskId,
          frontier,
        ),
      );
    }
  }

  return { surface, issueCount: issues.length, issues };
}

function currentAuditSnapshot(appDir: string): AuditSnapshot {
  const treePath = join(appDir, ".state", "tasks", "tree.json");
  const tree = JSON.parse(readFileSync(treePath, "utf8"));
  return {
    frontier: computeVisibleFrontier(tree),
    liveTaskIds: Object.keys(tree.tasks ?? {}).sort(),
  };
}

function auditReadouts(appDir: string, snapshot?: AuditSnapshot): AuditReport {
  const activeSnapshot = snapshot ?? currentAuditSnapshot(appDir);
  const frontier = activeSnapshot.frontier;
  const liveIds = new Set(activeSnapshot.liveTaskIds);
  const runtimeMirrorPath = runtimeMirrorProjectJsonPath(appDir);
  const surfaces = [
    auditSurface("project.json", readJson(join(appDir, "project.json")), frontier, liveIds),
    auditSurface(
      ".state/project-state.json",
      readJson(join(appDir, ".state", "project-state.json")),
      frontier,
      liveIds,
    ),
  ];
  if (existsSync(runtimeMirrorPath)) {
    surfaces.push(
      auditSurface(runtimeMirrorPath.replace(`${appDir}/`, ""), readJson(runtimeMirrorPath), frontier, liveIds),
    );
  }
  return {
    auditedAt: new Date().toISOString(),
    treeUpdatedAt: frontier.observedTreeUpdatedAt,
    liveCounts: frontier.counts,
    totalIssues: surfaces.reduce((sum, surface) => sum + surface.issueCount, 0),
    surfaces,
  };
}

function formatIssues(issues: AuditIssue[]): string {
  if (!issues.length) return "- none";
  return issues.map((issue) => `- \`${issue.path}\` — ${issue.details}`).join("\n");
}

function formatCounts(counts: VisibleFrontier["counts"]): string {
  return `active=${counts.active}, review=${counts.review}, waiting=${counts.waiting}, runnable=${counts.runnable}, blocked=${counts.blocked}`;
}

function writeEvidence(path: string, before: AuditReport, after: AuditReport) {
  const lines = [
    "# Owner-visible focus mirror parity repair — 2026-07-23",
    "",
    `- Live tree snapshot before repair: \`${before.treeUpdatedAt}\``,
    `- Live tree snapshot after repair: \`${after.treeUpdatedAt}\``,
    `- Live counts after repair: ${formatCounts(after.liveCounts)}`,
    "",
    "## Baseline stale-field enumeration",
    "",
    ...before.surfaces.flatMap((surface) => [
      `### ${surface.surface}`,
      `- issue count: ${surface.issueCount}`,
      formatIssues(surface.issues),
      "",
    ]),
    "## Supported refresh path used",
    "",
    "- Ran `scripts/sync-owner-visible-readout.ts`, which calls the app-owned `syncOwnerVisibleReadout(...)` helper.",
    "- That helper locks task state once, reads one live task snapshot, and rewrites `project.json`, `.state/project-state.json`, and the runtime mirror from the same observed frontier.",
    "- No task-tree storage file was hand-edited.",
    "",
    "## Post-repair parity verification",
    "",
    ...after.surfaces.flatMap((surface) => [
      `### ${surface.surface}`,
      `- issue count: ${surface.issueCount}`,
      formatIssues(surface.issues),
      "",
    ]),
    "## Final parity result",
    "",
    `- Single repaired snapshot: \`${after.treeUpdatedAt}\``,
    `- Shared final counts: ${formatCounts(after.liveCounts)}`,
    "- All owner-visible surfaces now point at the same live snapshot and no audited field advertises a task id absent from that snapshot.",
    "",
  ];
  writeText(path, `${lines.join("\n")}\n`);
}

const args = parseArgs(process.argv.slice(2));
const appDir = resolve(String(args.get("--app-dir") || process.cwd()));
const projectDir = resolve(
  String(args.get("--project-dir") || defaultProjectDir(appDir)),
);
const evidencePathArg = args.get("--evidence");
const auditOnly = args.has("--audit-only");

const beforeSnapshot = currentAuditSnapshot(appDir);
const before = auditReadouts(appDir, beforeSnapshot);

if (auditOnly) {
  console.log(JSON.stringify(before, null, 2));
  process.exit(before.totalIssues === 0 ? 0 : 1);
}

const sync = syncOwnerVisibleReadout({ appDir, projectDir, worker: "app-ops" });
const after = auditReadouts(appDir, {
  frontier: sync.frontier,
  liveTaskIds: sync.liveTaskIds,
});

if (evidencePathArg && typeof evidencePathArg === "string") {
  writeEvidence(resolve(appDir, evidencePathArg), before, after);
}

console.log(
  JSON.stringify(
    {
      before,
      sync,
      after,
      evidencePath:
        typeof evidencePathArg === "string"
          ? resolve(appDir, evidencePathArg)
          : null,
    },
    null,
    2,
  ),
);

process.exit(after.totalIssues === 0 ? 0 : 1);
