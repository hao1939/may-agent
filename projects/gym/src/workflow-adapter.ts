/**
 * Host-free Gym workflow & agent overlay adapter.
 *
 * Bridges Gym `workflow_entry` scenarios and `.lab` overlays onto
 * `@may-agent/sdk/standalone` without importing Host-private modules, SQLite,
 * EventBus, or SubagentManager.
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  run,
  type DirectAgentFixtureHandler,
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
  type DirectWorkflowRunOptions,
  type DirectWorkflowRunResult,
  type ToolDenial,
} from "@may-agent/sdk/standalone";
import type { WorkflowScenarioEntry } from "./scenarios/types";

export type GymModelMap = DirectWorkflowRunOptions["models"];

export function resolveGymAgentDir(
  agentsRoot: string,
  agentName: string,
  projectsRoot?: string,
): string | null {
  const direct = join(agentsRoot, agentName);
  if (existsSync(join(direct, "agent.json"))) return direct;
  if (!projectsRoot || !existsSync(projectsRoot)) return null;

  for (const project of readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const candidate = join(projectsRoot, project.name, "agents", agentName);
    if (existsSync(join(candidate, "agent.json"))) return candidate;
  }
  return null;
}

export function resolveGymLabDir(
  agentsRoot: string,
  labFork: string,
  agentName: string,
  projectsRoot?: string,
): string | null {
  const globalLab = join(agentsRoot, ".lab", labFork);
  if (existsSync(globalLab)) return globalLab;

  const agentDir = resolveGymAgentDir(agentsRoot, agentName, projectsRoot);
  if (!agentDir) return null;
  const appLab = join(dirname(agentDir), ".lab", labFork);
  return existsSync(appLab) ? appLab : null;
}

export const GYM_TOOL_DENIAL_REASONS: Readonly<Record<string, string>> = {
  agents: "isolated Gym scenarios do not dispatch supporting agents",
  workflow: "isolated Gym scenarios do not expose the legacy workflow tool",
  cron: "isolated Gym scenarios must not change autonomous schedules",
  checkpoint: "the direct Gym adapter has no hosted durable checkpoint service",
  "cli-delegation":
    "isolated Gym scenarios do not delegate to external agent CLIs",
  "system-status":
    "isolated Gym scenarios do not expose production system state",
  system_status: "isolated Gym scenarios do not expose production system state",
  query_db: "isolated Gym scenarios do not expose the production database",
  "query-db": "isolated Gym scenarios do not expose the production database",
};

/**
 * Apply an optional `.lab/<labFork>` overlay onto a target agent copy directory
 * (`workDir/agents/<agentName>` or `sandboxRoot/<agentName>`), pre-removing any
 * subdirectories (`skills/`, `workflows/`) that the candidate replaces so
 * deleted skills/workflows do not leak through from the base agent.
 */
export function applyGymLabOverlay(options: {
  targetAgentDir: string;
  baseAgentsRoot: string;
  projectsRoot: string;
  agentName: string;
  labFork: string;
}): string {
  const { targetAgentDir, baseAgentsRoot, projectsRoot, agentName, labFork } =
    options;
  const labDir = resolveGymLabDir(
    baseAgentsRoot,
    labFork,
    agentName,
    projectsRoot,
  );
  if (!labDir) {
    throw new Error(
      `Lab fork not found: ${join(baseAgentsRoot, ".lab", labFork)}`,
    );
  }
  mkdirSync(targetAgentDir, { recursive: true });
  for (const entry of readdirSync(labDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      rmSync(join(targetAgentDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }
  cpSync(labDir, targetAgentDir, { recursive: true });
  return labDir;
}

/**
 * Prepare a sandboxed `agentsRoot` inside `gymRoot` for both global agents
 * (`agents/<name>`) and App-owned agents (`projects/<app>.app/agents/<name>`),
 * applying an optional `.lab/<labFork>` overlay cleanly without `node_modules`
 * symlinking or App-root file copying.
 */
export function prepareGymAgentSandbox(options: {
  baseAgentsRoot: string;
  projectsRoot: string;
  gymRoot: string;
  agentName: string;
  labFork?: string;
}): string {
  const { baseAgentsRoot, projectsRoot, gymRoot, agentName, labFork } = options;
  const resolvedBaseDir = resolveGymAgentDir(
    baseAgentsRoot,
    agentName,
    projectsRoot,
  );
  if (!resolvedBaseDir) {
    throw new Error(`Agent '${agentName}' not found in: ${baseAgentsRoot}`);
  }

  const sandboxRoot = join(gymRoot, labFork ? "agents-lab" : "agents-sandbox");
  if (existsSync(baseAgentsRoot)) {
    cpSync(baseAgentsRoot, sandboxRoot, { recursive: true });
    rmSync(join(sandboxRoot, ".lab"), { recursive: true, force: true });
    rmSync(join(sandboxRoot, ".git"), { recursive: true, force: true });
  } else {
    mkdirSync(sandboxRoot, { recursive: true });
  }

  // Seed App-owned sibling agents into `sandboxRoot` so App-local calls and
  // overlays resolve cleanly.
  const sourceParent = dirname(resolvedBaseDir);
  if (sourceParent !== baseAgentsRoot && existsSync(sourceParent)) {
    for (const entry of readdirSync(sourceParent, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dest = join(sandboxRoot, entry.name);
      if (!existsSync(join(dest, "agent.json"))) {
        cpSync(join(sourceParent, entry.name), dest, { recursive: true });
      }
    }
  }

  const agentTarget = join(sandboxRoot, agentName);
  if (!existsSync(join(agentTarget, "agent.json"))) {
    cpSync(resolvedBaseDir, agentTarget, { recursive: true });
  }

  if (labFork) {
    applyGymLabOverlay({
      targetAgentDir: agentTarget,
      baseAgentsRoot,
      projectsRoot,
      agentName,
      labFork,
    });
  }

  return sandboxRoot;
}

export function buildGymToolDenials(agentDir: string): ToolDenial[] {
  const config = JSON.parse(
    readFileSync(join(agentDir, "agent.json"), "utf8"),
  ) as {
    tools?: unknown;
  };
  if (!Array.isArray(config.tools)) return [];
  return config.tools.flatMap((name) => {
    if (typeof name !== "string") return [];
    const reason = GYM_TOOL_DENIAL_REASONS[name];
    return reason ? [{ name, reason }] : [];
  });
}

export interface GymWorkflowRunConfig {
  entry: WorkflowScenarioEntry;
  defaultAgentName: string;
  taskText: string;
  repoRoot: string;
  workDir: string;
  gymState: string;
  agentsRoot: string;
  projectsRoot: string;
  sharedRoot: string;
  globalAgentsRoot: string;
  models: GymModelMap;
  timeoutMs: number;
  agentFixtures?: Record<string, DirectAgentFixtureHandler>;
  runAgent?: (options: DirectAgentRunOptions) => Promise<DirectAgentRunResult>;
  onNotice?: (message: string) => void;
}

export interface GymWorkflowAdapterOutcome {
  sessionId: string;
  status: string;
  sessionPath: string;
  error?: string;
  workflowRun: DirectWorkflowRunResult;
}

const TASK_WORKTREE_IGNORES = [
  ".state/",
  "agents/",
  "workflow-run.json",
  "task-result.json",
  "transcript.jsonl",
];

/**
 * Task-backed workflows require the same linked-worktree shape used by Host
 * attempts. Gym starts with a copied scenario directory, so promote that copy
 * into a committed repository and replace it with a named linked worktree.
 */
export function prepareGymTaskWorktree(
  workDir: string,
  gymState: string,
): void {
  const gitMarker = join(workDir, ".git");
  if (existsSync(gitMarker)) {
    if (statSync(gitMarker).isFile()) return;
    throw new Error(
      `Task-backed Gym workflow requires a linked worktree (.git must be a file): ${workDir}`,
    );
  }

  const repository = join(gymState, "workflow-task-repository");
  rmSync(repository, { recursive: true, force: true });
  cpSync(workDir, repository, { recursive: true });

  const ignorePath = join(repository, ".gitignore");
  const existingIgnore = existsSync(ignorePath)
    ? readFileSync(ignorePath, "utf8")
    : "";
  const existingLines = new Set(
    existingIgnore.split(/\r?\n/).map((line) => line.trim()),
  );
  const missingIgnores = TASK_WORKTREE_IGNORES.filter(
    (entry) => !existingLines.has(entry),
  );
  if (missingIgnores.length > 0) {
    const prefix =
      existingIgnore.length > 0 && !existingIgnore.endsWith("\n") ? "\n" : "";
    writeFileSync(
      ignorePath,
      `${existingIgnore}${prefix}${missingIgnores.join("\n")}\n`,
    );
  }

  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git("init", "-b", "main");
  git("config", "user.name", "May Gym");
  git("config", "user.email", "gym@may.local");
  git("add", ".");
  git("commit", "-m", "scenario baseline");

  rmSync(workDir, { recursive: true, force: true });
  git("worktree", "add", "-b", "gym/task", workDir);
}

export async function runGymWorkflowEntry(
  config: GymWorkflowRunConfig,
): Promise<GymWorkflowAdapterOutcome> {
  const ownerAgent = config.entry.agent?.trim() || config.defaultAgentName;
  const agentDir = resolveGymAgentDir(
    config.agentsRoot,
    ownerAgent,
    config.projectsRoot,
  );
  if (!agentDir) {
    throw new Error(
      `Agent '${ownerAgent}' not found in ${config.agentsRoot} or ${config.projectsRoot}`,
    );
  }

  // Execute the selected candidate tree, not a byte-compared canonical entrypoint.
  // For App-owned agents, recreate the App directory shape in Gym state so
  // relative imports outside the agent directory keep working while candidate
  // workflows and their helper modules retain their identity.
  const canonicalAgentDir = resolveGymAgentDir(
    config.globalAgentsRoot,
    ownerAgent,
    config.projectsRoot,
  );
  let effectiveAgentDir = agentDir;
  let workspaceAppCopy: string | null = null;
  if (
    canonicalAgentDir &&
    resolve(canonicalAgentDir) !== resolve(agentDir) &&
    basename(dirname(canonicalAgentDir)) === "agents"
  ) {
    const canonicalAppRoot = dirname(dirname(canonicalAgentDir));
    if (basename(canonicalAppRoot).endsWith(".app")) {
      const runTag = `${basename(dirname(config.gymState))}-${process.pid}`;
      workspaceAppCopy = join(
        config.repoRoot,
        ".state",
        "gym-workflow-apps",
        runTag,
        basename(canonicalAppRoot),
      );
      rmSync(workspaceAppCopy, { recursive: true, force: true });
      cpSync(canonicalAppRoot, workspaceAppCopy, { recursive: true });
      effectiveAgentDir = join(workspaceAppCopy, "agents", ownerAgent);
      rmSync(effectiveAgentDir, { recursive: true, force: true });
      cpSync(agentDir, effectiveAgentDir, { recursive: true });
    }
  }
  const effectiveWorkflowDir = join(effectiveAgentDir, "workflows");
  const workflowSource = ["ts", "js"]
    .map((extension) =>
      join(effectiveWorkflowDir, `${config.entry.workflow}.${extension}`),
    )
    .find(existsSync);
  const taskBacked = workflowSource
    ? (
        (await import(pathToFileURL(workflowSource).href)) as {
          workspace?: { kind?: string };
        }
      ).workspace?.kind === "task"
    : false;
  if (taskBacked) {
    prepareGymTaskWorktree(config.workDir, config.gymState);
  }

  // Mirror identity directory into workDir/agents/<ownerAgent> for relative reads
  // and `visibleAgentDir` prompt/skill resolution during child agent calls. Task
  // worktrees ignore this Gym-only harness copy so source acceptance stays clean.
  const agentDest = join(config.workDir, "agents", ownerAgent);
  if (!existsSync(agentDest)) {
    mkdirSync(join(config.workDir, "agents"), { recursive: true });
    cpSync(agentDir, agentDest, { recursive: true });
  }

  const traceDir = join(config.gymState, "workflow-trace");
  const input =
    config.entry.input !== undefined ? config.entry.input : config.taskText;
  const directOptions = {
    agentName: ownerAgent,
    workflowDir: effectiveWorkflowDir,
    workflowName: config.entry.workflow,
    input,
    projectRoot: config.repoRoot,
    workRoot: config.workDir,
    agentsRoot: config.agentsRoot,
    projectsRoot: config.projectsRoot,
    globalAgentsRoot: config.globalAgentsRoot,
    sharedRoot: config.sharedRoot,
    outputRoot: config.gymState,
    traceDir,
    models: config.models,
    timeoutMs: config.timeoutMs,
    agentFixtures: config.agentFixtures,
    runAgent: config.runAgent,
    onNotice: config.onNotice,
  };
  let wfRun: DirectWorkflowRunResult;
  try {
    wfRun = await run({
      ...directOptions,
      cwd: config.workDir,
      task: {
        outcome: config.taskText.trim() || "Complete the scenario task",
      },
    });
  } finally {
    if (workspaceAppCopy) {
      rmSync(dirname(workspaceAppCopy), { recursive: true, force: true });
    }
  }

  writeFileSync(
    join(config.workDir, "workflow-run.json"),
    `${JSON.stringify(wfRun.report, null, 2)}\n`,
  );
  const wfOutput = wfRun.report.result?.output;
  if (
    wfOutput &&
    typeof wfOutput === "object" &&
    !Array.isArray(wfOutput) &&
    typeof (wfOutput as Record<string, unknown>).state === "string" &&
    typeof (wfOutput as Record<string, unknown>).summary === "string" &&
    !existsSync(join(config.workDir, "task-result.json"))
  ) {
    writeFileSync(
      join(config.workDir, "task-result.json"),
      `${JSON.stringify(wfOutput, null, 2)}\n`,
    );
  }

  const combinedSessionDir = join(
    config.gymState,
    "workflow-combined",
    wfRun.report.executionId,
  );
  mkdirSync(combinedSessionDir, { recursive: true });
  let combinedJsonl = "";
  for (const child of wfRun.childSessions) {
    if (existsSync(child.transcriptPath)) {
      const content = readFileSync(child.transcriptPath, "utf8");
      if (content) {
        combinedJsonl += content.endsWith("\n") ? content : `${content}\n`;
      }
    }
  }
  if (combinedJsonl) {
    writeFileSync(join(combinedSessionDir, "session.jsonl"), combinedJsonl);
  }

  return {
    sessionId: wfRun.report.executionId,
    status: wfRun.status === "done" ? "success" : wfRun.status,
    sessionPath: combinedSessionDir,
    ...(wfRun.report.error?.message
      ? { error: wfRun.report.error.message }
      : {}),
    workflowRun: wfRun,
  };
}
