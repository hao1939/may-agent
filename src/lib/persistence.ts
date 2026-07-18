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
import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SubagentDefinition } from "./types.js";
import type { TSchema } from "@earendil-works/pi-ai";
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
  compaction?: boolean;
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
  /** Project ID linking this session to a persisted project. */
  projectId?: string;
  detached?: boolean;
  pid?: number;
  instance?: string;
  /** Session kind. Defaults to "job" for backward compat with old meta.json files. */
  kind?: SessionKind;
  /** Session lifecycle policy. "never" = stays idle on completion, "immediate" = becomes terminal. */
  autoClose?: "immediate" | "never";
  /** Number of state-changing tool calls executed so far (persisted for crash recovery). */
  opCount?: number;
  /** Order ID linking this session to a persisted human order (P209). */
  orderId?: string;
  /** Workflow calls require the structured finish() terminal contract. */
  requireFinish?: boolean;
  /** Serializable TypeBox/JSON schema for finish().result. */
  outputSchema?: TSchema;
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
  if (def.compaction !== undefined) config.compaction = def.compaction;
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

// ── Transcript secret redaction ─────────────────────────────────────────
// These patterns match secrets that leak into session transcripts via tool
// output (e.g. `az account get-access-token`). They are applied at the
// persistence boundary so raw secrets never reach disk.

const TRANSCRIPT_SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Azure / OAuth JWT tokens (base64-encoded JSON starting with {"typ":"JWT"…})
  { pattern: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED-JWT]" },
  // GitHub Personal Access Tokens (classic: ghp_, fine-grained: github_pat_)
  // and GitHub App tokens (gho_, ghu_, ghs_, ghr_)
  // These appear standalone in CLI output, env vars, and resolveGitHubClient() results.
  { pattern: /ghp_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED-GITHUB-PAT]" },
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/g, replacement: "[REDACTED-GITHUB-PAT]" },
  { pattern: /gho_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED-GITHUB-TOKEN]" },
  { pattern: /ghu_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED-GITHUB-TOKEN]" },
  { pattern: /ghs_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED-GITHUB-TOKEN]" },
  { pattern: /ghr_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED-GITHUB-TOKEN]" },
  // Generic bearer tokens in Authorization headers
  { pattern: /(Bearer\s+)[A-Za-z0-9_\-.~+/]{40,}/gi, replacement: "$1[REDACTED-BEARER-TOKEN]" },
  // Azure access tokens as standalone base64 blobs (accessToken: "…")
  {
    pattern: /(accessToken["']?\s*[:=]\s*["']?)([A-Za-z0-9_\-.~+/]{40,})(["']?)/g,
    replacement: "$1[REDACTED-ACCESS-TOKEN]$3",
  },
  // Authenticated Git/GitHub URLs with embedded tokens (https://<token>@github.com/...)
  {
    pattern: /https:\/\/[A-Za-z0-9_\-.~+/]{8,}@github\.com\/[^\s"'\\]*/g,
    replacement: "https://[REDACTED-GIT-TOKEN]@github.com/[REDACTED-REPO]",
  },
  // Generic long secrets in key=value contexts (password, secret, token, key assignments)
  {
    pattern: /((?:password|secret|token|api[_-]?key)\s*[=:]\s*["']?)([^\s"']{20,})(["']?)/gi,
    replacement: "$1[REDACTED]$3",
  },
];

/**
 * Redact known secret patterns from a string.
 * Used on transcript message content before persistence.
 */
export function redactTranscriptSecrets(text: string): string {
  let result = text;
  for (const { pattern, replacement } of TRANSCRIPT_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Recursively walk every string value in an object/array and apply a
 * transform function. Mutates in place for efficiency (caller provides clone).
 */
function deepRedactStrings(obj: unknown): unknown {
  if (typeof obj === "string") {
    return redactTranscriptSecrets(obj);
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = deepRedactStrings(obj[i]);
    }
    return obj;
  }
  if (obj !== null && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      (obj as any)[key] = deepRedactStrings((obj as any)[key]);
    }
    return obj;
  }
  return obj;
}

/**
 * Deep-clone an AgentMessage and redact secrets from ALL nested string values
 * including tool-call arguments, nested payloads, and any other string field.
 * The original message is never mutated.
 */
function sanitizeMessageForTranscript(message: AgentMessage): AgentMessage {
  // Fast path: if JSON serialization has no secret indicators, skip deep scan.
  // Must check for ALL indicators that any TRANSCRIPT_SECRET_PATTERNS entry
  // could match, including JSON-escaped forms (e.g. `token":"` where `"` sits
  // between keyword and `:`).
  const serialized = JSON.stringify(message);
  if (
    !serialized.includes("eyJ") &&
    !/bearer/i.test(serialized) &&
    !serialized.includes("accessToken") &&
    !serialized.includes("@github.com/") &&
    !serialized.includes("ghp_") &&
    !serialized.includes("github_pat_") &&
    !serialized.includes("gho_") &&
    !serialized.includes("ghu_") &&
    !serialized.includes("ghs_") &&
    !serialized.includes("ghr_") &&
    !/(?:password|secret|token|api[_-]?key)["']?\s*[=:]/i.test(serialized)
  ) {
    return message;
  }

  // Deep clone then recursively redact every string value
  const clone = JSON.parse(serialized) as AgentMessage;
  deepRedactStrings(clone);
  return clone;
}

/** Append a single message as a JSON line to the session's JSONL file.
 *  Secrets (JWTs, bearer tokens, access tokens) are redacted before writing. */
export function appendSessionMessage(persistDir: string, sessionId: string, message: AgentMessage): void {
  const sanitized = sanitizeMessageForTranscript(message);
  const line = JSON.stringify(sanitized) + "\n";
  appendFileSync(sessionJsonlPath(persistDir, sessionId), line, "utf-8");
}

/**
 * Rewrite a session transcript after runtime recovery removes an invalid turn.
 * Normal transcript writes are append-only; this helper is only for repairing
 * messages that should not become durable conversation context, such as an
 * empty terminal assistant message that is immediately retried.
 */
export function rewriteSessionMessages(persistDir: string, sessionId: string, messages: AgentMessage[]): void {
  ensureSessionDir(persistDir, sessionId);
  const filePath = sessionJsonlPath(persistDir, sessionId);
  const tmpPath = filePath + ".tmp";
  const lines = messages.map((message) => JSON.stringify(sanitizeMessageForTranscript(message))).join("\n");
  writeFileSync(tmpPath, lines ? `${lines}\n` : "", "utf-8");
  renameSync(tmpPath, filePath);
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

// ── Session meta.json helpers ─────────────────────────────────────────

/** Path to a session's meta.json. Session paths never change with lifecycle state. */
export function sessionMetaPath(persistDir: string, sessionId: string): string {
  return join(sessionDir(persistDir, sessionId), "meta.json");
}

/** Read a session's meta.json. Returns null if not found or corrupted. */
export function readSessionMeta(persistDir: string, sessionId: string): PersistedSession | null {
  try {
    return JSON.parse(readFileSync(sessionMetaPath(persistDir, sessionId), "utf-8")) as PersistedSession;
  } catch {
    return null;
  }
}

/** Write a session's meta.json atomically. Creates the session dir if needed. */
export function writeSessionMeta(persistDir: string, sessionId: string, meta: PersistedSession): void {
  ensureSessionDir(persistDir, sessionId);
  const filePath = sessionMetaPath(persistDir, sessionId);
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(meta, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

const ACTIVE_MARKER = "[ACTIVE]";
const STARTED_MARKER = "[STARTED]";

function isPermissionError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    ((err as NodeJS.ErrnoException).code === "EACCES" ||
      (err as NodeJS.ErrnoException).code === "EPERM")
  );
}

/** Mark a session as runtime-active without changing its permanent directory. */
export function markSessionActive(persistDir: string, sessionId: string): void {
  ensureSessionDir(persistDir, sessionId);
  const markerPath = join(sessionDir(persistDir, sessionId), ACTIVE_MARKER);
  const content = new Date().toISOString();
  try {
    writeFileSync(markerPath, content, "utf-8");
  } catch (err) {
    if (!isPermissionError(err)) throw err;
    // Crash recovery can inherit a stale marker file whose ownership or mode
    // drifted away from the runtime user. Because the session directory itself
    // remains ours, unlink the old marker and recreate it instead of failing
    // the whole resume path on an in-place truncate/open.
    try {
      rmSync(markerPath, { force: true });
    } catch {
      // rmSync may also fail if there's a transient lock or permission issue;
      // fall through to the atomic-rename strategy below.
    }
    try {
      writeFileSync(markerPath, content, "utf-8");
    } catch (err2) {
      if (!isPermissionError(err2)) throw err2;
      // Last resort: write via temp file + rename (works even if original
      // inode is locked, as rename replaces the directory entry).
      const tmpPath = markerPath + ".tmp." + process.pid;
      writeFileSync(tmpPath, content, "utf-8");
      renameSync(tmpPath, markerPath);
    }
  }
}

/** Mark a session terminal. Artifacts remain in their original directory. */
export function markSessionInactive(persistDir: string, sessionId: string): void {
  for (const marker of [ACTIVE_MARKER, STARTED_MARKER]) {
    try {
      rmSync(join(sessionDir(persistDir, sessionId), marker), { force: true });
    } catch {
      /* best effort */
    }
  }
}

/** List every durable session record. */
export function listSessionIds(persistDir: string): string[] {
  const sessionsRoot = join(persistDir, "sessions");
  if (!existsSync(sessionsRoot)) return [];
  try {
    return readdirSync(sessionsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** List runtime-active sessions using tiny marker files, without reading all historical metadata. */
export function listActiveSessionIds(persistDir: string): string[] {
  return listSessionIds(persistDir).filter((sessionId) => {
    const dir = sessionDir(persistDir, sessionId);
    return existsSync(join(dir, ACTIVE_MARKER)) || existsSync(join(dir, STARTED_MARKER));
  });
}

/** Scan all session meta.json files and return a map.
 *  Reads session metadata from per-session meta.json files in the persist directory.
 *  @returns Record mapping session IDs to their persisted metadata. */
export function loadAllSessionMetas(persistDir: string): Record<string, PersistedSession> {
  const result: Record<string, PersistedSession> = {};
  for (const sid of listSessionIds(persistDir)) {
    const meta = readSessionMeta(persistDir, sid);
    if (meta) result[sid] = meta;
  }
  return result;
}

/** Read only marker-selected active metadata for bounded startup recovery. */
export function loadActiveSessionMetas(persistDir: string): Record<string, PersistedSession> {
  const result: Record<string, PersistedSession> = {};
  for (const sid of listActiveSessionIds(persistDir)) {
    const meta = readSessionMeta(persistDir, sid);
    if (meta) result[sid] = meta;
  }
  return result;
}

// ── Async variants (non-blocking I/O for large state directories) ────

/** Async version of readSessionMeta. Uses fs/promises for non-blocking I/O. */
export async function readSessionMetaAsync(persistDir: string, sessionId: string): Promise<PersistedSession | null> {
  try {
    const data = await readFile(sessionMetaPath(persistDir, sessionId), "utf-8");
    return JSON.parse(data) as PersistedSession;
  } catch {
    return null;
  }
}

/** Async version of listSessionIds. */
export async function listSessionIdsAsync(persistDir: string): Promise<string[]> {
  const sessionsRoot = join(persistDir, "sessions");
  try {
    const entries = await readdir(sessionsRoot, { withFileTypes: true });
    return entries.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

/** Async version of loadAllSessionMetas. Uses non-blocking I/O for large state directories.
 *  Reads session metadata from per-session meta.json files without blocking the event loop. */
export async function loadAllSessionMetasAsync(persistDir: string): Promise<Record<string, PersistedSession>> {
  const result: Record<string, PersistedSession> = {};
  const sessionIds = await listSessionIdsAsync(persistDir);
  const metas = await Promise.all(
    sessionIds.map((sid) => readSessionMetaAsync(persistDir, sid).then((meta) => [sid, meta] as const)),
  );
  for (const [sid, meta] of metas) {
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
