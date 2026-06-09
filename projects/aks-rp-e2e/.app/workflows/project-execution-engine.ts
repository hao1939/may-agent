/**
 * project-execution-engine — Breadth-first task-tree runner for Project App V2.
 *
 * This is the first app-local implementation for aks-rp-e2e. It owns the
 * current task tree in .app/tasks/tree.json and uses infra sessions/events for audit.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "project-execution-engine";
export const description = "Run the aks-rp-e2e task tree breadth-first until genuinely blocked, gated, complete, or interrupted by an infra budget guard.";

type TaskStatus =
  | "proposed"
  | "ready"
  | "active"
  | "decomposed"
  | "claimed_done"
  | "accepted"
  | "rejected"
  | "blocked"
  | "superseded";

const TASK_STATUSES: readonly TaskStatus[] = [
  "proposed",
  "ready",
  "active",
  "decomposed",
  "claimed_done",
  "accepted",
  "rejected",
  "blocked",
  "superseded",
];

const TASK_STATUS_SET = new Set<string>(TASK_STATUSES);
const ORDINARY_BACKLOG_LOW_WATERMARK = 5;

type Trace = {
  created_by_event?: string;
  last_updated_by_event?: string;
  last_session?: string;
  last_workflow_run?: string;
};

type TaskAttempt = {
  id: string;
  ts: string;
  agent: string;
  claim: "done" | "blocked" | "partial";
  summary: string;
  outputs: string[];
  checks: Array<{ command: string; result: "pass" | "fail" | "not_run"; exit_code?: number }>;
  open_risks: string[];
  trace?: Trace;
};

type Verification = {
  ts: string;
  verifier: string;
  verdict: "accepted" | "rejected" | "blocked";
  reason: string;
  criteria: Array<{ item: string; result: "pass" | "fail" | "not_proven" }>;
  trace?: Trace;
};

type TaskNode = {
  id: string;
  parent_id: string | null;
  status: TaskStatus;
  kind?: "work" | "blocked_review" | "parent_review" | "rework_review" | "frontier_replan" | "domain_planner" | "human_question" | "loop_task";
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  wake_on?: string[];
  latest_run_id?: string;
  claimed_by?: string;
  lease_expires_at?: string;
  conflict_scope?: string[];
  gate_status?: "open" | "closed" | "satisfied";
  goal: string;
  children: string[];
  inputs: string[];
  outputs: string[];
  acceptance: string[];
  forbidden: string[];
  gates: string[];
  blocker?: string;
  progress?: { accepted: number; blocked: number; total: number };
  attempts?: TaskAttempt[];
  verification?: Verification;
  trace?: Trace;
};

type TaskTree = {
  version: 1;
  project: "aks-rp-e2e";
  updated_at: string;
  project_lifecycle: string;
  root_task_id: string;
  active_task_id: string | null;
  active_task_ids?: string[];
  tasks: Record<string, TaskNode>;
};

type EngineConfig = {
  projectDir: string;
  projectPath: string;
  treePath: string;
  featureQueuePath: string;
  journalPath: string;
  plannerRunsPath: string;
  owner: string;
  worker: string;
  maxAttempts: number;
  maxConcurrent: number;
};

const PROJECT_CONTROL_ID = "project-control";
const PROJECT_PLANNING_LOOP_ID = "project-planning-loop";
const PROJECT_PLANNING_LOOP_RUN_ID = "project-planning-loop-run";
const PROJECT_PLANNING_HISTORY_ID = "project-planning-history";
const MAX_INTERRUPTED_CONTROL_REWORK_ATTEMPTS = 3;
const MAX_CONSECUTIVE_FAILED_PLANNING_RUNS = 5;

type FeatureQueueItem = {
  row: number;
  name: string;
  slug: string;
  stage: string;
  status: string;
  safeLocalWork: string;
};

type ProjectFrame = {
  status: string;
  goal: string;
  currentState: string;
  nextAction: string;
  closeReason: string;
};

type TriggerEvent = {
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function parseTriggerEvent(raw: string): TriggerEvent | null {
  const match = raw.match(/## Trigger Event\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as TriggerEvent;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function triggerValue(event: TriggerEvent | null, key: string): string {
  const data = event?.data;
  const params = event?.params;
  const value = data && typeof data === "object" && key in data
    ? data[key]
    : params && typeof params === "object" && !Array.isArray(params) && key in params
    ? (params as Record<string, unknown>)[key]
    : event?.[key];
  return typeof value === "string" ? value : "";
}

function triggerNumber(event: TriggerEvent | null, key: string): number | undefined {
  const data = event?.data;
  const params = event?.params;
  const value = data && typeof data === "object" && key in data
    ? data[key]
    : params && typeof params === "object" && !Array.isArray(params) && key in params
    ? (params as Record<string, unknown>)[key]
    : event?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseInput(raw: string, callingAgent: string): EngineConfig {
  const trigger = parseTriggerEvent(raw);
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const maxConcurrent = Number.parseInt(field(raw, "maxConcurrent") ?? "", 10);
  return {
    projectDir,
    projectPath: join(projectDir, ".app", "project.md"),
    treePath: join(projectDir, "tasks", "tree.json"),
    featureQueuePath: join(projectDir, "evidence", "outputs", "feature-learning-queue.md"),
    journalPath: join(projectDir, ".app", "journal.jsonl"),
    plannerRunsPath: join(projectDir, ".app", "planner-runs.jsonl"),
    owner: field(raw, "owner") ?? field(raw, "agent") ?? callingAgent,
    worker: field(raw, "worker") ?? field(raw, "agent") ?? callingAgent,
    maxAttempts: Number.parseInt(field(raw, "maxAttempts") ?? "3", 10),
    maxConcurrent: Math.max(1, triggerNumber(trigger, "maxConcurrent") || maxConcurrent || 1),
  };
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  renameSync(tempPath, path);
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withTreeLock<T>(config: EngineConfig, operation: () => T): T {
  const lockPath = `${config.treePath}.lock`;
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > 10 * 60_000) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Retry; another process may have released the lock between mkdir and stat.
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for task tree lock: ${lockPath}`);
      }
      sleepSync(25);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function appendJournal(path: string, record: Record<string, unknown>): void {
  ensureDir(dirname(path));
  const next = { ts: new Date().toISOString(), actor: "project-execution-engine", ...record };
  try {
    if (existsSync(path)) {
      const recent = readText(path).trimEnd().split("\n").slice(-20);
      const fingerprint = JSON.stringify({
        kind: next.kind,
        status: next.status,
        task_id: next.task_id,
        task_ids: next.task_ids,
        active_task_id: next.active_task_id,
        rework_task_id: next.rework_task_id,
        reason: next.reason,
      });
      if (recent.some(line => {
        try {
          const parsed = JSON.parse(line);
          return JSON.stringify({
            kind: parsed.kind,
            status: parsed.status,
            task_id: parsed.task_id,
            task_ids: parsed.task_ids,
            active_task_id: parsed.active_task_id,
            rework_task_id: parsed.rework_task_id,
            reason: parsed.reason,
          }) === fingerprint;
        } catch {
          return false;
        }
      })) return;
    }
  } catch {
    // Journal dedupe is best-effort; never block task-tree progress on it.
  }
  appendFileSync(path, `${JSON.stringify(next)}\n`);
}

function extractFrontmatterValue(content: string, key: string): string {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!frontmatter) return "";
  const match = frontmatter[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const start = content.indexOf(marker);
  if (start < 0) return "";
  const after = content.slice(start + marker.length);
  const next = after.search(/\n## /);
  return (next < 0 ? after : after.slice(0, next)).trim();
}

function updateSection(content: string, heading: string, newContent: string): string {
  const marker = `## ${heading}\n`;
  const start = content.indexOf(marker);
  const body = newContent.endsWith("\n") ? newContent : `${newContent}\n`;
  if (start < 0) return `${content.trimEnd()}\n\n${marker}${body}`;
  const afterStart = start + marker.length;
  const after = content.slice(afterStart);
  const next = after.search(/\n## /);
  const end = next < 0 ? content.length : afterStart + next;
  return content.slice(0, afterStart) + body + content.slice(end);
}

function projectFrame(projectContent: string): ProjectFrame {
  return {
    status: (extractFrontmatterValue(projectContent, "status") || "active").toLowerCase(),
    goal: extractSection(projectContent, "Goal").split("\n\n")[0].trim(),
    currentState: extractSection(projectContent, "Current State"),
    nextAction: extractSection(projectContent, "Next Action"),
    closeReason: extractFrontmatterValue(projectContent, "close_reason"),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function task(id: string, input: Omit<TaskNode, "id" | "children"> & { children?: string[] }): TaskNode {
  return {
    id,
    children: input.children ?? [],
    ...input,
  };
}

function createInitialTree(frame: ProjectFrame): TaskTree {
  const blocker = frame.closeReason || "Project is waiting on an external execution-environment gate.";
  const tree: TaskTree = {
    version: 1,
    project: "aks-rp-e2e",
    updated_at: nowIso(),
    project_lifecycle: frame.status,
    root_task_id: "project",
    active_task_id: "managedsystem-live-auth-gate",
    tasks: {},
  };

  tree.tasks.project = task("project", {
    parent_id: null,
    status: frame.status === "closed" ? "blocked" : "ready",
    priority: "P1",
    owner: "aks-explorer",
    goal: frame.goal || "Build and use the AKS RP input/expectation knowledge map.",
    inputs: [".app/project.md", "model/knowledge-map/model.json", "reports/current.md"],
    outputs: [".app/tasks/tree.json"],
    acceptance: [
      "No ready or active work remains, or remaining work is explicitly blocked/superseded.",
      "Task state is visible in .app/tasks/tree.json and summarized in .app/project.md.",
    ],
    forbidden: [
      "Do not run cloud mutation unless a task has an explicit gate and that gate passes.",
    ],
    gates: [],
    blocker: frame.status === "closed" ? blocker : undefined,
    children: [
      "managedsystem-two-path-live-run",
      "local-model-hygiene-on-request",
      "app-routing-tls-istio-followup",
      "machines-nap-followup",
      "paf-precondition-followup",
    ],
  });

  tree.tasks["managedsystem-two-path-live-run"] = task("managedsystem-two-path-live-run", {
    parent_id: "project",
    status: "blocked",
    priority: "P1",
    owner: "aks-explorer",
    goal: "Run the selected two-path ManagedSystem replan only after the execution environment gate passes.",
    inputs: [
      ".app/decisions/replans/live-selected/",
      "model/knowledge-map/views/path-summary.json",
      "specs/index.json",
      "evidence/archive/iteration190-live-selected-two-path-blocker.md",
    ],
    outputs: ["evidence/archive/iteration190-live-selected-two-path-blocker.md"],
    acceptance: [
      "Auth gate succeeds before mutation, or exact blocker is recorded.",
      "No live execution starts unless Azure CLI/token gate succeeds.",
      "Cleanup/result evidence is linked when live execution eventually runs.",
    ],
    forbidden: [
      "Do not run AKS_RP_E2E_DRY_RUN=0 while Azure CLI is unavailable.",
      "Do not run kubectl, staging, standalone, cluster creation, or ManagedSystem cloud probes without the recorded gate.",
    ],
    gates: [
      "Azure CLI is available in the project workspace or approved credentialed execution host.",
      "`az account get-access-token --resource https://management.azure.com/ -o json` succeeds.",
    ],
    blocker: "Azure CLI is not installed in the project workspace; iteration190 stopped before mutation.",
    children: ["managedsystem-live-auth-gate"],
    progress: { accepted: 0, blocked: 1, total: 1 },
  });

  tree.tasks["managedsystem-live-auth-gate"] = task("managedsystem-live-auth-gate", {
    parent_id: "managedsystem-two-path-live-run",
    status: "blocked",
    priority: "P1",
    owner: "aks-explorer",
    goal: "Verify whether live ManagedSystem execution can proceed by checking the ARM token gate.",
    inputs: [
      ".app/decisions/replans/live-selected/",
      "evidence/archive/iteration190-live-selected-two-path-blocker.md",
    ],
    outputs: ["evidence/archive/iteration190-live-selected-two-path-blocker.md"],
    acceptance: [
      "Runs `az account get-access-token --resource https://management.azure.com/ -o json` or records that `az` is unavailable.",
      "Does not start cloud mutation.",
      "Records exact command, exit code, and blocker evidence.",
    ],
    forbidden: [
      "Do not run probes with `AKS_RP_E2E_DRY_RUN=0`.",
    ],
    gates: [
      "Azure CLI executable exists in selected execution environment.",
    ],
    blocker: "The last gate check failed with exit 127 because `az` was not found.",
    attempts: [
      {
        id: "iteration190-auth-gate",
        ts: "2026-05-29T00:00:00.000Z",
        agent: "aks-explorer",
        claim: "blocked",
        summary: "Auth gate could not run because Azure CLI is unavailable in the project workspace.",
        outputs: ["evidence/archive/iteration190-live-selected-two-path-blocker.md"],
        checks: [
          {
            command: "az account get-access-token --resource https://management.azure.com/ -o json",
            result: "fail",
            exit_code: 127,
          },
        ],
        open_risks: ["Live execution has not run."],
      },
    ],
    verification: {
      ts: nowIso(),
      verifier: "project-execution-engine",
      verdict: "accepted",
      reason: "The blocked outcome is consistent with the task acceptance criteria because mutation did not start and blocker evidence exists.",
      criteria: [
        { item: "No cloud mutation started", result: "pass" },
        { item: "Exact blocker evidence linked", result: "pass" },
      ],
    },
  });

  const gatedFollowups: Array<[string, string, string]> = [
    ["local-model-hygiene-on-request", "Run a bounded local model-hygiene/reference-packet/replanning task only when a human explicitly requests it.", "Waiting for explicit human request for a bounded local task."],
    ["app-routing-tls-istio-followup", "Follow up App Routing default-domain TLS/Istio only after owner provides diagnostics, fixed build/config, or live-verifiable precondition.", "Waiting for App Routing owner signal."],
    ["machines-nap-followup", "Follow up Machines/NAP cleanup only after preview features, rollout/config changes, or equivalent source environment are available.", "Waiting for Machines/NAP source or environment signal."],
    ["paf-precondition-followup", "Follow up PAF only after MSI/HCP access, capacity or approved bypass, and source-owner confirmation of OOM trigger/assertion path.", "Waiting for PAF preconditions."],
  ];

  for (const [id, goal, blockerText] of gatedFollowups) {
    tree.tasks[id] = task(id, {
      parent_id: "project",
      status: "blocked",
      priority: "P2",
      owner: "aks-explorer",
      goal,
      inputs: [".app/project.md"],
      outputs: [],
      acceptance: ["Required external trigger is present before work starts."],
      forbidden: ["Do not execute cloud or staging work without the explicit gate for this branch."],
      gates: [blockerText],
      blocker: blockerText,
    });
  }

  return tree;
}

function loadOrCreateTree(config: EngineConfig, frame: ProjectFrame): { tree: TaskTree; created: boolean; normalizedChanged: boolean } {
  if (existsSync(config.treePath)) {
    const { tree, changed } = loadTreeWithNormalizationState(config);
    return { tree, created: false, normalizedChanged: changed };
  }
  const tree = createInitialTree(frame);
  writeJson(config.treePath, tree);
  return { tree, created: true, normalizedChanged: false };
}

function loadTree(config: EngineConfig): TaskTree {
  return loadTreeWithNormalizationState(config).tree;
}

function loadTreeWithNormalizationState(config: EngineConfig): { tree: TaskTree; changed: boolean } {
  const tree = JSON.parse(readText(config.treePath)) as TaskTree;
  const before = JSON.stringify(tree);
  normalizeTaskTree(tree);
  return { tree, changed: JSON.stringify(tree) !== before };
}

function saveTreeUnlocked(config: EngineConfig, tree: TaskTree): void {
  normalizeTaskTree(tree);
  normalizeActiveTaskPointer(tree);
  tree.updated_at = nowIso();
  writeJson(config.treePath, tree);
}

function saveTree(config: EngineConfig, tree: TaskTree): void {
  withTreeLock(config, () => saveTreeUnlocked(config, tree));
}

function depthOf(tree: TaskTree, id: string): number {
  let depth = 0;
  let current = tree.tasks[id];
  while (current?.parent_id) {
    depth++;
    current = tree.tasks[current.parent_id];
  }
  return depth;
}

function priorityRank(priority: TaskNode["priority"]): number {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[priority ?? "P3"];
}

function isLeaf(task: TaskNode): boolean {
  return task.children.length === 0;
}

function isSettled(task: TaskNode): boolean {
  return ["accepted", "superseded"].includes(task.status) || (task.status === "blocked" && hasExternalBlockSignal(task));
}

function latestAttempt(task: TaskNode): TaskAttempt | undefined {
  return task.attempts?.at(-1);
}

function acceptedVerificationCompletesTask(task: TaskNode): boolean {
  if (task.status === "superseded") return false;
  if (task.verification?.verdict !== "accepted") return false;
  if (task.status === "blocked" && acceptedBlockedTaskHasConcreteExternalWait(task)) return false;
  return true;
}

function acceptedBlockedTaskHasConcreteExternalWait(task: TaskNode): boolean {
  if (task.kind === "human_question" || task.owner === "human") return true;
  if (hasClosedGate(task) || task.gates.some(isBlockingGate)) return true;
  return /(?:external|credential|auth|token|azure cli|\baz\b|owner|capacity|quota|rollout|environment|precondition|human|input|approval|unsafe|safety|not installed|unavailable|source signal|subscription|msi|hcp|staging)/i
    .test(task.blocker ?? "");
}

function findNextReadyLeaf(tree: TaskTree): TaskNode | null {
  const leaves = Object.values(tree.tasks)
    .filter(item => ["ready", "active"].includes(item.status) && isLeaf(item))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id));
  return leaves.find(item => !isPlanningLoopTask(item)) ?? leaves[0] ?? null;
}

function findReadyLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(item => item.status === "ready" && isLeaf(item))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id));
}

function findProposedLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(item => item.status === "proposed" && isLeaf(item))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id));
}

function activeLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(item => ["active", "claimed_done"].includes(item.status) && isLeaf(item))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id));
}

function findActiveLeaf(tree: TaskTree): TaskNode | null {
  return activeLeaves(tree)[0] ?? null;
}

function normalizeTaskTree(tree: TaskTree): void {
  for (const taskNode of Object.values(tree.tasks)) {
    taskNode.id = typeof taskNode.id === "string" && taskNode.id ? taskNode.id : "";
    taskNode.goal = typeof taskNode.goal === "string" ? taskNode.goal : "";
    taskNode.children = normalizeStringArray(taskNode.children).filter(id => Boolean(tree.tasks[id]));
    taskNode.inputs = normalizeStringArray(taskNode.inputs);
    taskNode.outputs = normalizeStringArray(taskNode.outputs);
    taskNode.acceptance = normalizeStringArray(taskNode.acceptance);
    taskNode.forbidden = normalizeStringArray(taskNode.forbidden);
    taskNode.gates = normalizeStringArray(taskNode.gates);
    const rawConflictScope = taskNode.conflict_scope as unknown;
    taskNode.conflict_scope = Array.isArray(rawConflictScope)
      ? rawConflictScope.filter((item): item is string => typeof item === "string" && Boolean(item))
      : typeof rawConflictScope === "string" && rawConflictScope
      ? [rawConflictScope]
      : undefined;
  }
  for (const taskNode of Object.values(tree.tasks)) {
    if (!taskNode.parent_id) continue;
    const parent = tree.tasks[taskNode.parent_id];
    if (parent && !parent.children.includes(taskNode.id)) parent.children = unique([...parent.children, taskNode.id]);
  }
  normalizeDependencyGates(tree);
  for (const taskNode of Object.values(tree.tasks)) {
    const rawStatus = String(taskNode.status);
    if (!TASK_STATUS_SET.has(rawStatus)) {
      if (rawStatus === "done" && taskNode.verification?.verdict === "accepted") {
        taskNode.status = "accepted";
      } else if (["done", "in-progress", "working"].includes(rawStatus)) {
        taskNode.status = isLeaf(taskNode) ? "active" : "decomposed";
      } else {
        taskNode.status = isLeaf(taskNode) ? "ready" : "decomposed";
      }
    }
    if (!isLeaf(taskNode) && ["ready", "active", "claimed_done"].includes(taskNode.status)) {
      taskNode.status = "decomposed";
    }
    const children = taskNode.children.map(id => tree.tasks[id]).filter(Boolean);
    const hasOrdinaryChildren = children.some(child => !isReviewTask(child));
    if (!isLeaf(taskNode) && taskNode.status === "blocked" && !isPlanningLoopBudgetExhausted(taskNode) && (hasOrdinaryChildren || !hasExternalBlockSignal(taskNode))) {
      taskNode.status = "decomposed";
      clearSyntheticBlocker(taskNode);
    }
    if (isLeaf(taskNode) && taskNode.status === "blocked" && isRecoverableBlockedClaim(taskNode)) {
      taskNode.status = "rejected";
      taskNode.blocker = taskNode.blocker || "Blocked is reserved for concrete external/input/safety waits; this task needs rework, split, or a concrete follow-up.";
      taskNode.verification = {
        ts: nowIso(),
        verifier: "project-execution-engine",
        verdict: "rejected",
        reason: taskNode.blocker,
        criteria: taskNode.acceptance.map(item => ({ item, result: "not_proven" })),
      };
    }
    if (taskNode.verification?.verdict === "rejected" && ["accepted", "claimed_done"].includes(taskNode.status)) {
      taskNode.status = isLeaf(taskNode) ? "rejected" : "decomposed";
    }
    if (acceptedVerificationCompletesTask(taskNode) && children.every(isSettled)) {
      taskNode.status = "accepted";
      clearSyntheticBlocker(taskNode);
    }
    const noWorkEvidence = [
      taskNode.goal,
      taskNode.blocker,
      taskNode.verification?.reason,
      ...(taskNode.attempts ?? []).map(attempt => attempt.summary),
    ].filter(Boolean).join("\n");
    if (taskNode.status === "accepted" && unsupportedNoWorkClaim(taskNode, noWorkEvidence)) {
      taskNode.status = "rejected";
      taskNode.blocker = "No-work/waiting claims are not terminal; recover by creating concrete follow-up work, a blocker-resolution task, or a human/input question.";
      taskNode.verification = {
        ts: nowIso(),
        verifier: "project-execution-engine",
        verdict: "rejected",
        reason: taskNode.blocker,
        criteria: taskNode.acceptance.map(item => ({ item, result: "not_proven" })),
      };
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const taskNode of Object.values(tree.tasks)) {
      const children = taskNode.children.map(id => tree.tasks[id]).filter(Boolean);
      if (children.length === 0) continue;
      const hasOrdinaryChildren = children.some(child => !isReviewTask(child));
      if (taskNode.status === "blocked" && !isPlanningLoopBudgetExhausted(taskNode) && (hasOrdinaryChildren || !hasExternalBlockSignal(taskNode))) {
        taskNode.status = "decomposed";
        clearSyntheticBlocker(taskNode);
        changed = true;
        continue;
      }
      const hasUnsettledChild = children.some(child => !isSettled(child));
      if (hasUnsettledChild && ["accepted", "blocked", "claimed_done"].includes(taskNode.status) && !isPlanningLoopBudgetExhausted(taskNode)) {
        taskNode.status = "decomposed";
        clearSyntheticBlocker(taskNode);
        changed = true;
      }
    }
  }
}

function dependencyGateTaskId(gate: string): string | null {
  const match = gate.trim().match(/^([A-Za-z0-9_.:-]+)\s+accepted$/);
  return match?.[1] ?? null;
}

function normalizeDependencyGates(tree: TaskTree): void {
  for (const taskNode of Object.values(tree.tasks)) {
    const blockingGates = taskNode.gates.filter(isBlockingGate);
    if (blockingGates.length === 0) {
      if (taskNode.gate_status === "closed") taskNode.gate_status = undefined;
      continue;
    }
    const dependencyIds = blockingGates.map(dependencyGateTaskId);
    if (dependencyIds.some(id => !id)) continue;
    if (dependencyIds.every(id => tree.tasks[id!]?.status === "accepted")) {
      taskNode.gate_status = "satisfied";
      if (taskNode.blocker?.startsWith("Closed gate:")) taskNode.blocker = undefined;
    }
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof value === "string" && value) return [value];
  return [];
}

function normalizeActiveTaskPointer(tree: TaskTree): void {
  const activeIds = activeLeaves(tree).map(item => item.id);
  tree.active_task_ids = activeIds;
  tree.active_task_id = activeIds[0] ?? findNextReadyLeaf(tree)?.id ?? null;
}

function openTaskCount(tree: TaskTree): number {
  return Object.values(tree.tasks).filter(item => !["accepted", "superseded"].includes(item.status)).length;
}

function isBlockedReviewTask(task: TaskNode): boolean {
  return task.kind === "blocked_review" || task.id === "blocked-frontier-review" || task.id.endsWith("-blocker-review");
}

function isParentReviewTask(task: TaskNode): boolean {
  return task.kind === "parent_review" || task.id.endsWith("-rollup-review");
}

function isReworkReviewTask(task: TaskNode): boolean {
  return task.kind === "rework_review" || task.id.endsWith("-rework-review");
}

function isFrontierReplanTask(task: TaskNode): boolean {
  return task.kind === "frontier_replan" || task.id.startsWith("project-frontier-replan");
}

function isPlanningLoopRunId(id: string): boolean {
  return id === PROJECT_PLANNING_LOOP_RUN_ID || new RegExp(`^${PROJECT_PLANNING_LOOP_RUN_ID}-\\d+$`).test(id);
}

function isPlanningLoopRunTask(task: TaskNode): boolean {
  return isPlanningLoopRunId(task.id) && task.parent_id === PROJECT_PLANNING_LOOP_ID;
}

function isPlanningLoopTask(task: TaskNode): boolean {
  return task.kind === "loop_task" || task.id === PROJECT_PLANNING_LOOP_ID || isPlanningLoopRunId(task.id);
}

function isDomainPlannerTask(task: TaskNode): boolean {
  return task.kind === "domain_planner";
}

function isHumanQuestionTask(task: TaskNode): boolean {
  return task.kind === "human_question" || task.owner === "human";
}

function isReviewTask(task: TaskNode): boolean {
  return isBlockedReviewTask(task) || isParentReviewTask(task) || isReworkReviewTask(task);
}

function isFastLocalUiTask(task: TaskNode): boolean {
  const text = [
    task.id,
    task.goal,
    ...task.inputs,
    ...task.outputs,
    ...(task.conflict_scope ?? []),
  ].join("\n");
  return /(?:^|\/|:)ui(?:\/|:)|\.app\/ui\//i.test(text);
}

function isSerializedExecutionTask(task: TaskNode): boolean {
  return isReviewTask(task) || isGlobalSerializedExecutionTask(task);
}

function isGlobalSerializedExecutionTask(task: TaskNode): boolean {
  return isFrontierReplanTask(task) || isPlanningLoopTask(task) || isDomainPlannerTask(task) || isHumanQuestionTask(task);
}

function clearSyntheticBlocker(task: TaskNode): void {
  if (!task.blocker) return;
  if (
    task.blocker.startsWith("Required child task is blocked:")
    || task.blocker.startsWith("Blocked task reviewed by")
    || task.blocker.startsWith("Task is not executable:")
    || task.blocker.startsWith("Worker session was interrupted or cancelled")
    || task.blocker.startsWith("Worker session errored")
    || task.blocker.startsWith("Claim includes a failed required validation/check")
  ) {
    task.blocker = undefined;
  }
}

function hasExternalBlockSignal(task: TaskNode, evidenceText = ""): boolean {
  if (task.kind === "human_question") return true;
  if (hasClosedGate(task) || task.gates.some(isBlockingGate)) return true;
  // Budget-exhausted planning loop requires human review — treat as external block
  if (isPlanningLoopTask(task) && /Planning loop exhausted/.test(task.blocker ?? "")) return true;
  if (isReviewTask(task) || isFrontierReplanTask(task) || isPlanningLoopTask(task) || isDomainPlannerTask(task)) return false;
  if (task.owner === "human") return true;
  if (task.verification?.verdict === "rejected") return false;
  if (/validation|validator|check failed|failed required|not executable|no-work|waiting claims are not terminal/i.test(task.blocker ?? "")) return false;
  const text = [
    task.goal,
    task.blocker,
    task.gates.join("\n"),
    evidenceText,
  ].filter(Boolean).join("\n");
  return /(?:external|credential|auth|token|azure cli|\baz\b|owner|capacity|quota|rollout|environment|precondition|human|input|approval|unsafe|safety|not installed|unavailable|source signal|subscription|msi|hcp|staging)/i.test(text);
}

function isPlanningLoopBudgetExhausted(task: TaskNode): boolean {
  return task.id === PROJECT_PLANNING_LOOP_ID
    && task.status === "blocked"
    && /Planning loop exhausted/.test(task.blocker ?? "");
}

function isRecoverableBlockedClaim(task: TaskNode): boolean {
  if (hasExternalBlockSignal(task)) return false;
  return isReviewTask(task) || isFrontierReplanTask(task) || isPlanningLoopTask(task) || isDomainPlannerTask(task);
}

function blockedClaimIsExternal(task: TaskNode, attempt: TaskAttempt): boolean {
  return hasExternalBlockSignal(task, attempt.summary);
}

function ordinaryBacklogLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(item => isLeaf(item))
    .filter(item => ["proposed", "ready", "active", "claimed_done"].includes(item.status))
    .filter(item => !isSerializedExecutionTask(item))
    .filter(item => isClearEnough(item).ok && !hasClosedGate(item))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id));
}

function taskConflictScope(task: TaskNode): string[] {
  return task.conflict_scope?.length ? unique(task.conflict_scope) : unique(task.outputs);
}

function conflictScopesOverlap(a: TaskNode, b: TaskNode): boolean {
  const left = taskConflictScope(a);
  const right = new Set(taskConflictScope(b));
  return left.some(item => right.has(item));
}

function selectDispatchableLeaves(tree: TaskTree, maxConcurrent: number): TaskNode[] {
  const active = activeLeaves(tree);
  if (active.some(isGlobalSerializedExecutionTask)) return [];
  const capacity = Math.max(0, maxConcurrent - active.length);
  if (capacity <= 0) return [];

  const selected: TaskNode[] = [];
  const ready = findReadyLeaves(tree);
  const hasNonPlanningReady = ready.some(candidate => !isPlanningLoopTask(candidate));
  for (const candidate of ready) {
    if (selected.length >= capacity) break;
    const clarity = isClearEnough(candidate);
    if (!clarity.ok || hasClosedGate(candidate)) continue;
    if (hasNonPlanningReady && isPlanningLoopTask(candidate)) continue;
    if (isGlobalSerializedExecutionTask(candidate)) {
      if (active.length === 0 && selected.length === 0) {
        selected.push(candidate);
        break;
      }
      continue;
    }
    if (isReviewTask(candidate)) {
      if ([...active, ...selected].some(other => conflictScopesOverlap(other, candidate))) continue;
      selected.push(candidate);
      continue;
    }
    if ([...active, ...selected].some(other => conflictScopesOverlap(other, candidate))) continue;
    selected.push(candidate);
  }
  return selected;
}

function leaseTask(task: TaskNode, worker: string): void {
  task.status = "active";
  task.claimed_by = worker;
  task.lease_expires_at = new Date(Date.now() + 30 * 60_000).toISOString();
}

function activeLeaseIsMissingOrExpired(task: TaskNode): boolean {
  if (task.status !== "active") return false;
  if (!task.lease_expires_at) return true;
  const expires = Date.parse(task.lease_expires_at);
  return !Number.isFinite(expires) || expires <= Date.now();
}

function requeueStaleActiveLeaves(ctx: WorkflowContext, tree: TaskTree): string[] {
  const requeued: string[] = [];
  for (const taskNode of Object.values(tree.tasks)) {
    if (!isLeaf(taskNode) || !activeLeaseIsMissingOrExpired(taskNode)) continue;
    taskNode.status = "ready";
    taskNode.claimed_by = undefined;
    taskNode.lease_expires_at = undefined;
    emitTaskEvent(ctx, "task.requeued", taskNode, { reason: "missing-or-expired-active-lease" });
    requeued.push(taskNode.id);
  }
  normalizeActiveTaskPointer(tree);
  return requeued;
}

function dispatchTaskExecutionEvents(ctx: WorkflowContext, config: EngineConfig, tree: TaskTree): string[] {
  const selected = selectDispatchableLeaves(tree, config.maxConcurrent);
  for (const taskNode of selected) {
    leaseTask(taskNode, config.worker);
    emitTaskEvent(ctx, "task.started", taskNode, {
      mode: "event-dispatch",
      claimed_by: taskNode.claimed_by,
      lease_expires_at: taskNode.lease_expires_at,
    });
    try {
      ctx.dispatchEvent("project.task.execution.requested", {
        project: "aks-rp-e2e",
        taskId: taskNode.id,
        worker: config.worker,
        lease_expires_at: taskNode.lease_expires_at,
        requested_by: "project-execution-engine",
      });
    } catch {
      // Local test contexts may not provide a real dispatcher.
    }
  }
  normalizeActiveTaskPointer(tree);
  return selected.map(taskNode => taskNode.id);
}

function collectTaskSubtreeIds(tree: TaskTree, taskId: string, collected = new Set<string>()): Set<string> {
  if (collected.has(taskId)) return collected;
  const taskNode = tree.tasks[taskId];
  if (!taskNode) return collected;
  collected.add(taskId);
  for (const childId of taskNode.children) collectTaskSubtreeIds(tree, childId, collected);
  return collected;
}

function linkMergedTaskParents(tree: TaskTree, mergedIds: Set<string>): void {
  for (const id of mergedIds) {
    const taskNode = tree.tasks[id];
    if (!taskNode?.parent_id) continue;
    const parent = tree.tasks[taskNode.parent_id];
    if (!parent) continue;
    parent.children = unique([...parent.children, id]);
  }
}

function saveTaskBranchIntoLatest(config: EngineConfig, localTree: TaskTree, taskId: string): TaskTree {
  return withTreeLock(config, () => {
    const localTask = localTree.tasks[taskId];
    if (!localTask) {
      saveTreeUnlocked(config, localTree);
      return localTree;
    }

    if (isSerializedExecutionTask(localTask)) {
      saveTreeUnlocked(config, localTree);
      return localTree;
    }

    const latestTree = loadTree(config);
    const mergedIds = collectTaskSubtreeIds(localTree, taskId);
    for (const id of mergedIds) {
      const taskNode = localTree.tasks[id];
      if (taskNode) latestTree.tasks[id] = taskNode;
    }
    linkMergedTaskParents(latestTree, mergedIds);
    const mergedTask = latestTree.tasks[taskId];
    if (mergedTask) {
      rollUpParent(latestTree, mergedTask);
      verifyClaimedParents(latestTree, config.owner);
    }
    saveTreeUnlocked(config, latestTree);
    return latestTree;
  });
}

function blockUnexecutableReadyLeaves(ctx: WorkflowContext, tree: TaskTree): string[] {
  const blocked: string[] = [];
  for (const taskNode of findReadyLeaves(tree)) {
    const clarity = isClearEnough(taskNode);
    if (!clarity.ok) {
      const reason = `Task is not executable: ${clarity.reason}`;
      taskNode.status = "rejected";
      taskNode.blocker = reason;
      ensureReworkReviewTask(tree, taskNode, reason);
      emitTaskEvent(ctx, "task.rejected", taskNode, { reason });
      rollUpParent(tree, taskNode);
      blocked.push(taskNode.id);
      continue;
    }
    if (hasClosedGate(taskNode)) {
      taskNode.status = "blocked";
      taskNode.blocker = taskNode.blocker ?? `Closed gate: ${taskNode.gates.join("; ")}`;
      emitTaskEvent(ctx, "task.blocked", taskNode, { reason: taskNode.blocker ?? "gate closed" });
      rollUpParent(tree, taskNode);
      blocked.push(taskNode.id);
    }
  }
  normalizeActiveTaskPointer(tree);
  return blocked;
}

function promoteClearBacklogLeaves(ctx: WorkflowContext, tree: TaskTree): string[] {
  const promoted: string[] = [];
  for (const taskNode of findProposedLeaves(tree)) {
    const clarity = isClearEnough(taskNode);
    if (!clarity.ok || hasClosedGate(taskNode)) continue;
    taskNode.status = "ready";
    emitTaskEvent(ctx, "task.promoted", taskNode, { from: "proposed", to: "ready" });
    reopenAncestorPathForReadyWork(tree, taskNode);
    promoted.push(taskNode.id);
  }
  normalizeActiveTaskPointer(tree);
  return promoted;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function addChild(tree: TaskTree, parent: TaskNode, child: TaskNode): void {
  tree.tasks[child.id] = child;
  parent.children = unique([...(parent.children ?? []), child.id]);
  if (parent.status === "blocked" || parent.status === "ready" || parent.status === "rejected") parent.status = "decomposed";
  parent.progress = parent.progress ?? { accepted: 0, blocked: 0, total: parent.children.length };
  parent.progress.total = parent.children.length;
}

function blockedReviewOutput(id: string): string {
  return `evidence/archive/${id}.md`;
}

function reviewOutput(id: string): string {
  return `evidence/archive/${id}.md`;
}

function createBlockedFrontierReview(tree: TaskTree, root: TaskNode): TaskNode | null {
  const id = "blocked-frontier-review";
  if (tree.tasks[id]) {
    if (!root.children.includes(id)) root.children = unique([...root.children, id]);
    return null;
  }

  return task(id, {
    parent_id: root.id,
    kind: "blocked_review",
    status: "ready",
    priority: "P0",
    owner: root.owner ?? "aks-explorer",
    goal: "Review the whole blocked frontier and decide which blockers are real, stale, too coarse, missing evidence, or locally unblockable.",
    inputs: unique([
      ".app/project.md",
      ".app/tasks/tree.json",
      "model/knowledge-map/views/path-summary.json",
      "reports/current.md",
    ]),
    outputs: [blockedReviewOutput(id)],
    acceptance: [
      "Classifies every blocked leaf as confirmed_external, can_unblock_locally, needs_split, wrongly_blocked, or needs_human.",
      "Creates or describes concrete ready child tasks for safe local unblock/review work.",
      "Leaves externally gated cloud/staging work blocked unless gate evidence is recorded.",
      "Writes a review artifact with blocker evidence, decisions, and next task-tree changes.",
    ],
    forbidden: [
      "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
      "Do not mark a live execution gate satisfied without exact credential/auth evidence.",
      "Do not delete prior blocker evidence; supersede stale blockers with a recorded reason.",
    ],
    gates: [],
  });
}

function createBranchBlockedReview(parent: TaskNode): TaskNode {
  const id = `${parent.id}-blocker-review`;
  return task(id, {
    parent_id: parent.id,
    kind: "blocked_review",
    status: "ready",
    priority: parent.priority ?? "P1",
    owner: parent.owner ?? "aks-explorer",
    goal: `Review why task ${parent.id} is blocked and identify any safe local work that can unblock, split, or correct it.`,
    inputs: unique([
      ".app/project.md",
      ".app/tasks/tree.json",
      ...parent.inputs,
      ...parent.outputs,
    ]),
    outputs: [blockedReviewOutput(id)],
    acceptance: [
      "States whether the blocker is confirmed_external, stale, unclear, too_coarse, missing_evidence, unsafe, or wrongly_blocked.",
      "If safe local work exists, creates or specifies the next ready child task with goal, inputs, outputs, acceptance, gates, and forbidden actions.",
      "If only an external gate remains, records the exact resume condition and why no local work should proceed.",
      "Writes a review artifact with exact evidence and task-tree recommendation.",
    ],
    forbidden: [
      "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
      "Do not satisfy or bypass gates from prose alone.",
      "Do not rewrite unrelated task branches.",
    ],
    gates: [],
  });
}

function createParentReview(parent: TaskNode, reason: string): TaskNode {
  const id = `${parent.id}-rollup-review`;
  return task(id, {
    parent_id: parent.id,
    kind: "parent_review",
    status: "ready",
    priority: parent.priority ?? "P1",
    owner: parent.owner ?? "aks-explorer",
    goal: `Audit parent task ${parent.id} after child rollup: ${reason}`,
    inputs: unique([
      ".app/project.md",
      ".app/tasks/tree.json",
      ...parent.inputs,
      ...parent.outputs,
    ]),
    outputs: [reviewOutput(id)],
    acceptance: [
      "Reviews the parent goal, child states, evidence, blockers, and acceptance criteria.",
      "States whether the parent should be accepted, remain blocked, be split further, or continue with another child task.",
      "Records exact next actions without directly editing .app/tasks/tree.json.",
      "Writes a review artifact with evidence-backed reasoning.",
    ],
    forbidden: [
      "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
      "Do not edit .app/tasks/tree.json directly; the engine owns task-tree mutation.",
      "Do not mark gates satisfied without exact gate evidence.",
    ],
    gates: [],
  });
}

function nextFrontierReplanId(tree: TaskTree): string {
  const base = "project-frontier-replan";
  if (!tree.tasks[base]) return base;
  let index = 2;
  while (tree.tasks[`${base}-${index}`]) index++;
  return `${base}-${index}`;
}

function taskLastActivityTs(task: TaskNode): string {
  return [
    task.verification?.ts,
    ...(task.attempts ?? []).map(attempt => attempt.ts),
  ].filter((value): value is string => Boolean(value)).sort().at(-1) ?? "";
}

function frontierChangedAfterReplan(tree: TaskTree, root: TaskNode, replan: TaskNode): boolean {
  const replanTs = taskLastActivityTs(replan);
  if (!replanTs) return true;
  const rootSubtree = collectTaskSubtreeIds(tree, root.id);
  return [...rootSubtree]
    .map(id => tree.tasks[id])
    .filter((item): item is TaskNode => Boolean(item && item.id !== replan.id && !isFrontierReplanTask(item)))
    .some(item => taskLastActivityTs(item) > replanTs);
}

function createFrontierReplan(root: TaskNode, id: string): TaskNode {
  return task(id, {
    parent_id: root.id,
    kind: "frontier_replan",
    status: "ready",
    priority: "P0",
    owner: root.owner ?? "aks-explorer",
    goal: "Replan the active project frontier: decide whether the current blocked state still leaves safe local/domain work, then add a batch of concrete proposed tasks when it does.",
    inputs: unique([
      ".app/project.md",
      ".app/tasks/tree.json",
      "reports/current.md",
      "model/knowledge-map/model.json",
      "model/knowledge-map/views/path-summary.json",
      "specs/index.json",
      "evidence/archive/blocked-frontier-review.md",
    ]),
    outputs: [reviewOutput(id)],
    acceptance: [
      "Audits whether the root project goal is achieved, blocked, or still has local/domain work available.",
      "Inspects unknown, failing, blocked, or weakly evidenced feature paths for safe local next work.",
      "Adds a batch of 5-10 concrete proposed child tasks to .app/tasks/tree.json when enough safe local work exists; each task has goal, inputs, outputs, acceptance, gates, forbidden actions, and conflict_scope.",
      "If fewer than 5 safe tasks exist, adds every concrete safe task it can find and explains why the batch is smaller.",
      "If no safe local work exists, writes exact evidence and unblock triggers instead of claiming the project goal is achieved.",
      "Writes a replan artifact summarizing the decision and task-tree changes.",
    ],
    forbidden: [
      "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
      "Do not mark external gates satisfied without exact gate evidence.",
      "Do not treat a blocked active project as complete.",
      "Do not rewrite unrelated task history; add or update only concrete next-work tasks.",
    ],
    gates: [],
  });
}

function ensureProjectControlTree(tree: TaskTree): { control: TaskNode; loop: TaskNode; history: TaskNode } | null {
  const root = tree.tasks[tree.root_task_id];
  if (!root) return null;

  let control = tree.tasks[PROJECT_CONTROL_ID];
  if (!control) {
    control = task(PROJECT_CONTROL_ID, {
      parent_id: root.id,
      kind: "work",
      status: "decomposed",
      priority: "P0",
      owner: root.owner ?? "aks-explorer",
      goal: "Visible control plane for standing project loops, planning, hygiene, and runtime audit.",
      inputs: [".app/project.md", ".app/tasks/tree.json"],
      outputs: [".app/tasks/tree.json", ".app/planner-runs.jsonl"],
      acceptance: ["Standing loop responsibilities are visible and linked to workflow/run history."],
      forbidden: ["Do not hide project-control work from the task tree; collapse it in UI if needed."],
      gates: [],
    });
    addChild(tree, root, control);
  } else if (!root.children.includes(control.id)) {
    root.children = unique([...root.children, control.id]);
  }

  let history = tree.tasks[PROJECT_PLANNING_HISTORY_ID];
  if (!history) {
    history = task(PROJECT_PLANNING_HISTORY_ID, {
      parent_id: control.id,
      kind: "work",
      status: "accepted",
      priority: "P3",
      owner: control.owner ?? "aks-explorer",
      goal: "Archived planning run task nodes kept for audit. New planning runs should be recorded in .app/planner-runs.jsonl instead of creating top-level replan tasks.",
      inputs: [".app/tasks/tree.json", ".app/planner-runs.jsonl"],
      outputs: [".app/planner-runs.jsonl"],
      acceptance: ["Legacy planner task nodes are kept out of the root project decomposition."],
      forbidden: ["Do not schedule archived planner history as executable project work."],
      gates: [],
    });
    addChild(tree, control, history);
  } else {
    history.parent_id = control.id;
    if (!control.children.includes(history.id)) control.children = unique([...control.children, history.id]);
  }

  let loop = tree.tasks[PROJECT_PLANNING_LOOP_ID];
  if (!loop) {
    loop = task(PROJECT_PLANNING_LOOP_ID, {
      parent_id: control.id,
      kind: "loop_task",
      workflow: "project-planner",
      wake_on: [
        "project.task.completed",
        "project.ready.empty",
        "project.backlog.low",
        "project.comment.created",
        "project.action.invoked",
      ],
      status: "accepted",
      priority: "P0",
      owner: control.owner ?? "aks-explorer",
      goal: "Standing planning loop: review the project frontier, maintain backlog, and create/refine concrete AKS domain tasks.",
      inputs: unique([
        ".app/project.md",
        ".app/tasks/tree.json",
        "reports/current.md",
        "model/knowledge-map/model.json",
        "model/knowledge-map/views/path-summary.json",
        "specs/index.json",
        "evidence/archive/feature-learning-queue.md",
      ]),
      outputs: ["evidence/archive/project-planning-loop.md", ".app/planner-runs.jsonl", ".app/tasks/tree.json"],
      acceptance: [
        "Audits whether the root project goal is achieved, blocked, or still has local/domain work available.",
        "Inspects unknown, failing, blocked, or weakly evidenced feature paths for safe local next work.",
        "Adds a batch of 5-10 concrete proposed child tasks under meaningful domain parents when enough safe local work exists; each task has goal, inputs, outputs, acceptance, gates, forbidden actions, and conflict_scope.",
        "If fewer than 5 safe tasks exist, adds every concrete safe task it can find and explains why the batch is smaller.",
        "If no safe local work exists, writes exact evidence and unblock triggers instead of claiming the project goal is achieved.",
        "Writes a planning artifact summarizing the decision and task-tree changes.",
      ],
      forbidden: [
        "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
        "Do not mark external gates satisfied without exact gate evidence.",
        "Do not treat a blocked active project as complete.",
        "Do not create new root project-frontier-replan-* tasks; record planning executions as loop runs and parent generated work under domain containers.",
      ],
      gates: [],
    });
    addChild(tree, control, loop);
  } else {
    loop.parent_id = control.id;
    loop.kind = "loop_task";
    loop.workflow = loop.workflow ?? "project-planner";
    loop.wake_on = loop.wake_on?.length ? loop.wake_on : [
      "project.task.completed",
      "project.ready.empty",
      "project.backlog.low",
      "project.comment.created",
      "project.action.invoked",
    ];
    if (!control.children.includes(loop.id)) control.children = unique([...control.children, loop.id]);
  }

  return { control, loop, history };
}

function isDescendantOf(tree: TaskTree, task: TaskNode, ancestorId: string): boolean {
  let current = task.parent_id ? tree.tasks[task.parent_id] : undefined;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    if (current.id === ancestorId) return true;
    seen.add(current.id);
    current = current.parent_id ? tree.tasks[current.parent_id] : undefined;
  }
  return false;
}

function isControlOrArchivedPlanningTask(tree: TaskTree, task: TaskNode): boolean {
  return task.id === PROJECT_CONTROL_ID
    || task.id === PROJECT_PLANNING_LOOP_ID
    || isDescendantOf(tree, task, PROJECT_PLANNING_LOOP_ID)
    || task.id === PROJECT_PLANNING_HISTORY_ID
    || isDescendantOf(tree, task, PROJECT_PLANNING_HISTORY_ID);
}

function createPlanningLoopRun(tree: TaskTree, loop: TaskNode): TaskNode {
  const id = nextUniqueTaskId(tree, PROJECT_PLANNING_LOOP_RUN_ID);
  const run = task(id, {
    parent_id: loop.id,
    kind: "loop_task",
    workflow: loop.workflow ?? "project-planner",
    wake_on: loop.wake_on,
    status: "ready",
    priority: loop.priority ?? "P0",
    owner: loop.owner ?? "aks-explorer",
    goal: loop.goal,
    inputs: [...loop.inputs],
    outputs: [...loop.outputs],
    acceptance: [...loop.acceptance],
    forbidden: [...loop.forbidden],
    gates: [],
    conflict_scope: ["project-control:planning-loop"],
  });
  addChild(tree, loop, run);
  return run;
}

function planningLoopRuns(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(isPlanningLoopRunTask)
    .sort((a, b) => planningLoopRunOrdinal(a.id) - planningLoopRunOrdinal(b.id));
}

function planningLoopRunOrdinal(id: string): number {
  if (id === PROJECT_PLANNING_LOOP_RUN_ID) return 1;
  const match = id.match(new RegExp(`^${PROJECT_PLANNING_LOOP_RUN_ID}-(\\d+)$`));
  return match ? Number.parseInt(match[1], 10) : 0;
}

function planningLoopRunFreshnessRank(task: TaskNode): number {
  const statusRank = task.status === "active" || task.status === "claimed_done" ? 10 : task.status === "ready" ? 5 : 0;
  return statusRank * 1_000_000 + planningLoopRunOrdinal(task.id);
}

/**
 * Count consecutive failed (superseded) planning runs from the most recent
 * backwards. The count resets when a run with "accepted" or "decomposed"
 * status is encountered (evidence of genuine progress).
 */
function consecutiveFailedPlanningRuns(tree: TaskTree): number {
  const runs = planningLoopRuns(tree);
  let count = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].status === "superseded") {
      count++;
    } else if (runs[i].status === "accepted" || runs[i].status === "decomposed") {
      break;
    }
    // Skip other statuses (ready/active/claimed_done/blocked/rejected) —
    // these are live or in-progress, not evidence of failure.
  }
  return count;
}

function ensurePlanningLoopRun(tree: TaskTree, loop: TaskNode): TaskNode {
  const existingRuns = planningLoopRuns(tree);
  const liveRun = existingRuns.find(child => isLeaf(child) && ["ready", "active", "claimed_done"].includes(child.status));
  if (liveRun) return liveRun;

  const reusableRun = existingRuns
    .filter(child => isLeaf(child) && ["accepted", "blocked", "rejected", "superseded"].includes(child.status))
    .sort((a, b) => (b.verification?.ts ?? "").localeCompare(a.verification?.ts ?? ""))[0];
  if (reusableRun) {
    reusableRun.status = "ready";
    reusableRun.blocker = undefined;
    reusableRun.verification = undefined;
    reusableRun.claimed_by = undefined;
    reusableRun.lease_expires_at = undefined;
    reusableRun.gate_status = undefined;
    reusableRun.kind = "loop_task";
    reusableRun.workflow = loop.workflow ?? reusableRun.workflow ?? "project-planner";
    reusableRun.wake_on = loop.wake_on;
    reusableRun.goal = loop.goal;
    reusableRun.inputs = [...loop.inputs];
    reusableRun.outputs = [...loop.outputs];
    reusableRun.acceptance = [...loop.acceptance];
    reusableRun.forbidden = [...loop.forbidden];
    reusableRun.gates = [];
    reusableRun.conflict_scope = ["project-control:planning-loop"];
    return reusableRun;
  }

  return createPlanningLoopRun(tree, loop);
}

function supersedeTask(taskNode: TaskNode, reason: string): void {
  taskNode.status = "superseded";
  taskNode.claimed_by = undefined;
  taskNode.lease_expires_at = undefined;
  taskNode.blocker = reason;
  taskNode.verification = {
    ts: nowIso(),
    verifier: "project-execution-engine",
    verdict: "accepted",
    reason,
    criteria: taskNode.acceptance.map(item => ({ item, result: "not_proven" })),
  };
}

function suppressStalePlanningLoopBranches(tree: TaskTree): string[] {
  const loop = tree.tasks[PROJECT_PLANNING_LOOP_ID];
  if (!loop) return [];

  const liveRuns = planningLoopRuns(tree)
    .filter(item => isLeaf(item) && ["ready", "active", "claimed_done"].includes(item.status))
    .sort((a, b) => planningLoopRunFreshnessRank(b) - planningLoopRunFreshnessRank(a));
  if (liveRuns.length === 0) return [];

  const keepRun = liveRuns[0];
  const changed: string[] = [];
  const reason = `Superseded by fresher executable planning loop run ${keepRun.id}; stale control-loop recovery should not block project progress.`;

  for (const duplicate of liveRuns.slice(1)) {
    supersedeTask(duplicate, reason);
    changed.push(duplicate.id);
  }

  const keepSubtree = collectTaskSubtreeIds(tree, keepRun.id);
  for (const candidate of Object.values(tree.tasks)) {
    if (keepSubtree.has(candidate.id)) continue;
    if (!isDescendantOf(tree, candidate, PROJECT_PLANNING_LOOP_ID)) continue;
    if (!isReviewTask(candidate)) continue;
    if (isSettled(candidate)) continue;
    if (!["ready", "active", "claimed_done", "rejected"].includes(candidate.status)) continue;
    supersedeTask(candidate, reason);
    changed.push(candidate.id);

    const parent = candidate.parent_id ? tree.tasks[candidate.parent_id] : undefined;
    if (parent && isPlanningLoopRunTask(parent) && parent.id !== keepRun.id && !isSettled(parent)) {
      supersedeTask(parent, reason);
      changed.push(parent.id);
    }
  }

  normalizeActiveTaskPointer(tree);
  return unique(changed);
}

function attemptWasInterrupted(attempt: TaskAttempt): boolean {
  return attempt.open_risks.some(risk => /worker session (?:interrupted|cancelled)/i.test(risk))
    || /\*\*Status:\*\*\s*(?:interrupted|cancelled|canceled)/i.test(attempt.summary);
}

function interruptedAttemptCount(task: TaskNode): number {
  return (task.attempts ?? []).filter(attemptWasInterrupted).length;
}

function recoverStalledPlanningLoopRework(tree: TaskTree): string | null {
  const loop = tree.tasks[PROJECT_PLANNING_LOOP_ID];
  if (!loop) return null;
  for (const candidate of Object.values(tree.tasks)) {
    if (!isReviewTask(candidate)) continue;
    if (!isDescendantOf(tree, candidate, PROJECT_PLANNING_LOOP_ID)) continue;
    if (!["ready", "active", "claimed_done", "rejected"].includes(candidate.status)) continue;
    if (interruptedAttemptCount(candidate) < MAX_INTERRUPTED_CONTROL_REWORK_ATTEMPTS) continue;

    candidate.status = "superseded";
    candidate.claimed_by = undefined;
    candidate.lease_expires_at = undefined;
    candidate.blocker = `Superseded after ${interruptedAttemptCount(candidate)} interrupted control-loop recovery attempt(s); a fresh planning loop run will continue the project.`;
    candidate.verification = {
      ts: nowIso(),
      verifier: "project-execution-engine",
      verdict: "accepted",
      reason: candidate.blocker,
      criteria: candidate.acceptance.map(item => ({ item, result: "not_proven" })),
    };

    const parent = candidate.parent_id ? tree.tasks[candidate.parent_id] : undefined;
    if (parent && isDescendantOf(tree, parent, PROJECT_PLANNING_LOOP_ID)) {
      parent.status = "superseded";
      parent.claimed_by = undefined;
      parent.lease_expires_at = undefined;
      parent.blocker = candidate.blocker;
    }

    // Budget cap: stop creating new planning runs after too many consecutive failures
    const failedCount = consecutiveFailedPlanningRuns(tree);
    if (failedCount >= MAX_CONSECUTIVE_FAILED_PLANNING_RUNS) {
      loop.status = "blocked";
      loop.blocker = `Planning loop exhausted after ${failedCount} consecutive failed runs — requires human review or scope reduction.`;
      tree.active_task_id = null;
      return null;
    }

    const run = createPlanningLoopRun(tree, loop);
    reopenAncestorPathForReadyWork(tree, run);
    tree.active_task_id = run.id;
    return run.id;
  }
  return null;
}

function isUnfinishedProjectFrontierTask(tree: TaskTree, taskNode: TaskNode, seen = new Set<string>()): boolean {
  if (seen.has(taskNode.id)) return false;
  seen.add(taskNode.id);
  if (taskNode.id === tree.root_task_id) return false;
  if (isControlOrArchivedPlanningTask(tree, taskNode)) return false;
  if (isFrontierReplanTask(taskNode)) {
    return taskNode.children
      .map(id => tree.tasks[id])
      .filter((child): child is TaskNode => Boolean(child))
      .some(child => isUnfinishedProjectFrontierTask(tree, child, seen));
  }
  if (isReviewTask(taskNode) || isFrontierReplanTask(taskNode) || isHumanQuestionTask(taskNode)) return false;
  if (isSettled(taskNode)) return false;

  if (isLeaf(taskNode)) {
    return ["proposed", "ready", "active", "claimed_done", "blocked"].includes(taskNode.status);
  }

  return taskNode.children
    .map(id => tree.tasks[id])
    .filter((child): child is TaskNode => Boolean(child))
    .some(child => isUnfinishedProjectFrontierTask(tree, child, seen));
}

function hasUnfinishedProjectFrontierWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(taskNode => {
    if (taskNode.id === tree.root_task_id) return false;
    return isUnfinishedProjectFrontierTask(tree, taskNode);
  });
}

function hasOrdinaryReadyWork(tree: TaskTree): boolean {
  return findReadyLeaves(tree).some(taskNode => !isSerializedExecutionTask(taskNode));
}

function hasImmediateReviewRecoveryWork(tree: TaskTree): boolean {
  return findReadyLeaves(tree).some(taskNode => isBlockedReviewTask(taskNode) || isParentReviewTask(taskNode));
}

function ensureFrontierReplanTask(tree: TaskTree): string | null {
  if (ordinaryBacklogLeaves(tree).length >= ORDINARY_BACKLOG_LOW_WATERMARK) return null;
  if (tree.project_lifecycle !== "active") return null;
  const root = tree.tasks[tree.root_task_id];
  if (!root) return null;
  if (activeLeaves(tree).length > 0 || hasOrdinaryReadyWork(tree) || hasImmediateReviewRecoveryWork(tree)) return null;
  const hasBlockedWork = Object.values(tree.tasks)
    .some(item => item.status === "blocked" && !isReviewTask(item) && !isHumanQuestionTask(item));
  if (!hasBlockedWork && !hasUnfinishedProjectFrontierWork(tree)) return null;
  const control = ensureProjectControlTree(tree);
  if (!control) return null;
  const loop = control.loop;
  const existingLoopRun = loop.children
    .map(id => tree.tasks[id])
    .find((child): child is TaskNode => Boolean(child && isPlanningLoopRunTask(child) && isLeaf(child) && ["ready", "active", "claimed_done"].includes(child.status)));
  if (existingLoopRun) return null;
  const loopHasPendingRework = Object.values(tree.tasks)
    .some(item => isDescendantOf(tree, item, loop.id) && isReworkReviewTask(item) && !isSettled(item));
  if (loopHasPendingRework) return null;

  const replans = root.children
    .map(id => tree.tasks[id])
    .filter((child): child is TaskNode => Boolean(child && isFrontierReplanTask(child)));
  const existing = replans.find(child => isLeaf(child) && ["ready", "active", "claimed_done"].includes(child.status));
  if (existing) {
    existing.status = "superseded";
    existing.blocker = `Superseded by stable ${PROJECT_PLANNING_LOOP_ID}; planning executions are now loop runs, not root tasks.`;
  }
  const latestSettled = replans
    .filter(child => ["accepted", "blocked"].includes(child.status))
    .sort((a, b) => (b.verification?.ts ?? "").localeCompare(a.verification?.ts ?? ""))[0];
  if (latestSettled?.status === "blocked" && !hasUnfinishedProjectFrontierWork(tree)) return null;
  const stale = replans.find(child => isLeaf(child) && !isSettled(child));
  if (stale) {
    stale.status = "superseded";
    stale.blocker = `Superseded by stable ${PROJECT_PLANNING_LOOP_ID}; planning executions are now loop runs, not root tasks.`;
  }
  const loopRun = ensurePlanningLoopRun(tree, loop);
  loop.status = "decomposed";
  loop.blocker = undefined;
  loop.verification = undefined;
  loop.claimed_by = undefined;
  loop.lease_expires_at = undefined;
  reopenAncestorPathForReadyWork(tree, loopRun);
  return loopRun.id;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

function slugFeatureName(name: string): string {
  const withoutQualifier = stripMarkdown(name).replace(/\s*\([^)]*\)\s*/g, " ").trim();
  return withoutQualifier
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFeatureLearningQueue(content: string): FeatureQueueItem[] {
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("|") && line.endsWith("|"))
    .map(line => line.slice(1, -1).split("|").map(cell => cell.trim()))
    .filter(cells => cells.length >= 6)
    .filter(cells => !/^#$/i.test(stripMarkdown(cells[0])) && !/^-+$/.test(cells[0].replace(/\s/g, "")))
    .map(cells => {
      const name = stripMarkdown(cells[1]);
      return {
        row: Number.parseInt(stripMarkdown(cells[0]), 10),
        name,
        slug: slugFeatureName(name),
        stage: stripMarkdown(cells[2]),
        status: stripMarkdown(cells[3]).toLowerCase(),
        safeLocalWork: stripMarkdown(cells[4]),
      };
    })
    .filter(item => Number.isFinite(item.row) && Boolean(item.slug));
}

function hasSafeLocalQueueWork(item: FeatureQueueItem): boolean {
  return /^yes\b/i.test(item.safeLocalWork) && !["blocked", "done"].includes(item.status);
}

function nextUniqueTaskId(tree: TaskTree, base: string): string {
  if (!tree.tasks[base]) return base;
  let index = 2;
  while (tree.tasks[`${base}-${index}`]) index++;
  return `${base}-${index}`;
}

function existingFeatureTask(tree: TaskTree, slug: string): TaskNode | undefined {
  return tree.tasks[`feature-${slug}`];
}

function pendingFeatureAdvanceTask(tree: TaskTree, slug?: string): TaskNode | undefined {
  return Object.values(tree.tasks).find(item => {
    if (!isDomainPlannerTask(item)) return false;
    if (!["ready", "active", "claimed_done"].includes(item.status)) return false;
    if (!item.id.startsWith("advance-feature-")) return false;
    return slug ? item.id === `advance-feature-${slug}` || item.id.startsWith(`advance-feature-${slug}-`) : true;
  });
}

function selectNextFeatureQueueItem(tree: TaskTree, config: EngineConfig): FeatureQueueItem | null {
  if (!existsSync(config.featureQueuePath)) return null;
  const queue = parseFeatureLearningQueue(readText(config.featureQueuePath));
  for (const item of queue) {
    if (!hasSafeLocalQueueWork(item)) continue;
    if (existingFeatureTask(tree, item.slug)) continue;
    if (pendingFeatureAdvanceTask(tree, item.slug)) continue;
    return item;
  }
  return null;
}

function reopenAncestorPathForReadyWork(tree: TaskTree, taskNode: TaskNode): void {
  let current: TaskNode | undefined = taskNode;
  while (current) {
    if (["blocked", "accepted", "claimed_done"].includes(current.status)) {
      current.status = "decomposed";
    }
    if (current.status === "decomposed" && current.blocker?.startsWith("Required child task is blocked:")) {
      current.blocker = undefined;
    }
    current = current.parent_id ? tree.tasks[current.parent_id] : undefined;
  }
}

function createFeatureQueueAdvanceTask(tree: TaskTree, parent: TaskNode, item: FeatureQueueItem): TaskNode {
  const id = nextUniqueTaskId(tree, `advance-feature-${item.slug}`);
  return task(id, {
    parent_id: parent.id,
    kind: "domain_planner",
    status: "ready",
    priority: item.row <= 2 ? "P0" : "P1",
    owner: parent.owner ?? "aks-explorer",
    goal: `Advance the AKS feature-learning conveyor by creating the next concrete feature-learning task for ${item.name}.`,
    inputs: unique([
      ".app/project.md",
      ".app/tasks/tree.json",
      "evidence/archive/feature-learning-queue.md",
      "model/knowledge-map/model.json",
      "model/knowledge-map/views/path-summary.json",
      "specs/index.json",
      "features/",
      "suites/",
      "replays/",
    ]),
    outputs: [
      reviewOutput(id),
      ".app/tasks/tree.json",
    ],
    acceptance: [
      `Uses queue item #${item.row} (${item.name}) as the next safe local feature-learning target.`,
      `Creates or updates feature-${item.slug} under feature-learning-loop.`,
      "Creates a batch of 3-7 concrete proposed local leaves for the feature-learning loop when enough safe local work exists, or records the exact external gate if no local leaf is safe.",
      "If fewer than 3 safe leaves exist, creates every concrete safe leaf it can find and explains why the batch is smaller.",
      "The leaf follows the standard feature-learning pattern: reference packet, input/expectation enumeration, evidence mapping, gap analysis, test-spec/probe design, model update, and closeout.",
      "Writes a reviewable planning artifact explaining the created task and any gates.",
    ],
    forbidden: [
      "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
      "Do not create cloud execution tasks unless gates and forbidden actions are explicit.",
      "Do not rewrite unrelated task branches or delete prior evidence.",
    ],
    gates: [],
  });
}

function ensureAksFeatureQueueAdvanceTask(tree: TaskTree, config: EngineConfig): string | null {
  if (findNextReadyLeaf(tree)) return null;
  if (tree.project_lifecycle !== "active") return null;
  const loop = tree.tasks["feature-learning-loop"];
  if (!loop) return null;
  const pending = pendingFeatureAdvanceTask(tree);
  if (pending) return null;
  const next = selectNextFeatureQueueItem(tree, config);
  if (!next) return null;

  const advance = createFeatureQueueAdvanceTask(tree, loop, next);
  addChild(tree, loop, advance);
  reopenAncestorPathForReadyWork(tree, loop);
  tree.active_task_id = advance.id;
  return advance.id;
}

function createReworkReview(rejected: TaskNode, reason: string): TaskNode {
  const id = `${rejected.id}-rework-review`;
  return task(id, {
    parent_id: rejected.id,
    kind: "rework_review",
    status: "ready",
    priority: rejected.priority ?? "P1",
    owner: rejected.owner ?? "aks-explorer",
    goal: `Review the rejected attempt for task ${rejected.id} and decide the next executable recovery step.`,
    inputs: unique([
      ".app/project.md",
      ".app/tasks/tree.json",
      ...rejected.inputs,
      ...rejected.outputs,
    ]),
    outputs: [reviewOutput(id)],
    acceptance: [
      `Explains why task ${rejected.id} was rejected: ${reason}`,
      "Determines whether the task should be rerun, split, corrected, superseded, or confirmed blocked.",
      "Creates or specifies concrete ready child work when local recovery is possible.",
      "Writes a review artifact with evidence-backed reasoning and exact next action.",
    ],
    forbidden: [
      "Do not run cloud mutation, kubectl against live clusters, staging probes, or `AKS_RP_E2E_DRY_RUN=0`.",
      "Do not satisfy or bypass gates from prose alone.",
      "Do not rewrite unrelated task branches.",
    ],
    conflict_scope: taskConflictScope(rejected),
    gates: [],
  });
}

function ensureReworkReviewTask(tree: TaskTree, rejected: TaskNode, reason: string): string {
  if (isReviewTask(rejected)) {
    // A failed review task should not create an infinite review-of-review chain.
    // Retry the same review leaf so the branch stays auditable without starving
    // unrelated work behind nested recovery tasks.
    rejected.status = "ready";
    rejected.blocker = undefined;
    rejected.claimed_by = undefined;
    rejected.lease_expires_at = undefined;
    return rejected.id;
  }

  const id = `${rejected.id}-rework-review`;
  const existing = tree.tasks[id];
  if (existing) {
    if (!rejected.children.includes(id)) rejected.children = unique([...rejected.children, id]);
    const existingIsExternalBlocked = existing.status === "blocked" && hasExternalBlockSignal(existing);
    if (!["ready", "active", "claimed_done", "accepted"].includes(existing.status) && !existingIsExternalBlocked) {
      existing.status = "ready";
      existing.blocker = undefined;
    }
    if (rejected.status === "rejected") rejected.status = "decomposed";
    return id;
  }

  const review = createReworkReview(rejected, reason);
  addChild(tree, rejected, review);
  return id;
}

function ensureParentReviewTask(tree: TaskTree, parent: TaskNode, reason: string): string | null {
  if (!parent.parent_id && parent.id !== tree.root_task_id) return null;
  if (isReviewTask(parent)) return null;
  const id = `${parent.id}-rollup-review`;
  const existing = tree.tasks[id];
  if (existing) {
    if (!parent.children.includes(id)) parent.children = unique([...parent.children, id]);
    if (["ready", "active", "claimed_done", "accepted"].includes(existing.status)) return null;
    if (existing.status === "blocked" && hasExternalBlockSignal(existing)) return null;
    existing.status = "ready";
    existing.blocker = undefined;
    return id;
  }
  const review = createParentReview(parent, reason);
  addChild(tree, parent, review);
  return id;
}

function ensureSettledDecomposedParentReviews(tree: TaskTree): string[] {
  if (!tree.tasks[PROJECT_PLANNING_LOOP_ID]) return [];
  const hasNonPlanningReady = findReadyLeaves(tree).some(item => !isPlanningLoopTask(item));
  if (hasNonPlanningReady) return [];

  const candidates = Object.values(tree.tasks)
    .filter(parent => parent.status === "decomposed")
    .filter(parent => parent.children.length > 0)
    .filter(parent => !isControlOrArchivedPlanningTask(tree, parent))
    .filter(parent => !isReviewTask(parent))
    .filter(parent => parent.children
      .map(id => tree.tasks[id])
      .filter((child): child is TaskNode => Boolean(child))
      .every(child => isSettled(child)))
    .filter(parent => !acceptedParentReview(tree, parent) && !pendingParentReview(tree, parent))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, b.id) - depthOf(tree, a.id) || a.id.localeCompare(b.id))
    .slice(0, 5);

  const created: string[] = [];
  for (const parent of candidates) {
    const reviewId = ensureParentReviewTask(tree, parent, "all child branches are settled but the parent remains decomposed; audit whether to accept, supersede, split, or create the next concrete child");
    if (reviewId) created.push(reviewId);
  }
  return created;
}

function acceptedParentReview(tree: TaskTree, parent: TaskNode): boolean {
  return parent.children
    .map(id => tree.tasks[id])
    .some(child => child && isParentReviewTask(child) && child.status === "accepted");
}

function pendingParentReview(tree: TaskTree, parent: TaskNode): boolean {
  return parent.children
    .map(id => tree.tasks[id])
    .some(child => child && isParentReviewTask(child) && ["ready", "active", "claimed_done"].includes(child.status));
}

function ensureBlockedReviewTasks(tree: TaskTree): string[] {
  if (findNextReadyLeaf(tree)) return [];

  const blockedLeaves = Object.values(tree.tasks)
    .filter(item => item.status === "blocked" && isLeaf(item) && !isBlockedReviewTask(item) && !isHumanQuestionTask(item))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id));

  const blockedTasks = Object.values(tree.tasks).filter(item => item.status === "blocked" && !isBlockedReviewTask(item) && !isHumanQuestionTask(item));
  if (blockedTasks.length === 0) return [];

  const created: string[] = [];
  const root = tree.tasks[tree.root_task_id];
  if (root) {
    const frontierReview = createBlockedFrontierReview(tree, root);
    if (frontierReview) {
      addChild(tree, root, frontierReview);
      created.push(frontierReview.id);
    }
  }

  for (const blockedLeaf of blockedLeaves) {
    const childId = `${blockedLeaf.id}-blocker-review`;
    if (tree.tasks[childId]) {
      if (!blockedLeaf.children.includes(childId)) blockedLeaf.children = unique([...blockedLeaf.children, childId]);
      continue;
    }
    const review = createBranchBlockedReview(blockedLeaf);
    addChild(tree, blockedLeaf, review);
    created.push(review.id);
  }

  const next = findNextReadyLeaf(tree);
  if (next) tree.active_task_id = next.id;
  return created;
}

function isClearEnough(task: TaskNode): { ok: boolean; reason?: string } {
  if (!task.goal.trim()) return { ok: false, reason: "missing goal" };
  if (task.acceptance.length === 0) return { ok: false, reason: "missing acceptance criteria" };
  if (task.outputs.length === 0) return { ok: false, reason: "missing output artifact" };
  return { ok: true };
}

function isNonBlockingSafetyGate(gate: string): boolean {
  const text = gate.trim();
  return /^no\s+(?:cloud|live)\s+mutation\b/i.test(text)
    || /^no\s+kubectl\b/i.test(text)
    || /^--check\s+only\b/i.test(text)
    || /^local\s+(?:check|preflight)\s+only\b/i.test(text)
    || /^do not run (?:cloud|live|staging|kubectl)\b/i.test(text);
}

function isBlockingGate(gate: string): boolean {
  return Boolean(gate.trim()) && !isNonBlockingSafetyGate(gate);
}

function hasClosedGate(task: TaskNode): boolean {
  return task.gates.some(isBlockingGate) && task.gate_status !== "satisfied";
}

function emitTaskEvent(ctx: WorkflowContext, type: string, task: TaskNode, extra: Record<string, unknown> = {}): void {
  try {
    ctx.dispatchEvent(type, {
      projectId: "aks-rp-e2e",
      taskId: task.id,
      status: task.status,
      ...extra,
    });
  } catch {
    // Local test contexts may not provide a real dispatcher.
  }
}

function requestContinuation(ctx: WorkflowContext, config: EngineConfig, tree: TaskTree, reason: string): void {
  const next = findNextReadyLeaf(tree);
  if (!next) {
    tree.active_task_id = null;
    return;
  }
  tree.active_task_id = next.id;
  try {
    ctx.dispatchEvent("project.execution.requested", {
      project: "aks-rp-e2e",
      reason,
      active_task_id: next.id,
      requested_by: "project-execution-engine",
    });
  } catch {
    // Local test contexts may not provide a real dispatcher.
  }
  appendJournal(config.journalPath, {
    kind: "continuation_requested",
    status: "active",
    summary: "Wake budget ended while runnable project work remained; requested another project execution event.",
    active_task_id: next.id,
  });
}

function updateProjectActiveTask(config: EngineConfig, projectContent: string, tree: TaskTree): void {
  const latestProjectContent = existsSync(config.projectPath) ? readText(config.projectPath) : projectContent;
  const active = tree.active_task_id ? tree.tasks[tree.active_task_id] : null;
  const activeBlock = active
    ? [
        `- id: ${active.id}`,
        `- status: ${active.status}`,
        `- source: .app/tasks/tree.json`,
        active.blocker ? `- blocker: ${active.blocker}` : "",
        active.outputs.length ? `- outputs: ${active.outputs.join(", ")}` : "",
      ].filter(Boolean).join("\n")
    : "- none";

  let next = updateSection(latestProjectContent, "Active Task", `${activeBlock}\n`);
  next = updateSection(next, "Task Index", "- .app/tasks/README.md\n- .app/tasks/tree.json\n");
  writeFileSync(config.projectPath, next, "utf-8");
}

function buildWorkerPrompt(task: TaskNode, frame: ProjectFrame): string {
  const compactLocalTask = isFastLocalUiTask(task);
  const taskTreeCurationGuidance = [
    `Treat .app/tasks/tree.json as the project's structured understanding, not an attempt log. Each branch should explain a meaningful AKS learning responsibility, decomposition, executable leaf, or review.`,
    `Do not add runtime-shaped or vague branches for retries, planner runs, or "try again" work. If an existing branch is stale, duplicate, misleading, or at the wrong level, supersede it with a reason and attach replacement work under the correct domain/control parent.`,
  ];
  const blockedReviewMode = isBlockedReviewTask(task)
    ? [
        ``,
        `## Blocked Review Mode`,
        `This task exists because blocked is not a passive stop state. Review the blocker, classify it, and create or describe safe local follow-up work when possible.`,
        `Use these verdicts: confirmed_external, can_unblock_locally, needs_split, wrongly_blocked, needs_human.`,
        ...taskTreeCurationGuidance,
        `You may edit .app/tasks/tree.json directly, but only to add or update concrete child tasks for the blocked branch you are reviewing. Do not rewrite unrelated branches.`,
      ]
    : [];
  const parentReviewMode = isParentReviewTask(task)
    ? [
        ``,
        `## Parent Review Mode`,
        `This task exists because child work changed a parent state. Audit the parent from evidence and recommend accept, block, split, or continue.`,
        `Do not edit .app/tasks/tree.json directly. The engine owns task-tree mutation and parent rollup.`,
      ]
    : [];
  const reworkReviewMode = isReworkReviewTask(task)
    ? [
        ``,
        `## Rework Review Mode`,
        `This task exists because a leaf was rejected by verification. Audit the rejection and recover the branch instead of stopping the project.`,
        ...taskTreeCurationGuidance,
        `You may edit .app/tasks/tree.json directly, but only to add or update concrete child tasks for the rejected branch you are reviewing. Do not rewrite unrelated branches.`,
        `Do not answer with "no work" or "waiting" as a terminal result. If you cannot continue locally, create a concrete follow-up task, identify the blocker task to address, or record one concrete human/input question.`,
      ]
    : [];
  const frontierReplanMode = isFrontierReplanTask(task) || isPlanningLoopTask(task)
    ? [
        ``,
        `## Planning Loop Mode`,
        `This is a standing loop task mapped to workflow ${task.workflow ?? "project-planner"}. Treat this execution as one planner run, not as a new project task.`,
        `The project goal is not achieved just because current leaves are blocked. Inspect the domain workspace for safe local work that still advances the project goal.`,
        `Look especially at unknown, failing, blocked, stale, or weakly evidenced feature paths in the model, reports, specs, run plans, probes, and evidence.`,
        `Speed matters: create a batch of 5-10 proposed ordinary leaf tasks when safe local work exists. Parent generated tasks under meaningful domain containers such as feature-learning-loop, knowledge-model-maintenance, cross-feature-synthesis, or execution-engine-audit. Prefer independent tasks with explicit conflict_scope so the planner can promote them and the worker pickup loop can dispatch them in parallel.`,
        ...taskTreeCurationGuidance,
        `You may edit .app/tasks/tree.json directly, but only to add or update concrete proposed child tasks for this project frontier. Do not create new root project-frontier-replan-* tasks. Preserve old planning history; the engine records this execution in .app/planner-runs.jsonl.`,
        `Do not answer with "no work" or "waiting" as a terminal result. If the frontier appears exhausted, create a concrete diagnostic/review task, identify a blocker task to address, or record one concrete human/input question and say CLAIM: blocked.`,
      ]
    : [];
  const domainPlannerMode = isDomainPlannerTask(task)
    ? [
        ``,
        `## Domain Planner Mode`,
        `This project learns AKS input space and expectation space systematically. Do not organize work around recent incidents alone.`,
        `Use the repeated feature-learning loop: reference packet, input-space enumeration, expectation-space enumeration, evidence/test mapping, gap analysis, test-spec/probe design, execution gate or evidence, model update, and feature closeout.`,
        `Speed matters: create a batch of 3-7 proposed ordinary leaf tasks when safe local feature-learning work exists. Prefer independent tasks with explicit conflict_scope so the planner can promote them and the worker pickup loop can dispatch them in parallel.`,
        ...taskTreeCurationGuidance,
        `You may edit .app/tasks/tree.json directly, but only to add or update concrete proposed child tasks inside the AKS feature-learning system. Preserve gates, forbidden actions, prior evidence, and unrelated history; the planner will promote clear proposed leaves to ready.`,
        `If no safe local feature-learning work remains, write exact unblock triggers and say CLAIM: blocked.`,
      ]
    : [];
  const compactLocalGuidance = compactLocalTask
    ? [
        ``,
        `## Fast Local Task Guidance`,
        `Keep this execution bounded. Do not read the full .app/tasks/tree.json, full quality-panel.js, or broad project history unless a targeted lookup proves insufficient.`,
        `For .app/tasks/tree.json, inspect only the current task, its parent, and direct children using a small JSON query or targeted search for the task id.`,
        `For source files, search for the relevant function, route, selector, or test name first, then read only the needed section.`,
        `Prefer one small edit plus one focused verification command over broad exploration.`,
      ]
    : [];
  return [
    `You are executing one leaf task for aks-rp-e2e.`,
    ``,
    `## Project Goal`,
    frame.goal,
    ``,
    `## Task`,
    `id: ${task.id}`,
    `goal: ${task.goal}`,
    ...blockedReviewMode,
    ...parentReviewMode,
    ...reworkReviewMode,
    ...frontierReplanMode,
    ...domainPlannerMode,
    ...compactLocalGuidance,
    ``,
    `## Inputs`,
    ...task.inputs.map(item => `- ${item}`),
    ``,
    `## Required Outputs`,
    ...task.outputs.map(item => `- ${item}`),
    ``,
    `## Acceptance`,
    ...task.acceptance.map(item => `- ${item}`),
    ``,
    `## Forbidden`,
    ...task.forbidden.map(item => `- ${item}`),
    ``,
    compactLocalTask
      ? `## Project Background\nLocal UI task. Use the task fields above, target files, and cited inputs as the execution source of truth. Avoid broad project exploration; make the smallest change that satisfies acceptance.`
      : [
          `## Project Background`,
          `This section is background only. The task above and .app/tasks/tree.json are the execution source of truth.`,
          frame.currentState || "(none)",
          ``,
          `## Project Next Action`,
          frame.nextAction || "(none)",
        ].join("\n"),
    ``,
    `When finished, answer with CLAIM: done, CLAIM: blocked, or CLAIM: partial, then list outputs and checks.`,
  ].join("\n");
}

function extractClaim(text: string): TaskAttempt["claim"] {
  if (/CLAIM:\s*done/i.test(text)) return "done";
  if (/CLAIM:\s*partial/i.test(text)) return "partial";
  return "blocked";
}

function finishStatus(result: unknown): string {
  const finish = (result as { finishResult?: { status?: unknown } } | null)?.finishResult;
  return typeof finish?.status === "string" ? finish.status : "";
}

function claimFromResult(result: unknown, evidenceText: string): TaskAttempt["claim"] {
  const status = finishStatus(result);
  if (status === "success") return "done";
  if (status === "partial") return "partial";
  if (status === "blocked" || status === "failure") return "blocked";
  return extractClaim(evidenceText);
}

function requiredCheckFailed(task: TaskNode, evidenceText: string): boolean {
  const acceptanceText = task.acceptance.join("\n");
  const requiresValidation = /(?:validate|validation|validator|exits?\s+0|passes?)/i.test(acceptanceText);
  if (!requiresValidation) return false;
  return /❌[^\n]*(?:validate|validation|validator|model\/tools|bun)|(?:exit\s*code|exited|exits?)\s*[:=]?\s*[1-9]\d*|validation[^.\n]*(?:failed|fails|error|exits?\s+[1-9])/i.test(evidenceText);
}

function unsupportedNoWorkClaim(task: TaskNode, evidenceText: string): boolean {
  if (!(isFrontierReplanTask(task) || isPlanningLoopTask(task) || isDomainPlannerTask(task) || isReworkReviewTask(task) || isBlockedReviewTask(task) || isParentReviewTask(task))) return false;
  return /(?:no actionable (?:local )?work|no safe (?:local )?work|no (?:ready|local|further) work remains|no new unblock signals|project transitions? to waiting|transition(?:s|ed)? to waiting|all .*execution-gated|all .*externally gated)/i.test(evidenceText);
}

function parseTreeSnapshot(raw: string): TaskTree | null {
  try {
    const tree = JSON.parse(raw) as TaskTree;
    normalizeTaskTree(tree);
    return tree;
  } catch {
    return null;
  }
}

function isOrdinaryWorkLeaf(task: TaskNode): boolean {
  return isLeaf(task)
    && !isSerializedExecutionTask(task)
    && !["accepted", "blocked", "superseded"].includes(task.status);
}

function newlyCreatedOrdinaryWorkLeaves(tree: TaskTree, previousTree: TaskTree | null): TaskNode[] {
  if (!previousTree) return [];
  return Object.values(tree.tasks)
    .filter(taskNode => !previousTree.tasks[taskNode.id])
    .filter(isOrdinaryWorkLeaf);
}

function hasSmallerBatchJustification(attempt: TaskAttempt): boolean {
  return /(?:fewer than|less than|smaller batch|only \d+ safe|only one safe|only two safe|only three safe|not enough safe|every concrete safe|all concrete safe|explain(?:s|ed)? why .* smaller|batch is smaller)/i.test(attempt.summary);
}

function plannerBatchFailureReason(tree: TaskTree, previousTree: TaskTree | null, task: TaskNode, attempt: TaskAttempt): string | null {
  if (attempt.claim !== "done") return null;
  const required = isFrontierReplanTask(task) || isPlanningLoopTask(task) ? 5 : isDomainPlannerTask(task) ? 3 : 0;
  if (required === 0) return null;
  const created = newlyCreatedOrdinaryWorkLeaves(tree, previousTree);
  if (created.length >= required) return null;
  if (created.length > 0 && hasSmallerBatchJustification(attempt)) return null;
  const label = isFrontierReplanTask(task) || isPlanningLoopTask(task) ? "frontier replan" : "domain planner";
  return `${label} done claim created ${created.length} new ordinary executable leaf task(s); expected at least ${required} unless the attempt explicitly explains a smaller safe batch.`;
}

function appendPlannerRunRecord(config: EngineConfig, tree: TaskTree, previousTree: TaskTree | null, task: TaskNode, attempt: TaskAttempt, verification: Verification): void {
  if (!(isPlanningLoopTask(task) || isFrontierReplanTask(task) || isDomainPlannerTask(task))) return;
  const runId = `${task.id}-${attempt.id}`;
  const created = newlyCreatedOrdinaryWorkLeaves(tree, previousTree).map(item => item.id);
  const updated = Object.values(tree.tasks)
    .filter(item => previousTree?.tasks[item.id] && JSON.stringify(previousTree.tasks[item.id]) !== JSON.stringify(item))
    .map(item => item.id)
    .filter(id => id !== task.id)
    .sort();
  task.latest_run_id = runId;
  appendFileSync(config.plannerRunsPath, `${JSON.stringify({
    id: runId,
    ts: attempt.ts,
    loop_task_id: isPlanningLoopTask(task) ? task.id : undefined,
    task_id: task.id,
    workflow: task.workflow ?? (isPlanningLoopTask(task) ? "project-planner" : undefined),
    kind: task.kind,
    claim: attempt.claim,
    verdict: verification.verdict,
    reason: verification.reason,
    artifact: attempt.outputs[0] ?? task.outputs[0] ?? null,
    outputs: attempt.outputs,
    created_task_ids: created,
    updated_task_ids: updated,
  })}\n`, "utf-8");
}

function rejectedReviewTaskIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter(item => item.status === "rejected")
    .filter(item => isFrontierReplanTask(item) || isPlanningLoopTask(item) || isReworkReviewTask(item) || isBlockedReviewTask(item) || isParentReviewTask(item))
    .sort((a, b) => depthOf(tree, a.id) - depthOf(tree, b.id) || a.id.localeCompare(b.id))
    .map(item => ensureReworkReviewTask(tree, item, item.blocker ?? "Review claim was rejected and needs recovery."));
}

function buildVerification(tree: TaskTree, previousTree: TaskTree | null, task: TaskNode, attempt: TaskAttempt, verifier: string): Verification {
  const workerErrored = attempt.open_risks.some(risk => /worker session errored/i.test(risk)) || /\*\*Status:\*\*\s*error/i.test(attempt.summary);
  const workerInterrupted = attempt.open_risks.some(risk => /worker session (?:interrupted|cancelled)/i.test(risk)) || /\*\*Status:\*\*\s*(?:interrupted|cancelled|canceled)/i.test(attempt.summary);
  const failedRequiredCheck = attempt.claim === "done" && requiredCheckFailed(task, attempt.summary);
  const noWorkClaim = unsupportedNoWorkClaim(task, attempt.summary);
  const plannerBatchFailure = plannerBatchFailureReason(tree, previousTree, task, attempt);
  const nonExternalBlockedClaim = attempt.claim === "blocked" && !blockedClaimIsExternal(task, attempt);
  const blockedAccepted = attempt.claim === "blocked" && attempt.outputs.length > 0 && !nonExternalBlockedClaim;
  const doneAccepted = attempt.claim === "done" && task.acceptance.length > 0 && task.outputs.every(output => attempt.outputs.includes(output));
  const verdict: Verification["verdict"] = !workerErrored && !workerInterrupted && !failedRequiredCheck && !noWorkClaim && !plannerBatchFailure && !nonExternalBlockedClaim && (doneAccepted || blockedAccepted) ? "accepted" : "rejected";
  return {
    ts: nowIso(),
    verifier,
    verdict,
    reason: verdict === "accepted"
      ? `Claim ${attempt.claim} has enough evidence for this v1 verifier.`
      : workerErrored
      ? "Worker session errored; create a retry/rework task instead of accepting a blocked claim."
      : workerInterrupted
      ? "Worker session was interrupted or cancelled; create a retry/rework task instead of accepting an incomplete claim."
      : failedRequiredCheck
      ? "Claim includes a failed required validation/check; create a follow-up task or rerun after fixing the failure."
      : noWorkClaim
      ? "No-work/waiting claims are not terminal. Create concrete follow-up work, ask a concrete human/input question, or identify a blocker task to address."
      : plannerBatchFailure
      ? plannerBatchFailure
      : nonExternalBlockedClaim
      ? "Blocked claims must name a concrete external/input/safety wait. Rework, validation failure, unclear scope, stale evidence, or parent bookkeeping should become rejected, decomposed, ready follow-up work, or a human question."
      : "Claim did not cite all required outputs; create a follow-up task or rerun.",
    criteria: task.acceptance.map(item => ({
      item,
      result: verdict === "accepted" ? "pass" : "not_proven",
    })),
  };
}

function blockedFrontierSummary(tree: TaskTree): string {
  const blocked = Object.values(tree.tasks).filter(item => item.status === "blocked" && isLeaf(item) && hasExternalBlockSignal(item));
  const human = blocked.filter(isHumanQuestionTask);
  const ordinary = blocked.filter(item => !isHumanQuestionTask(item));
  const sample = blocked
    .slice(0, 3)
    .map(item => `${item.id}: ${item.blocker ?? item.goal}`)
    .join("; ");
  return [
    ordinary.length ? `${ordinary.length} blocked task(s)` : "",
    human.length ? `${human.length} human/input question(s)` : "",
    sample ? `frontier: ${sample}` : "",
  ].filter(Boolean).join("; ") || "no blocked frontier details";
}

function rollUpParent(tree: TaskTree, task: TaskNode): void {
  if (!task.parent_id) return;
  const parent = tree.tasks[task.parent_id];
  if (!parent) return;
  const children = parent.children.map(id => tree.tasks[id]).filter(Boolean);
  const workChildren = children.filter(child => !isReviewTask(child));
  const settled = (child: TaskNode) => isSettled(child);
  const accepted = children.filter(child => child.status === "accepted").length;
  const blocked = children.filter(child => child.status === "blocked").length;
  parent.progress = { accepted, blocked, total: children.length };

  if (children.length > 0 && workChildren.length === 0) {
    if (children.every(isSettled)) {
      if (acceptedVerificationCompletesTask(parent)) {
        parent.status = "accepted";
        if (parent.blocker?.startsWith("Blocked task reviewed by")) parent.blocker = undefined;
      } else if (hasExternalBlockSignal(parent)) {
        parent.status = "blocked";
      } else {
        parent.status = "decomposed";
        clearSyntheticBlocker(parent);
      }
    } else {
      parent.status = "decomposed";
    }
    rollUpParent(tree, parent);
    return;
  }

  const workAccepted = workChildren.filter(child => child.status === "accepted").length;
  const workBlocked = workChildren.filter(child => child.status === "blocked").length;
  const allWorkSettled = workChildren.length > 0 && workChildren.every(settled);
  const allWorkAccepted = workChildren.length > 0 && workAccepted === workChildren.length;
  const parentReviewed = acceptedParentReview(tree, parent);

  if (allWorkAccepted) {
    if (parentReviewed) {
      parent.status = "claimed_done";
    } else if (!pendingParentReview(tree, parent)) {
      ensureParentReviewTask(tree, parent, "all child work is accepted; verify parent acceptance before closing it");
      parent.status = "decomposed";
    }
  } else if (workBlocked > 0 && allWorkSettled) {
    if (!parentReviewed && !pendingParentReview(tree, parent)) {
      ensureParentReviewTask(tree, parent, "one or more required child tasks are blocked; audit whether to replan, split, or confirm external blocker");
    }
    parent.status = "decomposed";
    clearSyntheticBlocker(parent);
  } else {
    parent.status = "decomposed";
    clearSyntheticBlocker(parent);
  }
  rollUpParent(tree, parent);
}

function verifyClaimedParents(tree: TaskTree, verifier: string): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of Object.values(tree.tasks)) {
      if (task.status !== "claimed_done" || task.children.length === 0) continue;
      const children = task.children.map(id => tree.tasks[id]).filter(Boolean);
      if (children.length === 0 || !children.every(child => child.status === "accepted")) continue;
      if (task.children.some(id => {
        const child = tree.tasks[id];
        return child && isReviewTask(child) && child.status !== "accepted";
      })) continue;
      task.status = "accepted";
      task.verification = {
        ts: nowIso(),
        verifier,
        verdict: "accepted",
        reason: "All required child tasks are accepted.",
        criteria: task.acceptance.map(item => ({ item, result: "pass" })),
      };
      changed = true;
      rollUpParent(tree, task);
    }
  }
}

async function runOneTaskAttempt(
  ctx: WorkflowContext,
  config: EngineConfig,
  projectContent: string,
  frame: ProjectFrame,
  tree: TaskTree,
  taskNode: TaskNode,
  attemptOrdinal: number,
): Promise<{ attempted: boolean; taskId: string }> {
  tree.active_task_id = taskNode.id;
  const clarity = isClearEnough(taskNode);
  if (!clarity.ok) {
    const reason = `Task is not executable: ${clarity.reason}`;
    taskNode.status = "rejected";
    taskNode.blocker = reason;
    taskNode.claimed_by = undefined;
    taskNode.lease_expires_at = undefined;
    ensureReworkReviewTask(tree, taskNode, reason);
    emitTaskEvent(ctx, "task.rejected", taskNode, { reason });
    rollUpParent(tree, taskNode);
    tree = saveTaskBranchIntoLatest(config, tree, taskNode.id);
    updateProjectActiveTask(config, projectContent, tree);
    return { attempted: false, taskId: taskNode.id };
  }

  if (hasClosedGate(taskNode)) {
    taskNode.status = "blocked";
    taskNode.blocker = taskNode.blocker ?? `Closed gate: ${taskNode.gates.join("; ")}`;
    taskNode.claimed_by = undefined;
    taskNode.lease_expires_at = undefined;
    emitTaskEvent(ctx, "task.blocked", taskNode, { reason: taskNode.blocker ?? "gate closed" });
    rollUpParent(tree, taskNode);
    tree = saveTaskBranchIntoLatest(config, tree, taskNode.id);
    updateProjectActiveTask(config, projectContent, tree);
    return { attempted: false, taskId: taskNode.id };
  }

  const taskId = taskNode.id;
  leaseTask(taskNode, config.worker);
  emitTaskEvent(ctx, "task.started", taskNode, {
    mode: "worker",
    claimed_by: taskNode.claimed_by,
    lease_expires_at: taskNode.lease_expires_at,
  });
  tree = saveTaskBranchIntoLatest(config, tree, taskId);
  taskNode = tree.tasks[taskId] ?? taskNode;
  updateProjectActiveTask(config, projectContent, tree);

  const beforeWorkerTree = readText(config.treePath);
  const previousTree = parseTreeSnapshot(beforeWorkerTree);
  const result = await ctx.runAgent(config.worker, buildWorkerPrompt(taskNode, frame));
  const afterWorkerTree = readText(config.treePath);
  if (afterWorkerTree !== beforeWorkerTree) {
    try {
      tree = JSON.parse(afterWorkerTree) as TaskTree;
      normalizeTaskTree(tree);
      taskNode = tree.tasks[taskId] ?? taskNode;
    } catch {
      appendJournal(config.journalPath, {
        kind: "task_tree_reload_failed",
        status: "blocked",
        summary: "Worker changed .app/tasks/tree.json, but the engine could not parse it. Continuing from the pre-worker tree.",
        task_id: taskId,
      });
    }
  }

  const text = result.lastAssistantText ?? "";
  const summary = ctx.summarize(result, { maxLength: 1000 });
  const evidenceText = [
    text,
    summary,
    JSON.stringify((result as { finishResult?: unknown }).finishResult ?? {}),
  ].join("\n");
  const attempt: TaskAttempt = {
    id: `attempt-${Date.now()}-${attemptOrdinal}`,
    ts: nowIso(),
    agent: config.worker,
    claim: ["error", "interrupted", "cancelled", "canceled"].includes(result.status) ? "blocked" : claimFromResult(result, evidenceText),
    summary,
    outputs: taskNode.outputs.filter(output => evidenceText.includes(output) || existsSync(join(config.projectDir, output))),
    checks: [],
    open_risks: result.status === "error"
      ? ["Worker session errored."]
      : ["interrupted", "cancelled", "canceled"].includes(result.status)
      ? ["Worker session interrupted or cancelled."]
      : [],
  };
  taskNode.attempts = [...(taskNode.attempts ?? []), attempt];
  taskNode.status = "claimed_done";
  taskNode.claimed_by = undefined;
  taskNode.lease_expires_at = undefined;
  emitTaskEvent(ctx, "task.claimed", taskNode, { claim: attempt.claim });

  const verification = buildVerification(tree, previousTree, taskNode, attempt, config.owner);
  taskNode.verification = verification;
  appendPlannerRunRecord(config, tree, previousTree, taskNode, attempt, verification);
  if (verification.verdict === "accepted") {
    taskNode.status = attempt.claim === "blocked" ? "blocked" : "accepted";
    if (attempt.claim === "blocked") taskNode.blocker = attempt.summary;
    emitTaskEvent(ctx, "task.verified", taskNode, { verdict: verification.verdict });
    rollUpParent(tree, taskNode);
    verifyClaimedParents(tree, config.owner);
  } else {
    taskNode.status = "rejected";
    taskNode.blocker = verification.reason;
    const reworkTaskId = ensureReworkReviewTask(tree, taskNode, verification.reason);
    emitTaskEvent(ctx, "task.rejected", taskNode, { reason: verification.reason });
    appendJournal(config.journalPath, {
      kind: "task_rework_review_created",
      status: "ready",
      summary: "Task verification was rejected; created review/rework task and continued project execution.",
      task_id: taskNode.id,
      rework_task_id: reworkTaskId,
      reason: verification.reason,
    });
  }

  tree = saveTaskBranchIntoLatest(config, tree, taskId);
  updateProjectActiveTask(config, projectContent, tree);
  return { attempted: true, taskId };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const trigger = parseTriggerEvent(ctx.task);
  const content = readText(config.projectPath);
  const frame = projectFrame(content);
  let { tree, created, normalizedChanged } = loadOrCreateTree(config, frame);
  tree.project_lifecycle = frame.status;
  if (normalizedChanged) {
    appendJournal(config.journalPath, {
      kind: "task_tree_normalized",
      status: tree.tasks[tree.root_task_id]?.status,
      summary: "Persisted task tree normalization before planner/worker selection.",
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }
  const requeuedStaleActiveTasks = requeueStaleActiveLeaves(ctx, tree);
  if (requeuedStaleActiveTasks.length > 0) {
    appendJournal(config.journalPath, {
      kind: "stale_active_tasks_requeued",
      status: "ready",
      summary: "Requeued active leaf tasks whose execution lease was missing or expired before scheduling.",
      task_ids: requeuedStaleActiveTasks,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  const recoveredPlanningLoopRunId = recoverStalledPlanningLoopRework(tree);
  if (recoveredPlanningLoopRunId) {
    appendJournal(config.journalPath, {
      kind: "planning_loop_rework_superseded",
      status: "ready",
      summary: "Superseded a repeatedly interrupted planning-loop recovery review and created a fresh executable planning loop run.",
      task_id: recoveredPlanningLoopRunId,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  } else {
    const loop = tree.tasks[PROJECT_PLANNING_LOOP_ID];
    if (loop && loop.status === "blocked" && loop.blocker?.startsWith("Planning loop exhausted")) {
      appendJournal(config.journalPath, {
        kind: "planning_loop_budget_exhausted",
        status: "blocked",
        summary: loop.blocker,
      });
      saveTree(config, tree);
      updateProjectActiveTask(config, content, tree);
    }
  }

  const suppressedPlanningLoopBranches = suppressStalePlanningLoopBranches(tree);
  if (suppressedPlanningLoopBranches.length > 0) {
    appendJournal(config.journalPath, {
      kind: "stale_planning_loop_branches_superseded",
      status: "superseded",
      summary: "Superseded stale planning-loop recovery branches while a fresher executable planning loop run is live.",
      task_ids: suppressedPlanningLoopBranches,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  if (created) {
    appendJournal(config.journalPath, {
      kind: "task_tree_created",
      status: tree.tasks[tree.root_task_id]?.status,
      summary: "Initialized .app/tasks/tree.json from .app/project.md current state.",
    });
  }

  if (frame.status === "closed") {
    appendJournal(config.journalPath, {
      kind: "closed_project_reviewed",
      status: "blocked",
      summary: "Project frame is closed, but blocked tasks are reviewable. Continuing only through blocked-review/unblock tasks.",
    });
  }

  if (trigger && !["project.execution.requested", "project.task.execution.requested"].includes(String(trigger.type))) {
    appendJournal(config.journalPath, {
      kind: "legacy_trigger_ignored",
      status: "blocked",
      summary: "Ignored a non-v2 project execution trigger so stale timer jobs cannot bypass planner/worker pickup.",
      trigger_type: trigger.type ?? "unknown",
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
    return ctx.done(`Ignored non-v2 project execution trigger ${String(trigger.type ?? "unknown")}; use project.execution.requested or project.task.execution.requested.`);
  }

  if (trigger?.type === "project.task.execution.requested") {
    const taskId = triggerValue(trigger, "taskId") || triggerValue(trigger, "task_id") || field(ctx.task, "taskId") || "";
    const target = taskId ? tree.tasks[taskId] : null;
    if (!target) {
      return ctx.done(`Task execution event ignored because task ${taskId || "(missing)"} was not found.`);
    }
    if (!isLeaf(target) || !["ready", "active"].includes(target.status)) {
      return ctx.done(`Task execution event ignored because ${target.id} is ${target.status}, not a runnable leaf.`);
    }
    const result = await runOneTaskAttempt(ctx, config, content, frame, tree, target, 1);
    tree = loadTree(config);
    const completed = tree.tasks[result.taskId];
    const completedStatus = completed?.status ?? "unknown";
    const verificationVerdict = completed?.verification?.verdict ?? null;
    try {
      ctx.dispatchEvent("project.task.completed", {
        project: "aks-rp-e2e",
        taskId: result.taskId,
        status: completedStatus,
        verification_verdict: verificationVerdict,
        open_task_count: openTaskCount(tree),
        requested_by: "project-execution-engine",
      });
      ctx.dispatchEvent("project.execution.requested", {
        project: "aks-rp-e2e",
        reason: "task-completed",
        completedTaskId: result.taskId,
        status: completedStatus,
        verificationVerdict,
        maxConcurrent: config.maxConcurrent,
        requested_by: "project-execution-engine",
      });
    } catch {
      // Local test contexts may not provide a real dispatcher.
    }
    return ctx.done(`Task worker processed ${result.taskId}.`);
  }

  const initialPromotedTasks = promoteClearBacklogLeaves(ctx, tree);
  if (initialPromotedTasks.length > 0) {
    appendJournal(config.journalPath, {
      kind: "backlog_tasks_promoted",
      status: "ready",
      summary: "Promoted clear proposed leaf tasks from backlog to ready before selecting the next frontier.",
      task_ids: initialPromotedTasks,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  const initialRejectedReviewTasks = rejectedReviewTaskIds(tree);
  if (initialRejectedReviewTasks.length > 0) {
    appendJournal(config.journalPath, {
      kind: "rejected_review_tasks_created",
      status: "ready",
      summary: "Created rework-review tasks for rejected review/no-work claims.",
      task_ids: initialRejectedReviewTasks,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  const initialFeatureAdvanceTask = ensureAksFeatureQueueAdvanceTask(tree, config);
  if (initialFeatureAdvanceTask) {
    appendJournal(config.journalPath, {
      kind: "feature_queue_advance_task_created",
      status: "ready",
      summary: "Created a domain-planner task for the next safe local AKS feature-learning queue item.",
      task_id: initialFeatureAdvanceTask,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  const initialSettledParentReviews = ensureSettledDecomposedParentReviews(tree);
  if (initialSettledParentReviews.length > 0) {
    appendJournal(config.journalPath, {
      kind: "settled_decomposed_parent_reviews_created",
      status: "ready",
      summary: "Created parent rollup-review tasks for decomposed branches whose child work is already settled.",
      task_ids: initialSettledParentReviews,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  const initialReviewTasks = ensureBlockedReviewTasks(tree);
  if (initialReviewTasks.length > 0) {
    appendJournal(config.journalPath, {
      kind: "blocked_review_tasks_created",
      status: "ready",
      summary: "Created blocked-review tasks because the task tree had blockers and no ready executable leaf.",
      task_ids: initialReviewTasks,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  const initialReplanTask = ensureFrontierReplanTask(tree);
  if (initialReplanTask) {
    appendJournal(config.journalPath, {
      kind: "frontier_replan_task_created",
      status: "ready",
      summary: "Created a frontier replan task because the project had no executable leaf after initial recovery checks.",
      task_id: initialReplanTask,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  if (trigger?.type === "project.execution.requested") {
    const promoted = promoteClearBacklogLeaves(ctx, tree);
    if (promoted.length > 0) {
      appendJournal(config.journalPath, {
        kind: "backlog_tasks_promoted",
        status: "ready",
        summary: "Promoted clear proposed leaf tasks from backlog to ready before dispatching event-native workers.",
        task_ids: promoted,
      });
    }
    const blockedReady = blockUnexecutableReadyLeaves(ctx, tree);
    if (blockedReady.length > 0) {
      appendJournal(config.journalPath, {
        kind: "ready_tasks_blocked_before_dispatch",
        status: "blocked",
        summary: "Converted unexecutable ready leaves into blocked state before dispatching event-native workers.",
        task_ids: blockedReady,
      });
    }
    const dispatched = dispatchTaskExecutionEvents(ctx, config, tree);
    if (dispatched.length > 0) {
      appendJournal(config.journalPath, {
        kind: "task_execution_events_dispatched",
        status: "active",
        summary: "Leased ready leaf tasks and dispatched event-native task execution requests.",
        task_ids: dispatched,
        max_concurrent: config.maxConcurrent,
      });
      saveTree(config, tree);
      updateProjectActiveTask(config, content, tree);
      return ctx.done(`Dispatched ${dispatched.length} task execution event(s): ${dispatched.join(", ")}.`);
    }
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
    const active = activeLeaves(tree);
    return ctx.done(active.length > 0
      ? `No new task events dispatched; ${active.length} task(s) already active: ${active.map(item => item.id).join(", ")}.`
      : openTaskCount(tree) === 0
      ? "All task-tree work is settled."
      : `Project is stopped on a concrete blocked/input frontier after worker pickup checks: ${blockedFrontierSummary(tree)}.`);
  }

  if (config.maxAttempts <= 0) {
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
    return ctx.done(initialPromotedTasks.length > 0
      ? `Promoted backlog task(s): ${initialPromotedTasks.join(", ")}.`
      : initialFeatureAdvanceTask
      ? `Created feature queue advance task: ${initialFeatureAdvanceTask}.`
      : initialRejectedReviewTasks.length > 0
      ? `Created rejected-review recovery task(s): ${initialRejectedReviewTasks.join(", ")}.`
      : initialReviewTasks.length > 0
      ? `Created blocked review task(s): ${initialReviewTasks.join(", ")}.`
      : initialReplanTask
      ? `Created frontier replan task: ${initialReplanTask}.`
      : "Wake budget is zero; no task attempts executed.");
  }

  let attempts = 0;
  while (attempts < config.maxAttempts) {
    tree = loadTree(config);
    tree.project_lifecycle = frame.status;
    let next = findNextReadyLeaf(tree);
    if (!next) {
      const promoted = promoteClearBacklogLeaves(ctx, tree);
      if (promoted.length > 0) {
        appendJournal(config.journalPath, {
          kind: "backlog_tasks_promoted",
          status: "ready",
          summary: "Promoted clear proposed leaf tasks from backlog to ready during project execution.",
          task_ids: promoted,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      const rejectedReviewTasks = rejectedReviewTaskIds(tree);
      if (rejectedReviewTasks.length > 0) {
        appendJournal(config.journalPath, {
          kind: "rejected_review_tasks_created",
          status: "ready",
          summary: "Created rework-review tasks for rejected review/no-work claims.",
          task_ids: rejectedReviewTasks,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      const featureAdvanceTaskId = ensureAksFeatureQueueAdvanceTask(tree, config);
      if (featureAdvanceTaskId) {
        appendJournal(config.journalPath, {
          kind: "feature_queue_advance_task_created",
          status: "ready",
          summary: "Ready frontier was empty, but the AKS feature-learning queue still had safe local work.",
          task_id: featureAdvanceTaskId,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      const settledParentReviews = ensureSettledDecomposedParentReviews(tree);
      if (settledParentReviews.length > 0) {
        appendJournal(config.journalPath, {
          kind: "settled_decomposed_parent_reviews_created",
          status: "ready",
          summary: "Created parent rollup-review tasks for decomposed branches whose child work is already settled.",
          task_ids: settledParentReviews,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      const reviewTasks = ensureBlockedReviewTasks(tree);
      if (reviewTasks.length > 0) {
        appendJournal(config.journalPath, {
          kind: "blocked_review_tasks_created",
          status: "ready",
          summary: "Created blocked-review tasks because the task tree had blockers and no ready executable leaf.",
          task_ids: reviewTasks,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      const replanTaskId = ensureFrontierReplanTask(tree);
      if (replanTaskId) {
        appendJournal(config.journalPath, {
          kind: "frontier_replan_task_created",
          status: "ready",
          summary: "Active project had no ready leaves but still had blocked work; created a frontier replan task to search for safe local/domain work.",
          task_id: replanTaskId,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      tree = loadTree(config);
      tree.project_lifecycle = frame.status;
      next = findNextReadyLeaf(tree);
      if (next) {
        tree.active_task_id = next.id;
        appendJournal(config.journalPath, {
          kind: "ready_work_detected_after_reload",
          status: "ready",
          summary: "Reloaded .app/tasks/tree.json before stopping and found runnable work created by another actor.",
          active_task_id: next.id,
        });
        saveTree(config, tree);
        updateProjectActiveTask(config, content, tree);
        continue;
      }
      tree.active_task_id = null;
      saveTree(config, tree);
      updateProjectActiveTask(config, content, tree);
      return ctx.done(openTaskCount(tree) === 0
        ? "All task-tree work is settled."
        : `Project is stopped on a concrete blocked/input frontier after recovery checks: ${blockedFrontierSummary(tree)}.`);
    }

    tree.active_task_id = next.id;
    const clarity = isClearEnough(next);
    if (!clarity.ok) {
      const reason = `Task is not executable: ${clarity.reason}`;
      next.status = "rejected";
      next.blocker = reason;
      ensureReworkReviewTask(tree, next, reason);
      emitTaskEvent(ctx, "task.rejected", next, { reason });
      rollUpParent(tree, next);
      saveTree(config, tree);
      updateProjectActiveTask(config, content, tree);
      continue;
    }

    if (hasClosedGate(next)) {
      next.status = "blocked";
      next.blocker = next.blocker ?? `Closed gate: ${next.gates.join("; ")}`;
      emitTaskEvent(ctx, "task.blocked", next, { reason: next.blocker ?? "gate closed" });
      rollUpParent(tree, next);
      saveTree(config, tree);
      updateProjectActiveTask(config, content, tree);
      continue;
    }

    attempts++;
    const taskId = next.id;
    leaseTask(next, config.worker);
    emitTaskEvent(ctx, "task.started", next, {
      mode: "direct",
      claimed_by: next.claimed_by,
      lease_expires_at: next.lease_expires_at,
    });
    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
    const beforeWorkerTree = readText(config.treePath);
    const previousTree = parseTreeSnapshot(beforeWorkerTree);
    const result = await ctx.runAgent(config.worker, buildWorkerPrompt(next, frame));
    const afterWorkerTree = readText(config.treePath);
    if (afterWorkerTree !== beforeWorkerTree) {
      try {
        tree = JSON.parse(afterWorkerTree) as TaskTree;
        normalizeTaskTree(tree);
        next = tree.tasks[taskId] ?? next;
      } catch {
        appendJournal(config.journalPath, {
          kind: "task_tree_reload_failed",
          status: "blocked",
          summary: "Worker changed .app/tasks/tree.json, but the engine could not parse it. Continuing from the pre-worker tree.",
          task_id: taskId,
        });
      }
    }
    const text = result.lastAssistantText ?? "";
    const summary = ctx.summarize(result, { maxLength: 1000 });
    const evidenceText = [
      text,
      summary,
      JSON.stringify((result as { finishResult?: unknown }).finishResult ?? {}),
    ].join("\n");
    const attempt: TaskAttempt = {
      id: `attempt-${Date.now()}-${attempts}`,
      ts: nowIso(),
      agent: config.worker,
      claim: result.status === "error" ? "blocked" : claimFromResult(result, evidenceText),
      summary,
      outputs: next.outputs.filter(output => evidenceText.includes(output) || existsSync(join(config.projectDir, output))),
      checks: [],
      open_risks: result.status === "error" ? ["Worker session errored."] : [],
    };
    next.attempts = [...(next.attempts ?? []), attempt];
    next.status = "claimed_done";
    emitTaskEvent(ctx, "task.claimed", next, { claim: attempt.claim });

    const verification = buildVerification(tree, previousTree, next, attempt, config.owner);
    next.verification = verification;
    appendPlannerRunRecord(config, tree, previousTree, next, attempt, verification);
    if (verification.verdict === "accepted") {
      next.status = attempt.claim === "blocked" ? "blocked" : "accepted";
      if (attempt.claim === "blocked") next.blocker = attempt.summary;
      emitTaskEvent(ctx, "task.verified", next, { verdict: verification.verdict });
      rollUpParent(tree, next);
      verifyClaimedParents(tree, config.owner);
    } else {
      next.status = "rejected";
      next.blocker = verification.reason;
      const reworkTaskId = ensureReworkReviewTask(tree, next, verification.reason);
      emitTaskEvent(ctx, "task.rejected", next, { reason: verification.reason });
      appendJournal(config.journalPath, {
        kind: "task_rework_review_created",
        status: "ready",
        summary: "Task verification was rejected; created review/rework task and continued project execution.",
        task_id: next.id,
        rework_task_id: reworkTaskId,
        reason: verification.reason,
      });
      saveTree(config, tree);
      updateProjectActiveTask(config, content, tree);
      continue;
    }

    saveTree(config, tree);
    updateProjectActiveTask(config, content, tree);
  }

  tree = loadTree(config);
  tree.project_lifecycle = frame.status;
  saveTree(config, tree);
  updateProjectActiveTask(config, content, tree);
  const rejectedReviewTasks = rejectedReviewTaskIds(tree);
  if (rejectedReviewTasks.length > 0) {
    appendJournal(config.journalPath, {
      kind: "rejected_review_tasks_created",
      status: "ready",
      summary: "Created rework-review tasks at wake-budget boundary for rejected review/no-work claims.",
      task_ids: rejectedReviewTasks,
    });
  }
  const featureAdvanceTaskId = ensureAksFeatureQueueAdvanceTask(tree, config);
  if (featureAdvanceTaskId) {
    appendJournal(config.journalPath, {
      kind: "feature_queue_advance_task_created",
      status: "ready",
      summary: "Created a feature queue advance task at wake-budget boundary because safe local feature-learning work remained.",
      task_id: featureAdvanceTaskId,
    });
  }
  const reviewTasks = ensureBlockedReviewTasks(tree);
  if (reviewTasks.length > 0) {
    appendJournal(config.journalPath, {
      kind: "blocked_review_tasks_created",
      status: "ready",
      summary: "Created blocked-review tasks at wake-budget boundary because blockers remained reviewable.",
      task_ids: reviewTasks,
    });
  }
  const replanTaskId = ensureFrontierReplanTask(tree);
  if (replanTaskId) {
    appendJournal(config.journalPath, {
      kind: "frontier_replan_task_created",
      status: "ready",
      summary: "Created frontier replan task at wake-budget boundary because blocked active project work remained.",
      task_id: replanTaskId,
    });
  }
  requestContinuation(ctx, config, tree, "continue-after-wake-budget");
  saveTree(config, tree);
  updateProjectActiveTask(config, content, tree);
  return ctx.done(findNextReadyLeaf(tree)
    ? `Interrupted after ${attempts} task attempt(s); continuation requested because runnable work remains.`
    : `Stopped after ${attempts} task attempt(s) on a concrete blocked/input frontier: ${blockedFrontierSummary(tree)}.`);
}

if (import.meta.main) {
  const result = await execute({
    task: "project: /app/projects/aks-rp-e2e\nagent: aks-explorer\nmaxAttempts: 0",
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as WorkflowContext);
  console.log(JSON.stringify(result));
}
