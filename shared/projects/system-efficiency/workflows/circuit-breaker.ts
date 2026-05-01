import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const STATE_FILE = "circuit-breaker-state.json";
const THRESHOLD = 3;

interface AgentState {
  consecutiveErrors: number;
  lastError?: string;
  trippedAt?: string;
}

interface State {
  agents: Record<string, AgentState>;
}

function readState(root: string): State {
  const path = join(root, "shared", STATE_FILE);
  if (!existsSync(path)) return { agents: {} };
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeState(root: string, state: State): void {
  const dir = join(root, "shared");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, STATE_FILE), JSON.stringify(state, null, 2));
}

function signalPath(root: string, agent: string): string {
  return join(root, agent, "SIGNAL-circuit-breaker.md");
}

export function checkCircuitBreaker(root: string, agent: string): string | null {
  const sp = signalPath(root, agent);
  if (!existsSync(sp)) return null;
  const state = readState(root);
  const as = state.agents[agent];
  if (!as || as.consecutiveErrors < THRESHOLD) return null;
  return `Circuit breaker OPEN for ${agent}: ${as.consecutiveErrors} consecutive errors`;
}

export function recordOutcome(root: string, agent: string, isError: boolean, detail?: string): void {
  const state = readState(root);
  if (!state.agents[agent]) state.agents[agent] = { consecutiveErrors: 0 };
  const as = state.agents[agent];

  if (isError) {
    as.consecutiveErrors++;
    if (detail) as.lastError = detail;
    if (as.consecutiveErrors >= THRESHOLD) {
      as.trippedAt = new Date().toISOString();
      const sp = signalPath(root, agent);
      mkdirSync(join(root, agent), { recursive: true });
      writeFileSync(sp, `# Circuit Breaker Tripped\n\n${as.consecutiveErrors} consecutive errors for ${agent}\nTripped at: ${as.trippedAt}\n`);
    }
  } else {
    as.consecutiveErrors = 0;
    delete as.trippedAt;
    const sp = signalPath(root, agent);
    if (existsSync(sp)) rmSync(sp);
  }

  writeState(root, state);
}

export function resetCircuitBreaker(root: string, agent: string): void {
  const state = readState(root);
  if (state.agents[agent]) {
    state.agents[agent].consecutiveErrors = 0;
    delete state.agents[agent].trippedAt;
  }
  writeState(root, state);
  const sp = signalPath(root, agent);
  if (existsSync(sp)) rmSync(sp);
}
