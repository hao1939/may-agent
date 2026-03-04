import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, renameSync, rmSync, copyFileSync, readdirSync } from "node:fs";
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
  status: "running" | "done" | "error" | "interrupted" | "idle";
  startedAt: number;
  endedAt?: number;
  error?: string;
  parentSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
}

/** Shape of the registry data (in-memory view).
 *  Agents are only held in-memory (re-registered on every startup).
 *  Sessions are persisted as individual meta.json files per session dir. */
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

// ── Shared JSONL parser ─────────────────────────────────────────────────

/** Read all JSON lines from a file, skipping corrupted lines. Returns [] if not found or empty. */
function readJsonlFile<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  const items: T[] = [];
  for (const line of raw.trim().split("\n")) {
    try {
      items.push(JSON.parse(line) as T);
    } catch {
      console.warn(`[persistence] Skipping corrupted JSONL line in ${filePath}`);
    }
  }
  return items;
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

/** Check whether a session directory exists on disk. */
export function sessionExists(persistDir: string, sessionId: string): boolean {
  return existsSync(sessionDir(persistDir, sessionId));
}

/** Append a single message as a JSON line to the session's JSONL file. */
export function appendSessionMessage(persistDir: string, sessionId: string, message: AgentMessage): void {
  const line = JSON.stringify(message) + "\n";
  appendFileSync(sessionJsonlPath(persistDir, sessionId), line, "utf-8");
}

/** Read all messages from a session's JSONL file. Returns [] if the file doesn't exist or is empty.
 *  Corrupted lines are skipped with a warning. */
export function readSessionMessages(persistDir: string, sessionId: string): AgentMessage[] {
  return readJsonlFile<AgentMessage>(sessionJsonlPath(persistDir, sessionId));
}

/** Delete the session JSONL file if it exists. */
export function clearSessionMessages(persistDir: string, sessionId: string): void {
  const filePath = sessionJsonlPath(persistDir, sessionId);
  if (existsSync(filePath)) {
    rmSync(filePath);
  }
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
  const entries = readJsonlFile<MemoryEntry>(memoryPath(persistDir, name));
  if (limit !== undefined) {
    if (limit <= 0) return [];
    return entries.slice(-limit);
  }
  return entries;
}

// ── Session meta.json helpers ─────────────────────────────────────────

/** Path to a session's meta.json (in active session dir). */
export function sessionMetaPath(persistDir: string, sessionId: string): string {
  return join(sessionDir(persistDir, sessionId), "meta.json");
}

/** Path to a session's meta.json in the history archive. */
function archivedSessionMetaPath(persistDir: string, sessionId: string): string {
  return join(historyDir(persistDir), sessionId, "meta.json");
}

/** Read a session's meta.json. Checks active dir first, then history.
 *  Returns null if not found or corrupted. */
export function readSessionMeta(persistDir: string, sessionId: string): PersistedSession | null {
  // Check active session dir first
  const activePath = sessionMetaPath(persistDir, sessionId);
  if (existsSync(activePath)) {
    try {
      return JSON.parse(readFileSync(activePath, "utf-8")) as PersistedSession;
    } catch {
      return null;
    }
  }
  // Fall back to history archive
  const archivePath = archivedSessionMetaPath(persistDir, sessionId);
  if (existsSync(archivePath)) {
    try {
      return JSON.parse(readFileSync(archivePath, "utf-8")) as PersistedSession;
    } catch {
      return null;
    }
  }
  return null;
}

/** Write a session's meta.json atomically. Creates the session dir if needed. */
export function writeSessionMeta(persistDir: string, sessionId: string, meta: PersistedSession): void {
  ensureSessionDir(persistDir, sessionId);
  const filePath = sessionMetaPath(persistDir, sessionId);
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(meta, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

/** Scan sessions/ directory for all session IDs (active, not archived).
 *  Returns directory names that look like session IDs (skips 'history'). */
function listActiveSessionIds(persistDir: string): string[] {
  const sessionsRoot = join(persistDir, "sessions");
  if (!existsSync(sessionsRoot)) return [];
  try {
    return readdirSync(sessionsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "history")
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Scan sessions/history/ directory for all archived session IDs. */
function listArchivedSessionIds(persistDir: string): string[] {
  const histDir = historyDir(persistDir);
  if (!existsSync(histDir)) return [];
  try {
    return readdirSync(histDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Scan all session meta.json files (active + archived) and return a map.
 *  This is the replacement for reading the sessions section of registry.json. */
export function loadAllSessionMetas(persistDir: string): Record<string, PersistedSession> {
  const result: Record<string, PersistedSession> = {};
  // Active sessions
  for (const sid of listActiveSessionIds(persistDir)) {
    const meta = readSessionMeta(persistDir, sid);
    if (meta) result[sid] = meta;
  }
  // Archived sessions (don't overwrite active — active takes precedence)
  for (const sid of listArchivedSessionIds(persistDir)) {
    if (result[sid]) continue;
    const meta = readSessionMeta(persistDir, sid);
    if (meta) result[sid] = meta;
  }
  return result;
}

// ── RegistryStore ──────────────────────────────────────────────────────
//
// Per-session file-based storage. No single shared file.
//
// Agent configs: in-memory only (re-registered on every startup).
// Session metadata: individual meta.json per session directory.
//
// This design eliminates the single-file bottleneck that caused
// conflicts when multiple may-agent instances share the same .state/.

export class RegistryStore {
  private agents: Record<string, PersistedAgentConfig> = {};
  readonly persistDir: string;

  constructor(persistDir: string) {
    this.persistDir = persistDir;
    mkdirSync(persistDir, { recursive: true });
    this.migrateFromRegistryJson();
  }

  /** One-time migration: if a legacy registry.json exists, write individual
   *  meta.json files for any sessions that don't already have one, then
   *  rename the old file so it's not loaded again.
   *  TODO: Remove this method once all deployments have migrated (no registry.json files remain). */
  private migrateFromRegistryJson(): void {
    const legacyPath = join(this.persistDir, "registry.json");
    if (!existsSync(legacyPath)) return;
    try {
      const raw = readFileSync(legacyPath, "utf-8");
      const legacy = JSON.parse(raw) as Registry;
      let migrated = 0;
      for (const [sid, meta] of Object.entries(legacy.sessions ?? {})) {
        // Only write if no meta.json exists yet (active or archived)
        if (!readSessionMeta(this.persistDir, sid)) {
          writeSessionMeta(this.persistDir, sid, meta);
          migrated++;
        }
      }
      // Rename legacy file so migration doesn't run again
      const backupPath = legacyPath + ".migrated";
      renameSync(legacyPath, backupPath);
      if (migrated > 0) {
        console.log(`[registry] Migrated ${migrated} sessions from registry.json to per-session meta.json`);
      }
    } catch (err) {
      console.warn(`[registry] Failed to migrate registry.json: ${err}`);
    }
  }

  /** Store an agent config (in-memory only — not persisted to disk). */
  saveAgent(def: SubagentDefinition): void {
    this.agents[def.name] = toPersistedConfig(def);
  }

  /** Record a new session (writes meta.json to the session dir). */
  saveSession(sessionId: string, entry: PersistedSession): void {
    writeSessionMeta(this.persistDir, sessionId, entry);
  }

  /** Update session status (running/done/error/interrupted/idle).
   *  Reads the current meta.json, updates in place, writes back. */
  updateSessionStatus(sessionId: string, status: "running" | "done" | "error" | "interrupted" | "idle", error?: string): void {
    const session = readSessionMeta(this.persistDir, sessionId);
    if (!session) return;
    session.status = status;
    if (status === "running" || status === "idle") {
      delete session.endedAt;
      delete session.error;
    } else {
      session.endedAt = Date.now();
      if (error) session.error = error;
    }
    writeSessionMeta(this.persistDir, sessionId, session);
  }

  /** Get the current registry data (scans session dirs on each call).
   *  Agent configs come from in-memory registrations.
   *  Session metadata comes from individual meta.json files. */
  getRegistry(): Registry {
    return {
      agents: { ...this.agents },
      sessions: loadAllSessionMetas(this.persistDir),
    };
  }

  /** Get a single session's metadata without scanning all sessions. */
  getSession(sessionId: string): PersistedSession | null {
    return readSessionMeta(this.persistDir, sessionId);
  }

  /** Get the persist directory path. */
  getFilePath(): string {
    return this.persistDir;
  }
}

// ── Workflow Run persistence ───────────────────────────────────────────

/** A single step in a workflow execution. */
export interface WorkflowStep {
  sessionId: string;
  agent: string;
  task: string;
  status: "done" | "error";
  startedAt: number;
  endedAt: number;
  lastAssistantText: string | null;
}

/** Persisted record of a workflow execution — the session graph node for workflows. */
export interface WorkflowRun {
  runId: string;
  workflow: string;
  task: string;
  /** The caller session that triggered workflow.run() (e.g. May's session). */
  parentSessionId: string;
  /** If this is a sub-workflow, which workflow run spawned it. */
  parentWorkflowRunId?: string;
  /** Nesting depth: 1 = top-level workflow, 2 = sub-workflow, etc. */
  depth: number;
  startedAt: number;
  endedAt?: number;
  status: "running" | "done" | "escalated" | "interrupted" | "error";
  steps: WorkflowStep[];
  /** If this run was resumed from a previous crashed run, its runId. */
  resumedFromRunId?: string;
  result?: {
    summary?: string;
    reason?: string;
  };
}

/** Directory where workflow runs are persisted. */
export function workflowRunDir(persistDir: string): string {
  return join(persistDir, "workflows");
}

/** Path to a specific workflow run file. */
export function workflowRunPath(persistDir: string, runId: string): string {
  return join(workflowRunDir(persistDir), `${runId}.json`);
}

/** Save a workflow run to disk (atomic write). */
export function saveWorkflowRun(persistDir: string, run: WorkflowRun): void {
  const dir = workflowRunDir(persistDir);
  mkdirSync(dir, { recursive: true });
  const filePath = workflowRunPath(persistDir, run.runId);
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(run, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

/** Read a workflow run from disk. Returns null if not found. */
export function readWorkflowRun(persistDir: string, runId: string): WorkflowRun | null {
  const filePath = workflowRunPath(persistDir, runId);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as WorkflowRun;
  } catch {
    return null;
  }
}

/** Read messages from the archived (history) session JSONL. Returns [] if not found. */
export function readArchivedSessionMessages(persistDir: string, sessionId: string): AgentMessage[] {
  return readJsonlFile<AgentMessage>(join(historyDir(persistDir), sessionId, "session.jsonl"));
}

/** List all workflow run IDs, sorted by filename (which includes timestamp). */
export function listWorkflowRuns(persistDir: string): string[] {
  const dir = workflowRunDir(persistDir);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}
