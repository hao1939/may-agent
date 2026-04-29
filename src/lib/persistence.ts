import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SubagentDefinition } from "./types.js";
// DB writes removed from RegistryStore — handled by DbWriter subscriber via EventBus.
import { log } from "./log.js";

/** Serializable agent config (no tools, no apiKey, no full model object). */
export interface PersistedAgentConfig {
  name: string;
  description: string;
  domain: string;
  systemPrompt?: string;
  workspace?: string;
  model: { provider: string; id: string };
  timeoutMs?: number;
  memoryLimit?: number;
}

/** Session kind: chat (human-owned), job (fire-and-forget, auto-resumed), call (parent-owned). */
export type SessionKind = "chat" | "job" | "call";

/** Serializable session record stored as meta.json per session directory. */
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
  /** Source tag indicating how this session was created (e.g. "callAgent", "workflow", "fork"). */
  source?: string;
  /** Request ID linking this session to the unified request tracker. */
  requestId?: string;
  detached?: boolean;
  pid?: number;
  instance?: string;
  /** Session kind. Defaults to "job" for backward compat with old meta.json files. */
  kind?: SessionKind;
  /** Session lifecycle policy. "never" = stays idle on completion, "immediate" = archives on completion. */
  autoClose?: "immediate" | "never";
  /** Number of state-changing tool calls executed so far (persisted for crash recovery). */
  opCount?: number;
  /** Order ID linking this session to a persisted human order (P209). */
  orderId?: string;
}

/** Shape of the registry data (in-memory view).
 *  Agents are only held in-memory (re-registered on every startup).
 *  Sessions are persisted as individual meta.json files per session dir. */
export interface Registry {
  agents: Record<string, PersistedAgentConfig>;
  sessions: Record<string, PersistedSession>;
}

/** Extract persistable fields from a SubagentDefinition. */
function toPersistedConfig(def: SubagentDefinition): PersistedAgentConfig {
  const config: PersistedAgentConfig = {
    name: def.name,
    description: def.description,
    domain: def.domain,
    model: { provider: (def.model as any).provider ?? "unknown", id: def.model.id },
  };
  if (def.systemPrompt !== undefined) config.systemPrompt = def.systemPrompt;
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
      log("warn", `[persistence:jsonl] Skipping corrupted JSONL line in ${filePath}`);
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

/**
 * Find the session JSONL file, checking active directory first then history archive.
 * Returns the path if found, null otherwise.
 * Use this when reading transcripts for sessions that may have been archived.
 */
export function findSessionJsonl(persistDir: string, sessionId: string): string | null {
  const activePath = join(sessionDir(persistDir, sessionId), "session.jsonl");
  if (existsSync(activePath)) return activePath;
  const archivedPath = join(historyDir(persistDir), sessionId, "session.jsonl");
  if (existsSync(archivedPath)) return archivedPath;
  return null;
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
export function listActiveSessionIds(persistDir: string): string[] {
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
export function listArchivedSessionIds(persistDir: string): string[] {
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
 *  Reads session metadata from per-session meta.json files in the persist directory.
 *  @returns Record mapping session IDs to their persisted metadata. */
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

// ── Async variants (non-blocking I/O for large state directories) ────

/** Async version of readSessionMeta. Uses fs/promises for non-blocking I/O. */
export async function readSessionMetaAsync(persistDir: string, sessionId: string): Promise<PersistedSession | null> {
  const activePath = sessionMetaPath(persistDir, sessionId);
  try {
    const data = await readFile(activePath, "utf-8");
    return JSON.parse(data) as PersistedSession;
  } catch {
    // Not in active dir — try history archive
  }
  const archivePath = archivedSessionMetaPath(persistDir, sessionId);
  try {
    const data = await readFile(archivePath, "utf-8");
    return JSON.parse(data) as PersistedSession;
  } catch {
    return null;
  }
}

/** Async version of listActiveSessionIds. */
export async function listActiveSessionIdsAsync(persistDir: string): Promise<string[]> {
  const sessionsRoot = join(persistDir, "sessions");
  try {
    const entries = await readdir(sessionsRoot, { withFileTypes: true });
    return entries.filter((d) => d.isDirectory() && d.name !== "history").map((d) => d.name);
  } catch {
    return [];
  }
}

/** Async version of listArchivedSessionIds. */
export async function listArchivedSessionIdsAsync(persistDir: string): Promise<string[]> {
  const histDir = historyDir(persistDir);
  try {
    const entries = await readdir(histDir, { withFileTypes: true });
    return entries.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

/** Async version of loadAllSessionMetas. Uses non-blocking I/O for large state directories.
 *  Reads session metadata from per-session meta.json files without blocking the event loop. */
export async function loadAllSessionMetasAsync(persistDir: string): Promise<Record<string, PersistedSession>> {
  const result: Record<string, PersistedSession> = {};
  // Active sessions
  const activeIds = await listActiveSessionIdsAsync(persistDir);
  const activeMetas = await Promise.all(
    activeIds.map((sid) => readSessionMetaAsync(persistDir, sid).then((meta) => [sid, meta] as const)),
  );
  for (const [sid, meta] of activeMetas) {
    if (meta) result[sid] = meta;
  }
  // Archived sessions (don't overwrite active — active takes precedence)
  const archivedIds = await listArchivedSessionIdsAsync(persistDir);
  const archivedMetas = await Promise.all(
    archivedIds.map((sid) => readSessionMetaAsync(persistDir, sid).then((meta) => [sid, meta] as const)),
  );
  for (const [sid, meta] of archivedMetas) {
    if (result[sid]) continue;
    if (meta) result[sid] = meta;
  }
  return result;
}

// ── SessionStore interface ─────────────────────────────────────────────

/** Abstraction over session metadata persistence.
 *  RegistryStore is the default (meta.json + SQLite).
 *  Tests/gym can provide alternatives (in-memory, spy, etc.). */
export interface SessionStore {
  readonly persistDir: string;
  saveSession(sessionId: string, entry: PersistedSession): void;
  updateSessionStatus(
    sessionId: string,
    status: "running" | "done" | "error" | "interrupted" | "idle",
    error?: string,
  ): void;
  getSession(sessionId: string): PersistedSession | null;
  getRegistry(): Registry;
}

// ── RegistryStore ──────────────────────────────────────────────────────
//
// Default SessionStore: meta.json (source of truth) + SQLite (queryable index).
// Agent configs: in-memory only (re-registered on every startup).

export class RegistryStore implements SessionStore {
  private agents: Record<string, PersistedAgentConfig> = {};
  readonly persistDir: string;

  constructor(persistDir: string) {
    this.persistDir = persistDir;
    mkdirSync(persistDir, { recursive: true });
  }

  /** Store an agent config (in-memory only — not persisted to disk). */
  saveAgent(def: SubagentDefinition): void {
    this.agents[def.name] = toPersistedConfig(def);
  }

  /** Remove an agent config from memory. */
  removeAgent(name: string): void {
    delete this.agents[name];
  }

  /** Record a new session (writes meta.json). DB persistence handled by DbWriter subscriber. */
  saveSession(sessionId: string, entry: PersistedSession): void {
    writeSessionMeta(this.persistDir, sessionId, entry);
  }

  /** Update session status (writes meta.json). DB persistence handled by DbWriter subscriber. */
  updateSessionStatus(
    sessionId: string,
    status: "running" | "done" | "error" | "interrupted" | "idle",
    error?: string,
  ): void {
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

  /** Get the current registry data (scans session dirs on each call). */
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

/** Read messages from the archived (history) session JSONL. Returns [] if not found. */
export function readArchivedSessionMessages(persistDir: string, sessionId: string): AgentMessage[] {
  return readJsonlFile<AgentMessage>(join(historyDir(persistDir), sessionId, "session.jsonl"));
}

// ── Rolling Compaction: compacted state snapshot ─────────────────────────

/** Path to the compacted message snapshot for a session. */
export function sessionCompactPath(persistDir: string, sessionId: string): string {
  return join(sessionDir(persistDir, sessionId), "session-compact.jsonl");
}

/**
 * Save compacted messages to session-compact.jsonl (overwrites previous snapshot).
 * The full session.jsonl is never modified — it remains the append-only source of truth.
 * Write is atomic: data goes to a .tmp file first, then renamed into place.
 */
export function saveCompactedMessages(persistDir: string, sessionId: string, messages: AgentMessage[]): void {
  const filePath = sessionCompactPath(persistDir, sessionId);
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, messages.map((m) => JSON.stringify(m)).join("\n") + "\n");
  renameSync(tmpPath, filePath);
}

/**
 * Read compacted messages from session-compact.jsonl.
 * Returns null if no compacted snapshot exists or the file is corrupt (fall back to full JSONL).
 */
export function readCompactedMessages(persistDir: string, sessionId: string): AgentMessage[] | null {
  const filePath = sessionCompactPath(persistDir, sessionId);
  if (!existsSync(filePath)) return null;
  try {
    const messages = readJsonlFile<AgentMessage>(filePath);
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}
