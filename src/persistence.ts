import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { SubagentDefinition } from "./types.js";

/** Serializable agent config (no tools, no apiKey, no full model object). */
export interface PersistedAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  model: { provider: string; id: string };
}

/** Serializable session record. */
export interface PersistedSession {
  agent: string;
  task: string;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
  error?: string;
}

/** Shape of registry.json on disk. */
export interface Registry {
  agents: Record<string, PersistedAgentConfig>;
  sessions: Record<string, PersistedSession>;
}

function emptyRegistry(): Registry {
  return { agents: {}, sessions: {} };
}

/** Extract persistable fields from a SubagentDefinition. */
export function toPersistedConfig(def: SubagentDefinition): PersistedAgentConfig {
  return {
    name: def.name,
    description: def.description,
    systemPrompt: def.systemPrompt,
    model: { provider: (def.model as any).provider ?? "unknown", id: def.model.id },
  };
}

export class RegistryStore {
  private filePath: string;
  private data: Registry;

  constructor(persistDir: string) {
    this.filePath = join(persistDir, "registry.json");
    this.data = this.load();
  }

  private load(): Registry {
    if (!existsSync(this.filePath)) return emptyRegistry();
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as Registry;
    } catch {
      return emptyRegistry();
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  /** Persist an agent config. */
  saveAgent(def: SubagentDefinition): void {
    this.data.agents[def.name] = toPersistedConfig(def);
    this.save();
  }

  /** Record a new session. */
  saveSession(sessionId: string, entry: PersistedSession): void {
    this.data.sessions[sessionId] = entry;
    this.save();
  }

  /** Update session status (done/error). */
  updateSessionStatus(sessionId: string, status: "done" | "error", error?: string): void {
    const session = this.data.sessions[sessionId];
    if (!session) return;
    session.status = status;
    session.endedAt = Date.now();
    if (error) session.error = error;
    this.save();
  }

  /** Get the current registry data (for testing / inspection). */
  getRegistry(): Registry {
    return this.data;
  }

  /** Get the file path (for testing). */
  getFilePath(): string {
    return this.filePath;
  }
}
