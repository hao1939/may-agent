/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * lesson-extractor guard — automatically extracts lessons after each agent step.
 *
 * Listens to step_done events. When a step's finishResult contains lessons
 * or failure blockers, calls extractLessons() to persist them to JSONL files.
 *
 * This wires the reflexion-based learning pipeline into the agent infrastructure:
 * - Explicit lessons from finish({ lessons: [...] }) are persisted
 * - Failure blockers are auto-extracted as "fix" category lessons
 * - Deduplication and cross-agent sharing handled by lessons.ts
 *
 * Integration: M2 of the reflexion learning pipeline.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

// ── Inlined types from lessons.ts (guards can't import from src/ at runtime) ──

interface Lesson {
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

interface FinishOutput {
  status: "success" | "failure" | "blocked" | "partial";
  summary: string;
  lessons?: Array<{ category: "fix" | "pattern" | "insight"; content: string }>;
  blockers?: Array<{ reason: string; context?: string }>;
}

// ── Constants ──

const WORD_OVERLAP_DEDUP_THRESHOLD = 0.6;
const AGENTS_ROOT = join(process.cwd(), "agents");

// ── Inlined helpers from lessons.ts ──

function getLessonsPath(agentName: string): string {
  return join(AGENTS_ROOT, agentName, "lessons.jsonl");
}

function getSharedLessonsPath(): string {
  return join(AGENTS_ROOT, "shared", "lessons.jsonl");
}

function readLessonsFile(path: string): Lesson[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => {
    try { return JSON.parse(line) as Lesson; }
    catch { return null; }
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
    text.toLowerCase().replace(/[^a-z0-9\s-_./]/g, " ")
      .split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w))
  );
}

function wordOverlap(a: string, b: string): number {
  const wordsA = extractSignificantWords(a);
  const wordsB = extractSignificantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const word of wordsA) { if (wordsB.has(word)) overlap++; }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function findDuplicate(existing: Lesson[], candidate: Lesson): Lesson | null {
  for (const lesson of existing) {
    if (lesson.category === candidate.category &&
        wordOverlap(lesson.text, candidate.text) >= WORD_OVERLAP_DEDUP_THRESHOLD) {
      return lesson;
    }
  }
  return null;
}

// ── Core extraction (inlined from extractLessons) ──

function doExtractLessons(agentName: string, taskDescription: string, finishOutput: FinishOutput): Lesson[] {
  const extracted: Lesson[] = [];
  const now = new Date().toISOString();
  const sourceTask = taskDescription.slice(0, 100);

  // 1. Explicit lessons from finish().lessons
  if (finishOutput.lessons) {
    for (const lesson of finishOutput.lessons) {
      extracted.push({
        id: randomUUID(), timestamp: now, agent: agentName,
        category: lesson.category, text: lesson.content,
        source_task: sourceTask, confidence: 1.0,
        validated_count: 0, last_relevant: now,
      });
    }
  }

  // 2. Auto-extract from failures
  if (finishOutput.status === "failure" && finishOutput.blockers) {
    for (const blocker of finishOutput.blockers) {
      const text = blocker.context ? `${blocker.reason}: ${blocker.context}` : blocker.reason;
      extracted.push({
        id: randomUUID(), timestamp: now, agent: agentName,
        category: "fix", text, source_task: sourceTask,
        confidence: 0.8, validated_count: 0, last_relevant: now,
      });
    }
  }

  if (extracted.length === 0) return [];

  // 3. Persist with dedup
  const agentLessonsPath = getLessonsPath(agentName);
  const existing = readLessonsFile(agentLessonsPath);

  for (const lesson of extracted) {
    const duplicate = findDuplicate(existing, lesson);
    if (duplicate) {
      duplicate.validated_count++;
      duplicate.last_relevant = now;
      duplicate.confidence = Math.min(duplicate.confidence + 0.1, 1.0);
      writeLessonsFile(agentLessonsPath, existing);
    } else {
      appendLesson(agentLessonsPath, lesson);
      existing.push(lesson);
      // Cross-agent: share patterns and insights
      if (lesson.category !== "fix") {
        const sharedPath = getSharedLessonsPath();
        const sharedLessons = readLessonsFile(sharedPath);
        if (!findDuplicate(sharedLessons, lesson)) {
          appendLesson(sharedPath, lesson);
        }
      }
    }
  }

  return extracted;
}

// ── Guard Implementation ──

/**
 * Extract agent name from step name. Steps are typically named like
 * "coder-attempt-1" or just the agent name.
 */
function inferAgentName(event: WorkflowGuardEvent): string {
  // Try event.agent if available, otherwise parse from step name
  if ((event as any).agent) return (event as any).agent;
  const step = event.step ?? "";
  // Common patterns: "coder-attempt-1", "qa-review", etc.
  const match = step.match(/^([a-z]+)/);
  return match ? match[1] : "unknown";
}

export const guard: WorkflowGuard = {
  name: "lesson-extractor",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    // Only process steps that have a finishResult (agent sessions)
    const finishResult = event.result?.finishResult;
    if (!finishResult) return [];

    // Need at least status to process
    if (!finishResult.status) return [];

    const agentName = inferAgentName(event);
    const taskDescription = (event as any).task ?? event.step ?? "";

    try {
      const lessons = doExtractLessons(agentName, taskDescription, {
        status: finishResult.status,
        summary: finishResult.summary ?? "",
        lessons: finishResult.lessons,
        blockers: finishResult.blockers,
      });

      if (lessons.length > 0) {
        // Emit informational demand so it's visible in logs
        return [{
          type: "info" as any,
          reason: `Extracted ${lessons.length} lesson(s) from ${agentName}: ${lessons.map(l => `[${l.category}] ${l.text.slice(0, 60)}`).join("; ")}`,
        }];
      }
    } catch (err: any) {
      // Don't let lesson extraction errors break the workflow
      // Silent failure is acceptable — lessons are non-critical
    }

    return [];
  },
};
