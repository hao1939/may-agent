import type { AgentTool, AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

/** Minimal definition for registering a feature unit. */
export interface SubagentDefinition {
  name: string;
  description: string;
  domain: string;

  // System prompt: if systemPrompt is provided, it takes precedence over systemPromptFiles.
  // systemPromptFiles are loaded and concatenated at session start.
  systemPrompt?: string;
  systemPromptFiles?: string[];

  // Caller-managed paths (persisted for resume)
  workspace?: string;
  /** Directory containing agent knowledge files (domain.md, lessons.md, etc.). */
  knowledgeDir?: string;

  /** Directories to scan for skills (SKILL.md files). Per-agent skills dir is auto-added from knowledgeDir. */
  skillsDirs?: string[];

  // Capabilities
  tools: AgentTool[];
  model: Model<any>;
  apiKey?: string;
  timeoutMs?: number;
  memoryLimit?: number; // default 20
}

/** Runtime info about a session. */
export interface SessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: "running" | "done" | "error" | "interrupted";
  startedAt: number;
  endedAt?: number;
  runtime: string;
  outputDir: string;
  lastActivity?: string;
  error?: string;
}

/** Result of a completed session. */
export interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  messages: AgentMessage[];
  duration: string;
  outputDir: string;
  error?: string;
}
