/** Static definition of a feature unit. Passed by the caller. */
export interface SubagentDefinition {
  name: string;
  description: string;
  domain: string;
  systemPromptFiles?: string[];
  workspace?: string;
}

export interface SessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: "running" | "done" | "error" | "interrupted";
  startedAt: number;
  endedAt?: number;
}

export interface SubagentInfo {
  name: string;
  description: string;
  domain: string;
  sessions: SessionInfo[];
}

export interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  outputDir: string;
  duration: string;
}

export interface MemoryEntry {
  ts: number;
  sessionId: string;
  task: string;
  status: "done" | "error";
  duration: string;
  summary: string;
}
