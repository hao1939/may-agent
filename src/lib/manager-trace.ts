/**
 * Session graph tracing — extracted from manager.ts for maintainability.
 *
 * All functions are standalone and take their dependencies as parameters.
 * The SubagentManager.trace() method delegates to buildTrace() below.
 */

import { getWorkflowRun, listWorkflowRunIds, getWorkflowStepSessions } from "./requests.js";
import type { WorkflowRunRecord } from "./requests.js";
import type { PersistedSession, Registry } from "./persistence.js";
import type { TraceNode, SessionTrace } from "./workflow.js";
import type { ActiveSession } from "./manager-utils.js";

/** Input context needed by trace functions — a subset of manager state. */
export interface TraceContext {
  persistDir: string;
  registryData: Registry;
  activeSessions: Map<string, ActiveSession>;
}

/**
 * Build a session trace from any session or workflow run ID.
 * Walks parent pointers up to the root, loads workflow run records,
 * and builds a tree showing the position of the target in the graph.
 */
export function buildTrace(targetId: string, ctx: TraceContext): SessionTrace | null {
  const { persistDir, registryData, activeSessions } = ctx;

  // Check if targetId is a workflow run
  const targetRun = getWorkflowRun(persistDir, targetId);
  if (targetRun) {
    return buildTraceFromWorkflowRun(targetRun, targetId, persistDir, registryData);
  }

  // Check if targetId is a session
  const persistedSession = registryData.sessions[targetId];
  const activeSession = activeSessions.get(targetId);
  if (persistedSession || activeSession) {
    const sessionData: PersistedSession = persistedSession ?? {
      agent: activeSession!.agentName,
      task: activeSession!.task,
      status: activeSession!.status,
      startedAt: activeSession!.startedAt,
      parentSessionId: activeSession!.parentSessionId,
      workflowRunId: activeSession!.workflowRunId,
      stepLabel: activeSession!.stepLabel,
    };
    return buildTraceFromSession(targetId, sessionData, targetId, persistDir, registryData);
  }

  return null;
}

function buildTraceFromSession(
  sessionId: string,
  session: PersistedSession,
  targetId: string,
  persistDir: string,
  registryData: Registry,
): SessionTrace {
  // If this session belongs to a workflow run, build from the workflow
  if (session.workflowRunId) {
    const run = getWorkflowRun(persistDir, session.workflowRunId);
    if (run) {
      return buildTraceFromWorkflowRun(run, targetId, persistDir, registryData);
    }
  }

  // Standalone session — just return it as a single node
  const node: TraceNode = {
    type: "session",
    id: sessionId,
    label: session.stepLabel ?? ("agent" in session ? session.agent : "unknown"),
    status: session.status,
    task: session.task,
    depth: 0,
    isTarget: sessionId === targetId,
    children: [],
  };

  return {
    targetId,
    path: [`${sessionId}/${node.label}`],
    tree: node,
  };
}

function buildTraceFromWorkflowRun(
  run: WorkflowRunRecord,
  targetId: string,
  persistDir: string,
  registryData: Registry,
): SessionTrace {
  // Walk up the parent chain to find the root workflow
  const chain: WorkflowRunRecord[] = [run];
  let current = run;
  while (current.parentWorkflowRunId) {
    const parent = getWorkflowRun(persistDir, current.parentWorkflowRunId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  // The root is chain[0]. Build the tree from the root.
  const rootRun = chain[0];

  // Build the root's parent session node (May's session)
  const parentSessionId = rootRun.parentSessionId ?? "unknown";
  const parentSession = registryData.sessions[parentSessionId];
  const rootNode: TraceNode = {
    type: "session",
    id: parentSessionId,
    label: parentSession?.agent ?? "caller",
    status: parentSession?.status ?? "unknown",
    task: parentSession?.task ?? "(unknown)",
    depth: 0,
    isTarget: parentSessionId === targetId,
    children: [],
  };

  // Build workflow tree recursively
  const wfNode = buildWorkflowNode(rootRun, targetId, persistDir, registryData);
  rootNode.children.push(wfNode);

  // Build path from root to target
  const path = findPathToTarget(rootNode, targetId);

  return { targetId, path, tree: rootNode };
}

function buildWorkflowNode(run: WorkflowRunRecord, targetId: string, persistDir: string, registryData: Registry): TraceNode {
  const node: TraceNode = {
    type: "workflow",
    id: run.runId,
    label: run.workflow,
    status: run.status,
    task: run.task,
    depth: run.depth,
    isTarget: run.runId === targetId,
    children: [],
  };

  // Add steps from sessions table
  const steps = getWorkflowStepSessions(persistDir, run.runId);
  for (const step of steps) {
    const stepNode: TraceNode = {
      type: "session",
      id: step.sessionId,
      label: step.stepLabel ?? step.agent,
      status: step.status,
      task: step.task,
      depth: run.depth,
      isTarget: step.sessionId === targetId,
      children: [],
    };
    node.children.push(stepNode);
  }

  // Find sub-workflow runs (children of this run)
  const allRunIds = listWorkflowRunIds(persistDir);
  for (const runId of allRunIds) {
    if (runId === run.runId) continue;
    const subRun = getWorkflowRun(persistDir, runId);
    if (subRun && subRun.parentWorkflowRunId === run.runId) {
      const subNode = buildWorkflowNode(subRun, targetId, persistDir, registryData);
      // Insert at end (order determined by startedAt)
      node.children.push(subNode);
    }
  }

  return node;
}

/** Walk the trace tree to find the path from root to a target node. */
export function findPathToTarget(node: TraceNode, targetId: string): string[] {
  if (node.id === targetId) {
    return [`${node.id}/${node.label}`];
  }
  for (const child of node.children) {
    const childPath = findPathToTarget(child, targetId);
    if (childPath.length > 0) {
      return [`${node.id}/${node.label}`, ...childPath];
    }
  }
  return [];
}
