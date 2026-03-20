/**
 * Reflect System — agent-owned cron handler.
 *
 * Reads recent entries from .state/memory-stream.jsonl, extracts lessons
 * (fix / pattern / insight), deduplicates against existing entries in
 * agents/shared/knowledge/strategies.md, and appends new strategies.
 *
 * Pure JS — no LLM needed. Writes report to workspace/reflect-report.md.
 *
 * Exports create() conforming to HandlerModule.
 */

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Config ────────────────────────────────────────────────────────────

/** How many lines from the tail of memory-stream.jsonl to read. */
const TAIL_LINES = 50;

/** Keywords that flag a line as containing a lesson (case-insensitive). */
const LESSON_KEYWORDS = [
  "lesson",
  "learned",
  "mistake",
  "fix",
  "pattern",
  "insight",
];

/** Categories in memory-stream entries that qualify as lessons. */
const LESSON_CATEGORIES = new Set(["fix", "pattern", "insight"]);

/** Minimum similarity ratio (0–1) to consider two strings a match. */
const DEDUP_THRESHOLD = 0.6;

// ── Types ─────────────────────────────────────────────────────────────

interface MemoryEntry {
  timestamp?: string;
  agent?: string;
  category?: string;
  content?: string;
  type?: string;
  [key: string]: unknown;
}

interface ExtractedLesson {
  category: string;
  content: string;
  agent: string;
  timestamp: string;
}

interface ReflectResult {
  timestamp: string;
  entriesScanned: number;
  lessonsExtracted: number;
  lessonsNew: number;
  lessonsDuplicate: number;
  newLessons: ExtractedLesson[];
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const strategiesPath = join(ctx.agentsRoot, "shared", "knowledge", "strategies.md");
  const memoryStreamPath = join(process.cwd(), ".state", "memory-stream.jsonl");
  const reportPath = join(ctx.agentsRoot, ctx.agentName, "workspace", "reflect-report.md");

  return async () => {
    const result = runReflect(memoryStreamPath, strategiesPath);

    // Append new strategies to strategies.md
    if (result.newLessons.length > 0) {
      // Ensure parent directory and file exist before appending
      const strategiesDir = dirname(strategiesPath);
      mkdirSync(strategiesDir, { recursive: true });
      if (!existsSync(strategiesPath)) {
        writeFileSync(strategiesPath, "# System Strategies & Recovery Patterns\n\n## Recovery Strategies\n\n", "utf-8");
      }
      const existingContent = readFileSync(strategiesPath, "utf-8");
      const currentCount = countExistingStrategies(existingContent);
      const appendBlock = formatNewStrategies(result.newLessons, currentCount);
      appendFileSync(strategiesPath, appendBlock, "utf-8");
      ctx.log(
        `[cron:reflect] Appended ${result.newLessons.length} new strategy/strategies (${currentCount + 1}–${currentCount + result.newLessons.length})`
      );
    }

    // Write report
    const report = formatReport(result);
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report, "utf-8");

    ctx.log(
      `[cron:reflect] Scan complete — ${result.lessonsExtracted} extracted, ${result.newLessons.length} new, ${result.lessonsDuplicate} duplicate`
    );
  };
};

// ── Pure logic ────────────────────────────────────────────────────────

/**
 * Run the full reflect pipeline: read → extract → deduplicate.
 */
export function runReflect(memoryStreamPath: string, strategiesPath: string): ReflectResult {
  const now = new Date().toISOString().slice(0, 16);

  // 1. Read recent session data (last TAIL_LINES lines)
  const entries = readRecentEntries(memoryStreamPath);

  // 2. Extract lessons
  const lessons = extractLessons(entries);

  // 3. Read existing strategies for dedup
  const existingContent = existsSync(strategiesPath)
    ? readFileSync(strategiesPath, "utf-8")
    : "";
  const existingTitles = extractExistingTitles(existingContent);

  // 4. Deduplicate
  const newLessons: ExtractedLesson[] = [];
  let duplicateCount = 0;

  for (const lesson of lessons) {
    if (isDuplicate(lesson.content, existingTitles, existingContent)) {
      duplicateCount++;
    } else {
      newLessons.push(lesson);
      // Also dedup against lessons we're about to add
      existingTitles.push(lesson.content.toLowerCase());
    }
  }

  return {
    timestamp: now,
    entriesScanned: entries.length,
    lessonsExtracted: lessons.length,
    lessonsNew: newLessons.length,
    lessonsDuplicate: duplicateCount,
    newLessons,
  };
}

/**
 * Read memory-stream.jsonl and return the last TAIL_LINES parsed entries.
 */
export function readRecentEntries(filePath: string): MemoryEntry[] {
  if (!existsSync(filePath)) return [];

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const tail = lines.slice(-TAIL_LINES);

  const entries: MemoryEntry[] = [];
  for (const line of tail) {
    try {
      entries.push(JSON.parse(line) as MemoryEntry);
    } catch {
      // Skip unparseable lines
    }
  }
  return entries;
}

/**
 * Extract lesson-worthy entries from parsed memory entries.
 *
 * An entry qualifies if:
 * - It has a `category` in LESSON_CATEGORIES, OR
 * - It has `type` containing "lesson", OR
 * - Its `content` contains one of LESSON_KEYWORDS.
 */
export function extractLessons(entries: MemoryEntry[]): ExtractedLesson[] {
  const lessons: ExtractedLesson[] = [];

  for (const entry of entries) {
    const content = entry.content ?? "";
    if (!content) continue;

    const isLessonCategory =
      typeof entry.category === "string" && LESSON_CATEGORIES.has(entry.category);
    const isLessonType =
      typeof entry.type === "string" && /lesson/i.test(entry.type);
    const hasKeyword = LESSON_KEYWORDS.some((kw) =>
      content.toLowerCase().includes(kw)
    );

    if (isLessonCategory || isLessonType || hasKeyword) {
      lessons.push({
        category: entry.category ?? "insight",
        content,
        agent: entry.agent ?? "unknown",
        timestamp: entry.timestamp ?? new Date().toISOString(),
      });
    }
  }

  return lessons;
}

/**
 * Extract existing strategy titles/content fragments from strategies.md
 * so we can deduplicate.
 */
export function extractExistingTitles(content: string): string[] {
  const titles: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Grab ### titles
    const titleMatch = line.match(/^###\s+\d+\.\s+(.+)/);
    if (titleMatch) {
      titles.push(titleMatch[1].toLowerCase());
    }
    // Grab canonical corrections
    const correctionMatch = line.match(/\*\*Canonical Correction\*\*:\s*"(.+)"/);
    if (correctionMatch) {
      titles.push(correctionMatch[1].toLowerCase());
    }
    // Grab strategy text
    const strategyMatch = line.match(/\*\*Strategy\*\*:\s*(.+)/);
    if (strategyMatch) {
      titles.push(strategyMatch[1].toLowerCase());
    }
  }

  return titles;
}

/**
 * Check if a lesson substantially matches any existing content.
 * Uses simple bigram overlap ratio.
 */
export function isDuplicate(
  lessonContent: string,
  existingTitles: string[],
  fullContent: string
): boolean {
  const lessonLower = lessonContent.toLowerCase();
  const lessonBigrams = bigrams(lessonLower);

  // Check against extracted titles/corrections/strategies
  for (const existing of existingTitles) {
    const existingBigrams = bigrams(existing);
    const similarity = bigramOverlap(lessonBigrams, existingBigrams);
    if (similarity >= DEDUP_THRESHOLD) return true;
  }

  // Also check if the exact content (first 80 chars) appears in the file
  const snippet = lessonLower.slice(0, 80);
  if (fullContent.toLowerCase().includes(snippet)) return true;

  return false;
}

/**
 * Generate character bigrams from a string.
 */
function bigrams(s: string): Set<string> {
  const result = new Set<string>();
  const cleaned = s.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < cleaned.length - 1; i++) {
    result.add(cleaned.slice(i, i + 2));
  }
  return result;
}

/**
 * Compute Dice coefficient between two bigram sets.
 */
function bigramOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const bg of a) {
    if (b.has(bg)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

/**
 * Count the number of existing ### N. strategy headers.
 */
export function countExistingStrategies(content: string): number {
  const matches = content.match(/^###\s+\d+\./gm);
  return matches ? matches.length : 0;
}

/**
 * Format new lessons as markdown strategy blocks ready to append.
 */
export function formatNewStrategies(lessons: ExtractedLesson[], startIndex: number): string {
  const blocks: string[] = [];

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const num = startIndex + i + 1;
    const title = deriveTitle(lesson);
    const trigger = deriveTrigger(lesson);
    const diagnosis = deriveDiagnosis(lesson);
    const strategy = deriveStrategy(lesson);
    const correction = deriveCorrection(lesson);

    blocks.push(`### ${num}. ${title}`);
    blocks.push(`**Trigger Pattern**: ${trigger}`);
    blocks.push(`**Diagnosis**: ${diagnosis}`);
    blocks.push(`**Strategy**: ${strategy}`);
    blocks.push(`**Canonical Correction**: "${correction}"`);
    blocks.push("");
  }

  return "\n" + blocks.join("\n");
}

/**
 * Derive a short title from a lesson.
 */
function deriveTitle(lesson: ExtractedLesson): string {
  const content = lesson.content;
  // Take first sentence or first 60 chars
  const firstSentence = content.split(/[.!?]/)[0].trim();
  if (firstSentence.length <= 60) return firstSentence;
  return firstSentence.slice(0, 57) + "...";
}

/**
 * Derive trigger pattern from lesson context.
 */
function deriveTrigger(lesson: ExtractedLesson): string {
  if (lesson.category === "fix") {
    return `Error/failure encountered by ${lesson.agent}`;
  }
  if (lesson.category === "pattern") {
    return `Recurring workflow situation (${lesson.agent})`;
  }
  return `Observation during ${lesson.agent} session`;
}

/**
 * Derive diagnosis from lesson category.
 */
function deriveDiagnosis(lesson: ExtractedLesson): string {
  if (lesson.category === "fix") {
    return "A bug or error was encountered and resolved.";
  }
  if (lesson.category === "pattern") {
    return "A reusable workflow pattern was identified.";
  }
  return "An insight about system behavior was observed.";
}

/**
 * Derive an actionable strategy from lesson content.
 * Transforms raw content into prescriptive "what to do" steps.
 */
function deriveStrategy(lesson: ExtractedLesson): string {
  const content = lesson.content.trim();
  // If content already starts with a numbered step or imperative verb, use directly
  if (/^\d+\.\s/.test(content) || /^(Always|Never|Use|Check|Verify|Ensure|Do not|Stop)/i.test(content)) {
    return content;
  }
  // Otherwise, wrap it as an actionable instruction
  if (lesson.category === "fix") {
    return `When this error occurs: ${content}`;
  }
  if (lesson.category === "pattern") {
    return `Apply this pattern: ${content}`;
  }
  return `Follow this approach: ${content}`;
}

/**
 * Derive a one-line canonical correction.
 */
function deriveCorrection(lesson: ExtractedLesson): string {
  const content = lesson.content;
  // Take first sentence as correction
  const firstSentence = content.split(/[.!?]/)[0].trim();
  if (firstSentence.length <= 80) return firstSentence;
  return firstSentence.slice(0, 77) + "...";
}

// ── Report formatting ─────────────────────────────────────────────────

function formatReport(result: ReflectResult): string {
  const lines: string[] = [];
  lines.push("# Reflect Report");
  lines.push("");
  lines.push(`**Generated**: ${result.timestamp} (automated scan)`);
  lines.push(`**Entries scanned**: ${result.entriesScanned}`);
  lines.push(`**Lessons extracted**: ${result.lessonsExtracted}`);
  lines.push(`**New (appended)**: ${result.lessonsNew}`);
  lines.push(`**Duplicates (skipped)**: ${result.lessonsDuplicate}`);
  lines.push("");

  if (result.newLessons.length === 0) {
    lines.push("**No new strategies** — all extracted lessons already covered.");
  } else {
    lines.push(`**${result.newLessons.length} new strategy/strategies appended to strategies.md:**`);
    lines.push("");
    for (const lesson of result.newLessons) {
      lines.push(`- **[${lesson.category}]** (${lesson.agent}): ${lesson.content.slice(0, 100)}${lesson.content.length > 100 ? "..." : ""}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
