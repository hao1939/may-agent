#!/usr/bin/env bun
/**
 * reflexion-scan.ts — Standalone CLI that scans session transcripts for
 * failed/partial sessions, extracts lessons, and appends them to
 * agents/<name>/context.md. Designed to run as a cron-style job.
 *
 * Usage: bun agents/tools/reflexion-scan.ts [--dry-run]
 *
 * No dependency on manager.ts or compiled runtime.
 */

import { readdirSync, readFileSync, existsSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SESSIONS_DIR = ".state/sessions";
const AGENTS_DIR = "agents";
const STATE_FILE = "agents/tools/.reflexion-scan-state.json";
const DRY_RUN = process.argv.includes("--dry-run");

interface ScanState {
  lastScannedSessions: string[];
}

interface SessionMeta {
  agent: string;
  task: string;
  status: string;
}

interface FinishData {
  status: string;
  summary: string;
  lessons?: Array<{ category: string; content: string }>;
  blockers?: Array<{ reason: string; context?: string }>;
}

function loadState(): ScanState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  }
  return { lastScannedSessions: [] };
}

function saveState(state: ScanState) {
  mkdirSync("agents/tools", { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getSessionDirs(): string[] {
  const dirs: string[] = [];
  for (const entry of readdirSync(SESSIONS_DIR)) {
    const path = join(SESSIONS_DIR, entry);
    if (entry.startsWith("s_") && existsSync(join(path, "meta.json"))) {
      dirs.push(entry);
    }
  }
  // Also check history
  const histDir = join(SESSIONS_DIR, "history");
  if (existsSync(histDir)) {
    for (const entry of readdirSync(histDir)) {
      const path = join(histDir, entry);
      if (entry.startsWith("s_") && existsSync(join(path, "meta.json"))) {
        dirs.push("history/" + entry);
      }
    }
  }
  return dirs;
}

function parseFinishFromJsonl(sessionDir: string): FinishData | null {
  const jsonlPath = join(SESSIONS_DIR, sessionDir, "session.jsonl");
  if (!existsSync(jsonlPath)) return null;
  
  const content = readFileSync(jsonlPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  
  // Look for finish() tool calls in assistant messages
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === "toolCall" && item.name === "finish" && item.arguments) {
            return item.arguments as FinishData;
          }
        }
      }
    } catch {}
  }
  return null;
}

function extractLessonsFromSession(meta: SessionMeta, finish: FinishData | null): Array<{category: string; text: string; source: string}> {
  const lessons: Array<{category: string; text: string; source: string}> = [];
  const source = meta.task?.slice(0, 80) || "unknown task";

  // From explicit finish lessons
  if (finish?.lessons) {
    for (const l of finish.lessons) {
      lessons.push({ category: l.category, text: l.content, source });
    }
  }

  // From failure blockers
  if ((meta.status === "failure" || finish?.status === "failure") && finish?.blockers) {
    for (const b of finish.blockers) {
      const text = b.context ? `${b.reason}: ${b.context}` : b.reason;
      lessons.push({ category: "fix", text, source });
    }
  }

  // From partial sessions — extract insight from summary
  if (finish?.status === "partial" && finish.summary) {
    lessons.push({
      category: "insight",
      text: `Partial completion: ${finish.summary.slice(0, 200)}`,
      source
    });
  }

  return lessons;
}

function appendToContextMd(agent: string, lessons: Array<{category: string; text: string}>) {
  const contextPath = join(AGENTS_DIR, agent, "context.md");
  if (!existsSync(contextPath)) {
    // Only append to agents that already have context.md
    console.log(`  ⚠ No context.md for agent "${agent}", skipping`);
    return false;
  }

  const existing = readFileSync(contextPath, "utf-8");
  
  // Deduplicate against existing content
  const newLessons = lessons.filter(l => !existing.includes(l.text.slice(0, 50)));
  if (newLessons.length === 0) {
    console.log(`  ⏭ All lessons already in ${agent}/context.md`);
    return false;
  }

  const section = "\n\n## Reflexion-Extracted Lessons\n" +
    newLessons.map(l => `- [${l.category}] ${l.text}`).join("\n") + "\n";

  if (existing.includes("## Reflexion-Extracted Lessons")) {
    // Append under existing section
    const lines = newLessons.map(l => `- [${l.category}] ${l.text}`).join("\n") + "\n";
    if (!DRY_RUN) appendFileSync(contextPath, lines);
    console.log(`  ✅ Appended ${newLessons.length} lessons to ${agent}/context.md`);
  } else {
    if (!DRY_RUN) appendFileSync(contextPath, section);
    console.log(`  ✅ Added Reflexion section with ${newLessons.length} lessons to ${agent}/context.md`);
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────

console.log("🔍 Reflexion Scan — Extracting lessons from session transcripts\n");

const state = loadState();
const sessionDirs = getSessionDirs();
const newSessions = sessionDirs.filter(d => !state.lastScannedSessions.includes(d));

console.log(`Found ${sessionDirs.length} sessions total, ${newSessions.length} new\n`);

let totalLessons = 0;
let agentsUpdated = new Set<string>();

for (const dir of newSessions.slice(0, 50)) { // Process max 50 per run
  const metaPath = join(SESSIONS_DIR, dir, "meta.json");
  try {
    const meta: SessionMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
    if (!meta.agent) continue;

    const finish = parseFinishFromJsonl(dir);
    const lessons = extractLessonsFromSession(meta, finish);

    if (lessons.length > 0) {
      console.log(`📋 ${dir} (${meta.agent}, status=${meta.status}): ${lessons.length} lessons`);
      for (const l of lessons) {
        console.log(`   [${l.category}] ${l.text.slice(0, 100)}`);
      }

      const wrote = appendToContextMd(meta.agent, lessons);
      if (wrote) {
        agentsUpdated.add(meta.agent);
        totalLessons += lessons.length;
      }
    }
  } catch (e) {
    // Skip unparseable sessions
  }
}

// Update state
state.lastScannedSessions = sessionDirs;
if (!DRY_RUN) saveState(state);

console.log(`\n✨ Done. Extracted ${totalLessons} lessons, updated ${agentsUpdated.size} agent(s): ${[...agentsUpdated].join(", ") || "none"}`);
if (DRY_RUN) console.log("(dry run — no files modified)");
