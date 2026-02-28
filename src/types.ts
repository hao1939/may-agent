import type { AgentTool, AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

/** Minimal definition for registering a feature unit. */
export interface SubagentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  model: Model<any>;
  tools: AgentTool[];
  apiKey?: string;
}

/** Runtime info about a session. */
export interface SessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
  error?: string;
}

/** Result of a completed session. */
export interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  messages: AgentMessage[];
  duration: string;
  error?: string;
}
