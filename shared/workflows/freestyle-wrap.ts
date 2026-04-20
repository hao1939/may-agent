/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * freestyle-wrap — Ultra-thin workflow wrapper for ad-hoc sessions.
 *
 * Purpose: Increase workflow coverage by wrapping sessions that would otherwise
 * run as bare agent.fork() calls. This adds minimal overhead (no extra steps)
 * while ensuring the session is tracked in the workflow system.
 *
 * Use cases:
 * - Evaluator sessions (task tree evaluations)
 * - Bob knowledge work (deep-dive processing, KB updates)
 * - Tech-lead review sessions
 * - Any session dispatched via fork that isn't already in a workflow
 *
 * Flow:
 *   1. Single step: run the task with the specified agent
 *   2. Return the result
 *
 * This is intentionally a 1-step workflow. The goal is coverage tracking,
 * not adding process overhead. C_fixed ≈ 0 (no verification, no retry).
 *
 * Input format:
 *   agent: <agent-name>
 *   <task content>
 */

export const name: string = "freestyle-wrap";

export const description: string =
  "Ultra-thin workflow wrapper for ad-hoc sessions. Single step, no overhead. " +
  "Ensures session appears in workflow tracking for coverage metrics.";

interface ParsedInput {
  agent: string;
  task: string;
}

function parseInput(raw: string): ParsedInput {
  const agentMatch = raw.match(/^agent:\s*(.+)$/m);
  if (!agentMatch) {
    // Default: extract agent from context or use "bob"
    return { agent: "bob", task: raw };
  }
  const agent = agentMatch[1].trim();
  const task = raw.replace(/^agent:\s*.+$/m, "").trim();
  return { agent, task };
}

export async function execute(
  input: string,
  context: WorkflowContext,
): Promise<WorkflowResult> {
  const { agent, task } = parseInput(input);

  const result = await context.runStep({
    agent,
    task,
    label: "execute",
  });

  return {
    status: result.status === "done" ? "done" : "failed",
    summary: result.summary || "Session completed",
  };
}
