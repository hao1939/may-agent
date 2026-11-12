/**
 * Host-free Gym workflow execution adapter.
 *
 * Bridges Gym scenarios (`workflow_entry` and `allow_workflow`) onto
 * `runDirectWorkflow` and `createDirectWorkflowTool` without importing SQLite,
 * EventBus, or SubagentManager.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelWithApiKey } from "../../may-agent/src/lib/types.js";
import type {
  DirectAgentRunOptions,
  DirectAgentRunResult,
  ToolDenial,
} from "../../may-agent/src/app/direct-agent.js";
import {
  createDirectWorkflowTool,
  runDirectWorkflow,
  type DirectAgentFixtureHandler,
  type DirectWorkflowRunResult,
} from "../../may-agent/src/app/direct-workflow.js";
import { resolveRuntimeAgentDirectory } from "../../may-agent/src/app/loader/agent-discovery.js";
import type { WorkflowScenarioEntry } from "./scenarios/types";

export const GYM_TOOL_DENIAL_REASONS: Readonly<Record<string, string>> = {
  agents: "isolated Gym scenarios do not dispatch supporting agents",
  workflow: "the direct Gym adapter denies workflow unless allow_workflow is enabled",
  message: "isolated Gym scenarios must not notify real users or agents",
  cron: "isolated Gym scenarios must not change autonomous schedules",
  checkpoint: "the direct Gym adapter has no hosted durable checkpoint service",
  "cli-delegation": "isolated Gym scenarios do not delegate to external agent CLIs",
  "system-status": "isolated Gym scenarios do not expose production system state",
  system_status: "isolated Gym scenarios do not expose production system state",
  query_db: "isolated Gym scenarios do not expose the production database",
  "query-db": "isolated Gym scenarios do not expose the production database",
};

export function resolveGymAgentDir(
  agentsRoot: string,
  agentName: string,
  projectsRoot?: string,
): string | null {
  const directCandidate = join(agentsRoot, agentName);
  if (existsSync(join(directCandidate, "agent.json"))) return directCandidate;
  const discovered =
    resolveRuntimeAgentDirectory(agentsRoot, agentName) ??
    (projectsRoot ? resolveRuntimeAgentDirectory(agentsRoot, agentName, projectsRoot) : null);
  return discovered?.dir ?? null;
}

export function buildGymToolDenials(
  agentDir: string,
  options: { allowWorkflow?: boolean } = {},
): ToolDenial[] {
  const config = JSON.parse(readFileSync(join(agentDir, "agent.json"), "utf8")) as {
    tools?: unknown;
  };
  if (!Array.isArray(config.tools)) return [];
  return config.tools.flatMap((name) => {
    if (typeof name !== "string") return [];
    if (name === "workflow" && options.allowWorkflow) return [];
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
  models: Record<string, ModelWithApiKey>;
  timeoutMs: number;
  allowChildAgentWorkflowTool?: boolean;
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

export async function runGymWorkflowEntry(
  config: GymWorkflowRunConfig,
): Promise<GymWorkflowAdapterOutcome> {
  const ownerAgent = config.entry.agent?.trim() || config.defaultAgentName;
  const agentDir = resolveGymAgentDir(config.agentsRoot, ownerAgent, config.projectsRoot);
  if (!agentDir) {
    throw new Error(`Agent '${ownerAgent}' not found in ${config.agentsRoot} or ${config.projectsRoot}`);
  }

  // Mirror identity directory into workDir/agents/<ownerAgent> for relative reads.
  const agentDest = join(config.workDir, "agents", ownerAgent);
  if (!existsSync(agentDest)) {
    mkdirSync(join(config.workDir, "agents"), { recursive: true });
    cpSync(agentDir, agentDest, { recursive: true });
  }

  const traceDir = join(config.gymState, "workflow-trace");
  const wfRun = await runDirectWorkflow({
    agentName: ownerAgent,
    workflowDir: join(agentDir, "workflows"),
    workflowName: config.entry.workflow,
    input: config.entry.input !== undefined ? config.entry.input : config.taskText,
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
    allowChildAgentWorkflowTool: config.allowChildAgentWorkflowTool,
    agentFixtures: config.agentFixtures,
    runAgent: config.runAgent,
    onNotice: config.onNotice,
  });

  writeFileSync(
    join(config.workDir, "workflow-run.json"),
    `${JSON.stringify(wfRun.report, null, 2)}\n`,
  );

  const combinedSessionDir = join(config.gymState, "workflow-combined", wfRun.report.executionId);
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
  } else {
    writeFileSync(
      join(combinedSessionDir, "session.jsonl"),
      `${JSON.stringify({
        role: "system",
        workflow: wfRun.report.workflow,
        status: wfRun.status,
        steps: wfRun.report.steps.length,
      })}\n`,
    );
  }

  return {
    sessionId: wfRun.report.executionId,
    status: wfRun.status === "done" ? "success" : wfRun.status,
    sessionPath: combinedSessionDir,
    ...(wfRun.report.error?.message ? { error: wfRun.report.error.message } : {}),
    workflowRun: wfRun,
  };
}

export function createGymAgentWorkflowTool(options: {
  agentName: string;
  agentDir: string;
  repoRoot: string;
  workDir: string;
  gymState: string;
  agentsRoot: string;
  projectsRoot: string;
  sharedRoot: string;
  globalAgentsRoot: string;
  models: Record<string, ModelWithApiKey>;
  timeoutMs: number;
  agentFixtures?: Record<string, DirectAgentFixtureHandler>;
  runAgent?: (options: DirectAgentRunOptions) => Promise<DirectAgentRunResult>;
  onUnconfirmedCleanup?: (unconfirmed: readonly string[]) => void;
  onNotice?: (message: string) => void;
}): ReturnType<typeof createDirectWorkflowTool> {
  return createDirectWorkflowTool({
    agentName: options.agentName,
    workflowDir: join(options.agentDir, "workflows"),
    projectRoot: options.repoRoot,
    workRoot: options.workDir,
    agentsRoot: options.agentsRoot,
    projectsRoot: options.projectsRoot,
    globalAgentsRoot: options.globalAgentsRoot,
    sharedRoot: options.sharedRoot,
    outputRoot: options.gymState,
    traceDir: join(options.gymState, "workflow-trace"),
    models: options.models,
    timeoutMs: options.timeoutMs,
    allowChildAgentWorkflowTool: true,
    agentFixtures: options.agentFixtures,
    runAgent: options.runAgent,
    onUnconfirmedCleanup: options.onUnconfirmedCleanup,
    onNotice: options.onNotice,
  });
}
