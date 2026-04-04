/**
 * Knowledge Router — task-aware knowledge injection.
 *
 * Matches task descriptions against a keyword index of verified knowledge
 * entries and returns relevant one-liner pointers for prompt injection.
 *
 * Design: H-043 predicts that raising P(access) — the probability that
 * relevant knowledge reaches the agent at decision time — doubles the
 * effective learning rate. This module is the simplest implementation:
 * keyword matching against a pre-built index, injecting 2-5 one-liners
 * into the session context.
 *
 * NOT a RAG system. NOT an embedding search. Just keyword matching
 * against 19 entries. Keep it simple per Bob's proposal item #3.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** A single knowledge entry in the index */
export interface KnowledgeEntry {
  id: string;
  file: string;
  oneliner: string;
  keywords: string[];
  /** Agent names this is relevant to, or ["*"] for all agents */
  agents: string[];
}

/** A matched entry with its relevance score */
export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  score: number;
  matchedKeywords: string[];
}

/** The knowledge index structure on disk */
interface KnowledgeIndex {
  _meta: Record<string, string>;
  entries: KnowledgeEntry[];
}

// ── Index loading ──────────────────────────────────────────────

let _cachedIndex: KnowledgeEntry[] | null = null;
let _cachedIndexPath: string | null = null;

/**
 * Load the knowledge index from disk. Caches after first load.
 * Falls back to empty array if file doesn't exist or is malformed.
 */
export function loadKnowledgeIndex(projectRoot: string): KnowledgeEntry[] {
  const indexPath = join(projectRoot, "agents", "shared", "knowledge", "knowledge-index.json");

  // Return cached if same path
  if (_cachedIndex && _cachedIndexPath === indexPath) return _cachedIndex;

  if (!existsSync(indexPath)) {
    _cachedIndex = [];
    _cachedIndexPath = indexPath;
    return _cachedIndex;
  }

  try {
    const raw = readFileSync(indexPath, "utf-8");
    const parsed: KnowledgeIndex = JSON.parse(raw);
    _cachedIndex = parsed.entries ?? [];
    _cachedIndexPath = indexPath;
    return _cachedIndex;
  } catch {
    // Malformed JSON — don't crash, just return empty
    _cachedIndex = [];
    _cachedIndexPath = indexPath;
    return _cachedIndex;
  }
}

/** Clear the cached index (for testing) */
export function clearKnowledgeIndexCache(): void {
  _cachedIndex = null;
  _cachedIndexPath = null;
}

// ── Matching ───────────────────────────────────────────────────

/**
 * Normalize text for keyword matching: lowercase, collapse whitespace.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s_-]+/g, " ");
}

/**
 * Match a task description against the knowledge index.
 *
 * Algorithm:
 * 1. Normalize task text to lowercase
 * 2. For each entry, check if any keywords appear in the task text
 * 3. Score = number of matching keywords (simple tf)
 * 4. Filter by agent relevance (entry.agents includes agent name or "*")
 * 5. Return top N matches sorted by score descending
 *
 * @param taskText - The task description / heartbeat message
 * @param agentName - The agent this is for (filters agent-specific entries)
 * @param entries - The knowledge index entries
 * @param maxResults - Maximum results to return (default: 3)
 */
export function matchKnowledge(
  taskText: string,
  agentName: string,
  entries: KnowledgeEntry[],
  maxResults: number = 3,
): KnowledgeMatch[] {
  if (!taskText || entries.length === 0) return [];

  const normalizedTask = normalize(taskText);
  const matches: KnowledgeMatch[] = [];

  for (const entry of entries) {
    // Agent filter: skip if entry specifies agents and this agent isn't listed
    if (!entry.agents.includes("*") && !entry.agents.includes(agentName)) {
      continue;
    }

    const matchedKeywords: string[] = [];
    for (const kw of entry.keywords) {
      const normalizedKw = normalize(kw);
      if (normalizedTask.includes(normalizedKw)) {
        matchedKeywords.push(kw);
      }
    }

    if (matchedKeywords.length > 0) {
      matches.push({
        entry,
        score: matchedKeywords.length,
        matchedKeywords,
      });
    }
  }

  // Sort by score descending, then by entry ID for stability
  matches.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));

  return matches.slice(0, maxResults);
}

// ── Formatting ─────────────────────────────────────────────────

/**
 * Format matched knowledge entries into a prompt injection block.
 * Returns empty string if no matches.
 *
 * Output format (per Optimizer's request — one-liners, not summaries):
 * ```
 * ## Relevant Knowledge
 * - KE-002: Text rules have 0% success for judgment failures (→ entries/KE-002.md)
 * - KE-007: Workflow enforcement is the only reliable intervention (→ entries/KE-007.md)
 * ```
 */
export function formatKnowledgeInjection(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) return "";

  const lines = ["## Relevant Knowledge (auto-matched from task)"];
  for (const m of matches) {
    lines.push(`- **${m.entry.id}**: ${m.entry.oneliner} (→ knowledge/${m.entry.file})`);
  }
  return lines.join("\n");
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Run the full knowledge routing pipeline:
 * 1. Load index from disk (cached)
 * 2. Match task text against entries
 * 3. Format for prompt injection
 *
 * @returns A formatted string to inject into session context, or empty string
 */
export function routeKnowledge(
  projectRoot: string,
  taskText: string,
  agentName: string,
  maxResults: number = 3,
): string {
  const entries = loadKnowledgeIndex(projectRoot);
  const matches = matchKnowledge(taskText, agentName, entries, maxResults);
  return formatKnowledgeInjection(matches);
}
