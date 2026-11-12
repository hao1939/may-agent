import { existsSync, readFileSync } from "node:fs";

/** Durable executor evidence. Task identity and generation remain daemon-owned. */
export type CodexGoalBinding = {
  appId: string;
  taskId: string;
  generation: number;
  threadId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  staleInterrupts: number;
};

export type CodexGoalBindingFile = { version: 1; bindings: Record<string, CodexGoalBinding> };

export function codexGoalBindingKey(appId: string, taskId: string): string {
  return `${appId}\u0000${taskId}`;
}

export function readCodexGoalBindings(path: string): CodexGoalBindingFile {
  if (!existsSync(path)) return { version: 1, bindings: {} };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as CodexGoalBindingFile;
  if (
    parsed?.version !== 1 ||
    !parsed.bindings ||
    typeof parsed.bindings !== "object" ||
    Array.isArray(parsed.bindings)
  ) {
    throw new Error(`Invalid Codex goal binding file: ${path}`);
  }
  return parsed;
}
