/**
 * master-worker-cached — A caching integration layer that wraps master-worker.ts
 * file operations with ProjectCache to eliminate redundant filesystem reads.
 *
 * In a typical master-worker iteration, project.md is read 5-8 times and
 * journal.md 2-3 times. This module provides cached versions of the key
 * read/write patterns used in the workflow loop.
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { ProjectCache, type CacheStats } from "./project-cache.ts";

// ── Types ───────────────────────────────────────────────────────────────

export interface CachedProjectContext {
  projectDir: string;
  projectFile: string;
  journalFile: string;
  discussionFile: string;
  cache: ProjectCache;
}

export interface IterationSnapshot {
  projectContent: string;
  journalTail: string;
  discussionContent: string | null;
  iteration: number;
  maxIterations: number;
  status: string;
  goal: string;
}

// ── Factory ─────────────────────────────────────────────────────────────

/**
 * Create a cached project context for a master-worker run.
 * The cache persists across iterations within a single run.
 */
export function createCachedContext(projectDir: string, ttlMs = 30000): CachedProjectContext {
  return {
    projectDir,
    projectFile: join(projectDir, "project.md"),
    journalFile: join(projectDir, "journal.md"),
    discussionFile: join(projectDir, "discussion.md"),
    cache: new ProjectCache(50, ttlMs),
  };
}

// ── Cached reads ────────────────────────────────────────────────────────

/**
 * Read project.md with caching. Returns null if file doesn't exist.
 */
export function readProjectFile(ctx: CachedProjectContext): string | null {
  try {
    return ctx.cache.read(ctx.projectFile);
  } catch (err) {
    console.error(`[master-worker-cached] Failed to read project file ${ctx.projectFile}: ${err}`);
    return null;
  }
}

/**
 * Read journal.md with caching. Returns empty string if file doesn't exist.
 */
export function readJournalFile(ctx: CachedProjectContext): string {
  try {
    return ctx.cache.read(ctx.journalFile) ?? "";
  } catch (err) {
    console.error(`[master-worker-cached] Failed to read journal file ${ctx.journalFile}: ${err}`);
    return "";
  }
}

/**
 * Read discussion.md with caching. Returns null if file doesn't exist.
 */
export function readDiscussionFile(ctx: CachedProjectContext): string | null {
  try {
    if (!ctx.cache.exists(ctx.discussionFile)) return null;
    return ctx.cache.read(ctx.discussionFile);
  } catch (err) {
    console.error(`[master-worker-cached] Failed to read discussion file ${ctx.discussionFile}: ${err}`);
    return null;
  }
}

/**
 * Get the last N characters of the journal (for context windows).
 */
export function getJournalTail(ctx: CachedProjectContext, maxChars = 3000): string {
  const journal = readJournalFile(ctx);
  if (journal.length <= maxChars) return journal;
  return journal.slice(-maxChars);
}

// ── Cached writes ───────────────────────────────────────────────────────

/**
 * Write project.md and update cache.
 */
export function writeProjectFile(ctx: CachedProjectContext, content: string): void {
  ctx.cache.write(ctx.projectFile, content);
}

/**
 * Append to journal.md and invalidate cache (since append changes content).
 */
export function appendJournalEntry(ctx: CachedProjectContext, entry: string): void {
  try {
    appendFileSync(ctx.journalFile, entry, "utf-8");
    ctx.cache.invalidate(ctx.journalFile);
  } catch (err) {
    console.error(`[master-worker-cached] Failed to append to journal ${ctx.journalFile}: ${err}`);
  }
}

// ── Snapshot for orchestrator prompt ────────────────────────────────────

/**
 * Extract field value from project.md content using regex.
 */
export function extractField(content: string, field: string): string {
  const pattern = new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Extract a markdown section's content.
 */
export function extractSection(content: string, heading: string): string {
  const pattern = new RegExp(`^## ${heading}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$)`, "m");
  const match = content.match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Build a complete iteration snapshot from cached data.
 * This replaces 5-8 individual readFileSync calls with 2-3 cached reads.
 */
export function buildIterationSnapshot(ctx: CachedProjectContext, iteration: number): IterationSnapshot | null {
  const projectContent = readProjectFile(ctx);
  if (!projectContent) return null;

  const journalTail = getJournalTail(ctx);
  const discussionContent = readDiscussionFile(ctx);

  const maxIterStr = extractField(projectContent, "Max Iterations");
  const maxIterations = maxIterStr ? parseInt(maxIterStr, 10) || 50 : 50;
  const status = extractField(projectContent, "Status") || "active";
  const goal = extractSection(projectContent, "Goal") || extractField(projectContent, "Goal") || "See project.md";

  return {
    projectContent,
    journalTail,
    discussionContent,
    iteration,
    maxIterations,
    status,
    goal,
  };
}

/**
 * Check if the workflow should stop based on snapshot state.
 */
export function shouldStop(snapshot: IterationSnapshot): { stop: boolean; reason: string } {
  if (snapshot.iteration > snapshot.maxIterations) {
    return { stop: true, reason: `Reached max iterations (${snapshot.maxIterations})` };
  }
  if (["done", "cancelled", "paused"].includes(snapshot.status.toLowerCase())) {
    return { stop: true, reason: `Project status is ${snapshot.status}` };
  }
  return { stop: false, reason: "" };
}

/**
 * Format the orchestrator context prompt from a snapshot.
 * Replaces the inline string building in master-worker.ts that reads files multiple times.
 */
export function formatOrchestratorContext(snapshot: IterationSnapshot): string {
  const parts: string[] = [
    `## Iteration ${snapshot.iteration}/${snapshot.maxIterations}`,
    "",
    `**Goal**: ${snapshot.goal}`,
    `Status: ${snapshot.status}`,
    "",
    "## project.md",
    snapshot.projectContent,
    "",
    `## journal.md (last 3000 chars)`,
    snapshot.journalTail,
  ];

  if (snapshot.discussionContent) {
    parts.push("", "## discussion.md", snapshot.discussionContent);
  }

  return parts.join("\n");
}

/**
 * Get cache performance stats for logging/debugging.
 */
export function getCacheReport(ctx: CachedProjectContext): string {
  const stats = ctx.cache.getStats();
  const total = stats.totalHits + stats.totalMisses;
  return `Cache: ${stats.entries} entries, ${stats.totalHits}/${total} hits (${(stats.hitRate * 100).toFixed(0)}%), ${stats.totalWrites} writes`;
}

/**
 * Flush cache between iterations if needed (e.g., worker may have modified files).
 */
export function flushBetweenIterations(ctx: CachedProjectContext): void {
  // Invalidate project and journal (worker may have changed things)
  // but keep discussion cached (rarely changes mid-run)
  ctx.cache.invalidate(ctx.projectFile);
  ctx.cache.invalidate(ctx.journalFile);
}
