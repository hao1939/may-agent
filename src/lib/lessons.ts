/**
 * Lesson Extraction and Retrieval — Phase 1 Implementation
 *
 * Implements the agent learning system described in docs/designs/agent-learning.md.
 * 
 * - extractLessons(): called after finish(), persists lessons to JSONL
 * - retrieveLessons(): called during buildSessionContext(), returns relevant lessons
 * - Supports per-agent and shared lesson pools
 * - Includes relevance scoring and context budget management
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  timestamp: string;
  agent: string;
  category: "fix" | "pattern" | "insight";
  text: string;
  source_task: string;
  confidence: number;
  validated_count: number;
  last_relevant: string;
}

export interface FinishLessonInput {
  category: "fix" | "pattern" | "insight";
  content: string;
}

export interface FinishOutput {
  status: "success" | "failure" | "blocked" | "partial";
  summary: string;
  lessons?: FinishLessonInput[];
  blockers?: Array<{ reason: string; context?: string }>;
  completed_items?: string[];
}

// ── Constants ─────────────────────────────────────────────────────────

const MAX_LESSONS_INJECTED = 10;
const MAX_LESSONS_BYTES = 2048;
const DECAY_HALF_LIFE_DAYS = 7;
const CONFIDENCE_FLOOR = 0.1;
const WORD_OVERLAP_DEDUP_THRESHOLD = 0.6;

// ── Lesson Storage ────────────────────────────────────────────────────

function getLessonsPath(agentsRoot: string, agentName: string): string {
  return join(agentsRoot, agentName, "lessons.jsonl");
}

function getSharedLessonsPath(agentsRoot: string): string {
  return join(agentsRoot, "shared", "lessons.jsonl");
}

function readLessonsFile(path: string): Lesson[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => {
    try {
      return JSON.parse(line) as Lesson;
    } catch {
      return null;
    }
  }).filter((l): l is Lesson => l !== null);
}

function appendLesson(path: string, lesson: Lesson): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(lesson) + "\n");
}

function writeLessonsFile(path: string, lessons: Lesson[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lessons.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

// ── Lesson Extraction (Post-Session) ──────────────────────────────────

/**
 * Extract and persist lessons from a finish() call.
 * Called automatically after every session ends.
 */
export function extractLessons(
  agentsRoot: string,
  agentName: string,
  taskDescription: string,
  finishOutput: FinishOutput,
): Lesson[] {
  const extracted: Lesson[] = [];
  const now = new Date().toISOString();
  const sourceTask = taskDescription.slice(0, 100);

  // 1. Extract explicit lessons from finish().lessons
  if (finishOutput.lessons) {
    for (const lesson of finishOutput.lessons) {
      extracted.push({
        id: randomUUID(),
        timestamp: now,
        agent: agentName,
        category: lesson.category,
        text: lesson.content,
        source_task: sourceTask,
        confidence: 1.0,
        validated_count: 0,
        last_relevant: now,
      });
    }
  }

  // 2. Auto-extract from failures: blocker reasons become "fix" lessons
  if (finishOutput.status === "failure" && finishOutput.blockers) {
    for (const blocker of finishOutput.blockers) {
      const text = blocker.context
        ? `${blocker.reason}: ${blocker.context}`
        : blocker.reason;
      extracted.push({
        id: randomUUID(),
        timestamp: now,
        agent: agentName,
        category: "fix",
        text,
        source_task: sourceTask,
        confidence: 0.8,
        validated_count: 0,
        last_relevant: now,
      });
    }
  }

  // 3. Persist: deduplicate against existing lessons, then append
  const agentLessonsPath = getLessonsPath(agentsRoot, agentName);
  const existing = readLessonsFile(agentLessonsPath);

  for (const lesson of extracted) {
    const duplicate = findDuplicate(existing, lesson);
    if (duplicate) {
      // Validate existing lesson instead of adding duplicate
      duplicate.validated_count++;
      duplicate.last_relevant = now;
      duplicate.confidence = Math.min(duplicate.confidence + 0.1, 1.0);
      writeLessonsFile(agentLessonsPath, existing);
    } else {
      appendLesson(agentLessonsPath, lesson);
      existing.push(lesson);

      // Cross-agent: share patterns and insights
      if (lesson.category !== "fix") {
        const sharedPath = getSharedLessonsPath(agentsRoot);
        const sharedLessons = readLessonsFile(sharedPath);
        if (!findDuplicate(sharedLessons, lesson)) {
          appendLesson(sharedPath, lesson);
        }
      }
    }
  }

  return extracted;
}

// ── Relevance Filtering (Session Start) ───────────────────────────────

/**
 * Retrieve the most relevant lessons for a given task.
 * Called during buildSessionContext() to inject into the session prompt.
 */
export function retrieveLessons(
  agentsRoot: string,
  agentName: string,
  taskDescription: string,
): string {
  // Read from both agent-specific and shared pools
  const agentLessons = readLessonsFile(getLessonsPath(agentsRoot, agentName));
  const sharedLessons = readLessonsFile(getSharedLessonsPath(agentsRoot));

  // Combine, dedup by id
  const seenIds = new Set<string>();
  const allLessons: Lesson[] = [];
  for (const lesson of [...agentLessons, ...sharedLessons]) {
    if (!seenIds.has(lesson.id) && lesson.confidence >= CONFIDENCE_FLOOR) {
      seenIds.add(lesson.id);
      allLessons.push(lesson);
    }
  }

  if (allLessons.length === 0) return "";

  // Score each lesson
  const taskWords = extractSignificantWords(taskDescription);
  const scored = allLessons.map((lesson) => ({
    lesson,
    score: computeRelevanceScore(lesson, taskWords),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top-k within budget
  const selected: Lesson[] = [];
  let totalBytes = 0;
  for (const { lesson } of scored) {
    if (selected.length >= MAX_LESSONS_INJECTED) break;
    const entryBytes = lesson.text.length + 20; // rough estimate with formatting
    if (totalBytes + entryBytes > MAX_LESSONS_BYTES) break;
    selected.push(lesson);
    totalBytes += entryBytes;
  }

  // Fallback: if nothing scored well, take 3 most recent
  if (selected.length === 0 && allLessons.length > 0) {
    const recent = [...allLessons]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 3);
    selected.push(...recent);
  }

  if (selected.length === 0) return "";

  // Format for injection
  const lines = selected.map(
    (l) => `- [${l.category}] ${l.text}`
  );
  return `## Lessons from Experience\n\n${lines.join("\n")}\n`;
}

// ── Lesson Lifecycle: Decay ───────────────────────────────────────────

/**
 * Apply confidence decay to all lessons older than half-life.
 * Run periodically (e.g., daily via heartbeat).
 */
export function decayLessons(agentsRoot: string, agentName: string): number {
  const path = getLessonsPath(agentsRoot, agentName);
  const lessons = readLessonsFile(path);
  if (lessons.length === 0) return 0;

  const now = Date.now();
  let decayed = 0;

  for (const lesson of lessons) {
    const ageMs = now - new Date(lesson.last_relevant).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > DECAY_HALF_LIFE_DAYS) {
      const decayFactor = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
      const newConfidence = lesson.confidence * decayFactor;
      if (newConfidence !== lesson.confidence) {
        lesson.confidence = Math.max(newConfidence, 0);
        decayed++;
      }
    }
  }

  // Remove lessons below floor
  const active = lessons.filter((l) => l.confidence >= CONFIDENCE_FLOOR);
  if (active.length < lessons.length || decayed > 0) {
    writeLessonsFile(path, active);
  }

  return decayed;
}

// ── Helpers ───────────────────────────────────────────────────────────

function extractSignificantWords(text: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "and",
    "but", "or", "nor", "not", "so", "yet", "both", "either", "neither",
    "this", "that", "these", "those", "it", "its", "they", "them", "their",
    "we", "our", "you", "your", "he", "she", "his", "her", "i", "me", "my",
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-_./]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );
}

function computeRelevanceScore(lesson: Lesson, taskWords: Set<string>): number {
  // Keyword overlap (0.4 weight)
  const lessonWords = extractSignificantWords(lesson.text);
  let overlap = 0;
  for (const word of lessonWords) {
    if (taskWords.has(word)) overlap++;
  }
  const keywordScore = lessonWords.size > 0 ? overlap / lessonWords.size : 0;

  // Recency (0.3 weight)
  const ageMs = Date.now() - new Date(lesson.timestamp).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyScore = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);

  // Confidence (0.2 weight)
  const confidenceScore = lesson.confidence * (1 + lesson.validated_count * 0.2);

  // Category boost (0.1 weight)
  const categoryBoost = lesson.category === "fix" ? 1.0 :
    lesson.category === "pattern" ? 0.7 : 0.4;

  return (
    keywordScore * 0.4 +
    recencyScore * 0.3 +
    Math.min(confidenceScore, 1.0) * 0.2 +
    categoryBoost * 0.1
  );
}

function wordOverlap(a: string, b: string): number {
  const wordsA = extractSignificantWords(a);
  const wordsB = extractSignificantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function findDuplicate(existing: Lesson[], candidate: Lesson): Lesson | null {
  for (const lesson of existing) {
    if (
      lesson.category === candidate.category &&
      wordOverlap(lesson.text, candidate.text) >= WORD_OVERLAP_DEDUP_THRESHOLD
    ) {
      return lesson;
    }
  }
  return null;
}
