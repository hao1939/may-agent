import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, renameSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SubagentDefinition } from "./types.js";

/** Serializable agent config (no tools, no apiKey, no full model object). */
export interface PersistedAgentConfig {
  name: string;
  description: string;
  domain: string;
  systemPrompt?: string;
  systemPromptFiles?: string[];
  workspace?: string;
  model: { provider: string; id: string };
  timeoutMs?: number;
  memoryLimit?: number;
}

/** Serializable session record. */
export interface PersistedSession {
  agent: string;
  task: string;
  status: "running" | "done" | "error" | "interrupted";
  startedAt: number;
  endedAt?: number;
  error?: string;
}

/** Shape of registry.json on disk. */
export interface Registry {
  agents: Record<string, PersistedAgentConfig>;
  sessions: Record<string, PersistedSession>;
}

/** A single memory entry, appended to memory/<name>.jsonl after each session. */
export interface MemoryEntry {
  task: string;
  status: string;
  duration: string;
  summary: string | null;
  timestamp: number;
}

function emptyRegistry(): Registry {
  return { agents: {}, sessions: {} };
}

/** Extract persistable fields from a SubagentDefinition. */
export function toPersistedConfig(def: SubagentDefinition): PersistedAgentConfig {
  const config: PersistedAgentConfig = {
    name: def.name,
    description: def.description,
    domain: def.domain,
    model: { provider: (def.model as any).provider ?? "unknown", id: def.model.id },
  };
  if (def.systemPrompt !== undefined) config.systemPrompt = def.systemPrompt;
  if (def.systemPromptFiles !== undefined) config.systemPromptFiles = def.systemPromptFiles;
  if (def.workspace !== undefined) config.workspace = def.workspace;
  if (def.timeoutMs !== undefined) config.timeoutMs = def.timeoutMs;
  if (def.memoryLimit !== undefined) config.memoryLimit = def.memoryLimit;
  return config;
}

// ── Session JSONL helpers ──────────────────────────────────────────────

/** Return the path to a session's directory. */
export function sessionDir(persistDir: string, sessionId: string): string {
  return join(persistDir, "sessions", sessionId);
}

/** Return the path to a session's JSONL file. */
export function sessionJsonlPath(persistDir: string, sessionId: string): string {
  return join(sessionDir(persistDir, sessionId), "session.jsonl");
}

/** Return the path to a session's output directory. */
export function sessionOutputDir(persistDir: string, sessionId: string): string {
  return join(sessionDir(persistDir, sessionId), "output");
}

/** Create the session directory (idempotent). */
export function ensureSessionDir(persistDir: string, sessionId: string): void {
  mkdirSync(sessionDir(persistDir, sessionId), { recursive: true });
}

/** Append a single message as a JSON line to the session's JSONL file. */
export function appendSessionMessage(persistDir: string, sessionId: string, message: AgentMessage): void {
  const line = JSON.stringify(message) + "\n";
  appendFileSync(sessionJsonlPath(persistDir, sessionId), line, "utf-8");
}

/** Read all messages from a session's JSONL file. Returns [] if the file doesn't exist or is empty.
 *  Corrupted lines are skipped with a warning. */
export function readSessionMessages(persistDir: string, sessionId: string): AgentMessage[] {
  const filePath = sessionJsonlPath(persistDir, sessionId);
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  const messages: AgentMessage[] = [];
  for (const line of raw.trim().split("\n")) {
    try {
      messages.push(JSON.parse(line) as AgentMessage);
    } catch {
      console.warn(`[persistence] Skipping corrupted JSONL line in ${filePath}`);
    }
  }
  return messages;
}

// ── History / archival helpers ─────────────────────────────────────────

/** Return the path to the history directory: <persistDir>/sessions/history/ */
export function historyDir(persistDir: string): string {
  return join(persistDir, "sessions", "history");
}

/** Move a session directory from sessions/<id>/ to sessions/history/<id>/. */
export function archiveSession(persistDir: string, sessionId: string): void {
  const src = sessionDir(persistDir, sessionId);
  const dest = join(historyDir(persistDir), sessionId);
  mkdirSync(historyDir(persistDir), { recursive: true });
  // Remove any existing archived session to avoid ENOTEMPTY on re-archival
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  renameSync(src, dest);
}

/** Restore the session JSONL from the archive back to the active session directory.
 *  Copies the archived session.jsonl into the active session dir so that new
 *  messages are appended cumulatively. No-op if there is no archived JSONL or
 *  if the active JSONL already exists (never overwrites existing data).
 *  The active session dir must already exist. */
export function restoreSessionFromArchive(persistDir: string, sessionId: string): void {
  const archivedJsonl = join(historyDir(persistDir), sessionId, "session.jsonl");
  if (!existsSync(archivedJsonl)) return;
  const activeJsonl = sessionJsonlPath(persistDir, sessionId);
  // Don't overwrite if active JSONL already has data (defensive guard)
  if (existsSync(activeJsonl)) return;
  copyFileSync(archivedJsonl, activeJsonl);
}

// ── Memory JSONL helpers ───────────────────────────────────────────────

/** Return the path to an agent's memory JSONL file. */
export function memoryPath(persistDir: string, name: string): string {
  return join(persistDir, "memory", `${name}.jsonl`);
}

/** Append a memory entry as a JSON line. Creates the file and directory if needed. */
export function appendMemoryEntry(persistDir: string, name: string, entry: MemoryEntry): void {
  const filePath = memoryPath(persistDir, name);
  mkdirSync(dirname(filePath), { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(filePath, line, "utf-8");
}

/** Read the last N memory entries (or all if limit is not specified).
 *  Corrupted lines are skipped with a warning. */
export function readMemoryEntries(persistDir: string, name: string, limit?: number): MemoryEntry[] {
  const filePath = memoryPath(persistDir, name);
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  const entries: MemoryEntry[] = [];
  for (const line of raw.trim().split("\n")) {
    try {
      entries.push(JSON.parse(line) as MemoryEntry);
    } catch {
      console.warn(`[persistence] Skipping corrupted JSONL line in ${filePath}`);
    }
  }
  if (limit !== undefined) {
    if (limit <= 0) return [];
    return entries.slice(-limit);
  }
  return entries;
}

// ── RegistryStore ──────────────────────────────────────────────────────

export class RegistryStore {
  private filePath: string;
  private data: Registry;
  readonly persistDir: string;

  constructor(persistDir: string) {
    this.persistDir = persistDir;
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

  /** Atomic save: write to a temp file, then rename. */
  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmpPath = this.filePath + ".tmp";
    writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf-8");
    renameSync(tmpPath, this.filePath);
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

  /** Update session status (done/error/interrupted). */
  updateSessionStatus(sessionId: string, status: "done" | "error" | "interrupted", error?: string): void {
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
