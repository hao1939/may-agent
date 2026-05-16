/**
 * circuit-breaker.ts — Provider circuit breaker for agent sessions.
 *
 * Tracks consecutive errors per agent. After 3+ consecutive provider errors,
 * the agent is auto-disabled (circuit "open"). A SIGNAL file is generated
 * for human/coach attention. Manual re-enable by deleting the SIGNAL file
 * or calling resetCircuitBreaker().
 *
 * Usage:
 *   import { checkCircuitBreaker, recordOutcome } from "./circuit-breaker.js";
 *
 *   // Before running an agent:
 *   const blocked = checkCircuitBreaker(agentsRoot, agent);
 *   if (blocked) return ctx.done(`Circuit breaker open for ${agent}: ${blocked}`);
 *
 *   // After running:
 *   recordOutcome(agentsRoot, agent, result.status === "error");
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const THRESHOLD = 3; // consecutive errors before tripping
const AUTO_RESET_MS = 60 * 60 * 1000; // bound transient provider outages to one retry window
const STATE_FILE = "circuit-breaker-state.json";

interface AgentState {
  consecutiveErrors: number;
  lastError?: string;
  trippedAt?: string;
}

interface BreakerState {
  agents: Record<string, AgentState>;
}

function getAppRoot(agentsRoot: string): string {
  if (basename(agentsRoot) === "agents" && dirname(agentsRoot) !== dirname(dirname(agentsRoot))) {
    return dirname(agentsRoot);
  }
  return agentsRoot;
}

function getStatePath(agentsRoot: string): string {
  return join(getAppRoot(agentsRoot), ".state", STATE_FILE);
}

function getLegacyStatePath(agentsRoot: string): string {
  return join(agentsRoot, "shared", STATE_FILE);
}

function getSignalPath(agentsRoot: string, agent: string): string {
  return join(agentsRoot, agent, "SIGNAL-circuit-breaker.md");
}

function loadState(agentsRoot: string): BreakerState {
  for (const path of [getStatePath(agentsRoot), getLegacyStatePath(agentsRoot)]) {
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {}
  }
  return { agents: {} };
}

function saveState(agentsRoot: string, state: BreakerState): void {
  const path = getStatePath(agentsRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Check if an agent's circuit breaker is open (tripped).
 * Returns null if OK to proceed, or a reason string if blocked.
 *
 * Also checks for manual re-enable: if the SIGNAL file was deleted,
 * the breaker resets automatically.
 */
export function checkCircuitBreaker(agentsRoot: string, agent: string): string | null {
  const state = loadState(agentsRoot);
  const agentState = state.agents[agent];

  if (!agentState || agentState.consecutiveErrors < THRESHOLD) {
    return null; // circuit closed — OK to proceed
  }

  // Check if SIGNAL file was manually deleted (= manual re-enable)
  const signalPath = getSignalPath(agentsRoot, agent);
  if (!existsSync(signalPath)) {
    // Manual re-enable detected — reset breaker
    state.agents[agent] = { consecutiveErrors: 0 };
    saveState(agentsRoot, state);
    return null;
  }

  const trippedAtMs = agentState.trippedAt ? Date.parse(agentState.trippedAt) : 0;
  if (trippedAtMs && Date.now() - trippedAtMs >= AUTO_RESET_MS) {
    state.agents[agent] = { consecutiveErrors: 0 };
    saveState(agentsRoot, state);
    try { unlinkSync(signalPath); } catch { /* already gone */ }
    return null;
  }

  return `Circuit breaker OPEN: ${agentState.consecutiveErrors} consecutive errors since ${agentState.trippedAt}`;
}

/**
 * Record the outcome of an agent session.
 * On error: increments counter, trips breaker at threshold, writes SIGNAL.
 * On success: resets counter, removes SIGNAL if present.
 */
export function recordOutcome(agentsRoot: string, agent: string, isError: boolean, errorDetail?: string): void {
  const state = loadState(agentsRoot);

  if (!state.agents[agent]) {
    state.agents[agent] = { consecutiveErrors: 0 };
  }

  if (isError) {
    state.agents[agent].consecutiveErrors++;
    state.agents[agent].lastError = errorDetail ?? new Date().toISOString();

    if (state.agents[agent].consecutiveErrors >= THRESHOLD && !state.agents[agent].trippedAt) {
      // Trip the breaker
      state.agents[agent].trippedAt = new Date().toISOString();
      writeSignalFile(agentsRoot, agent, state.agents[agent]);
    }
  } else {
    // Success — reset
    const wasTripped = state.agents[agent].consecutiveErrors >= THRESHOLD;
    state.agents[agent] = { consecutiveErrors: 0 };

    // Clean up SIGNAL file if it exists
    if (wasTripped) {
      const signalPath = getSignalPath(agentsRoot, agent);
      try { unlinkSync(signalPath); } catch { /* already gone */ }
    }
  }

  saveState(agentsRoot, state);
}

/**
 * Manually reset a specific agent's circuit breaker.
 */
export function resetCircuitBreaker(agentsRoot: string, agent: string): void {
  const state = loadState(agentsRoot);
  state.agents[agent] = { consecutiveErrors: 0 };
  saveState(agentsRoot, state);

  const signalPath = getSignalPath(agentsRoot, agent);
  try { unlinkSync(signalPath); } catch { /* already gone */ }
}

function writeSignalFile(agentsRoot: string, agent: string, agentState: AgentState): void {
  const signalPath = getSignalPath(agentsRoot, agent);
  const dir = join(agentsRoot, agent);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const content = `# ⚡ Circuit Breaker Tripped

**Agent**: ${agent}
**Tripped at**: ${agentState.trippedAt}
**Consecutive errors**: ${agentState.consecutiveErrors}
**Last error**: ${agentState.lastError ?? "unknown"}

## What happened
Agent "${agent}" has failed ${agentState.consecutiveErrors} consecutive sessions due to provider errors.
The circuit breaker has automatically disabled this agent to prevent wasting compute.

## How to re-enable
Delete this file to re-enable the agent. The circuit breaker will reset automatically
on the next heartbeat cycle.

\`\`\`bash
rm ${signalPath}
\`\`\`

Or call \`resetCircuitBreaker(agentsRoot, "${agent}")\` programmatically.
`;

  writeFileSync(signalPath, content, "utf-8");
}
