/**
 * context-learning — Extract lessons from failed sessions and persist to context.md.
 *
 * Runs every 2 hours. Queries recent failed/errored sessions, checks which
 * ones haven't been processed yet, then extracts lessons in pure JS and
 * appends them to each agent's context.md.
 *
 * Previously forked bob (a full LLM session) to do the extraction. Now
 * pure JS — the failure data (what_happened, issues, failureChains) is
 * already structured enough to generate "When X, do Y" lessons via
 * templates. Saves ~1 LLM session per learning agent per 2h cycle.
 *
 * State tracking: writes processed session IDs to .state/context-learning-processed.json
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

const STATE_FILE = ".state/context-learning-processed.json";
const LOOKBACK_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_LESSONS_PER_AGENT = 15;
const MIN_QUALITY_THRESHOLD = 4; // Only learn from sessions scoring below this
const LEARNED_SECTION = "## Learned from experience";

// Agents that should learn from their failures
const LEARNING_AGENTS = ["bob", "coach", "tech-lead", "scout", "qa"];

// Patterns indicating infra/external failures (skip these — not agent mistakes)
const INFRA_PATTERNS = [
  /timeout/i, /ETIMEDOUT/i, /ECONNRESET/i, /ECONNREFUSED/i,
  /rate.?limit/i, /429/i, /503/i, /502/i,
  /out of memory/i, /ENOMEM/i, /killed/i,
  /context.?length.?exceed/i, /token.?limit/i,
];

// ── Lesson extraction (pure JS, no LLM) ──────────────────────────────

interface FailureRecord {
  sessionId: string;
  agent: string;
  task: string;
  error: string;
  outcome: string;
  what_happened: string;
  issues: string;
  failureChains: string;
  verdict: string;
  quality: number | null;
}

function isInfraFailure(s: FailureRecord): boolean {
  const text = `${s.error || ""} ${s.what_happened || ""} ${s.issues || ""}`;
  return INFRA_PATTERNS.some(p => p.test(text));
}

/**
 * Extract a lesson from structured failure data.
 * Returns null if no actionable lesson can be derived.
 */
function extractLesson(s: FailureRecord): string | null {
  if (isInfraFailure(s)) return null;

  const date = new Date().toISOString().slice(0, 10);

  // Parse issues JSON if available
  let issuesList: string[] = [];
  try {
    const parsed = JSON.parse(s.issues || "[]");
    if (Array.isArray(parsed)) issuesList = parsed.map(String);
  } catch {
    if (s.issues && s.issues !== "[]") issuesList = [s.issues];
  }

  // Parse failureChains if available
  let chains: string[] = [];
  try {
    const parsed = JSON.parse(s.failureChains || "[]");
    if (Array.isArray(parsed)) chains = parsed.map(String);
  } catch {
    if (s.failureChains) chains = [s.failureChains];
  }

  // Build lesson from the most informative source
  const whatHappened = (s.what_happened || "").trim();
  const topIssue = issuesList[0] || "";
  const topChain = chains[0] || "";
  const error = (s.error || "").trim();
  const task = (s.task || "").slice(0, 100).trim();

  // Need at least some signal to form a lesson
  if (!whatHappened && !topIssue && !topChain && !error) return null;

  // Use what_happened as the primary signal (it's already a summary)
  if (whatHappened) {
    return `- ${whatHappened.slice(0, 200)} (source: ${s.sessionId}, ${date})`;
  }

  // Fall back to top issue + error
  if (topIssue) {
    const context = error ? ` Error: ${error.slice(0, 100)}` : "";
    return `- ${topIssue.slice(0, 200)}${context} (source: ${s.sessionId}, ${date})`;
  }

  // Fall back to failure chain
  if (topChain) {
    return `- Failure pattern: ${topChain.slice(0, 200)} (source: ${s.sessionId}, ${date})`;
  }

  // Last resort: use error directly
  if (error) {
    return `- When doing "${task}": ${error.slice(0, 150)} (source: ${s.sessionId}, ${date})`;
  }

  return null;
}

/**
 * Read existing lessons from context.md's "Learned from experience" section.
 */
function readExistingLessons(contextPath: string): string[] {
  if (!existsSync(contextPath)) return [];
  const content = readFileSync(contextPath, "utf-8");
  const sectionIdx = content.indexOf(LEARNED_SECTION);
  if (sectionIdx === -1) return [];

  // Extract lines from section until next ## heading or EOF
  const afterSection = content.slice(sectionIdx + LEARNED_SECTION.length);
  const nextHeading = afterSection.search(/\n##\s/);
  const sectionContent = nextHeading === -1 ? afterSection : afterSection.slice(0, nextHeading);

  return sectionContent
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.startsWith("- "));
}

/**
 * Check if a lesson is a duplicate of existing ones (fuzzy: same sessionId).
 */
function isDuplicate(lesson: string, existing: string[]): boolean {
  // Extract sessionId from lesson
  const match = lesson.match(/source:\s*([^,)]+)/);
  if (!match) return false;
  const sessionId = match[1].trim();
  return existing.some(e => e.includes(sessionId));
}

/**
 * Append lessons to context.md under "Learned from experience" section.
 */
function appendLessons(contextPath: string, newLessons: string[]): void {
  let content: string;
  if (existsSync(contextPath)) {
    content = readFileSync(contextPath, "utf-8");
  } else {
    content = "";
  }

  const sectionIdx = content.indexOf(LEARNED_SECTION);

  if (sectionIdx === -1) {
    // Add section at end
    const section = `\n\n${LEARNED_SECTION}\n\n${newLessons.join("\n")}\n`;
    writeFileSync(contextPath, content + section);
  } else {
    // Find end of section (next ## heading or EOF)
    const afterSection = content.slice(sectionIdx + LEARNED_SECTION.length);
    const nextHeading = afterSection.search(/\n##\s/);

    let sectionContent: string;
    let rest: string;
    if (nextHeading === -1) {
      sectionContent = afterSection;
      rest = "";
    } else {
      sectionContent = afterSection.slice(0, nextHeading);
      rest = afterSection.slice(nextHeading);
    }

    // Parse existing lessons and add new ones
    const existingLines = sectionContent
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.startsWith("- "));

    const allLessons = [...existingLines, ...newLessons];

    // Trim to max, removing oldest (top of list)
    const trimmed = allLessons.slice(-MAX_LESSONS_PER_AGENT);

    const newSection = `${LEARNED_SECTION}\n\n${trimmed.join("\n")}\n`;
    writeFileSync(contextPath, content.slice(0, sectionIdx) + newSection + rest);
  }
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    const now = Date.now();
    const cutoff = now - LOOKBACK_MS;

    // Load processed set
    const statePath = join(ctx.projectRoot, STATE_FILE);
    let processed: Set<string>;
    try {
      const data = JSON.parse(readFileSync(statePath, "utf-8"));
      processed = new Set(data.sessionIds || []);
    } catch {
      processed = new Set();
    }

    // Find failed/low-quality sessions in the lookback window
    const candidates = db.prepare(`
      SELECT s.sessionId, s.agent, s.task, s.error, s.outcome, s.opCount,
             e.quality, e.verdict, e.issues, e.failureChains,
             d.what_happened
      FROM sessions s
      LEFT JOIN evaluations e ON e.sessionId = s.sessionId
      LEFT JOIN session_digests d ON d.sessionId = s.sessionId AND d.trigger = 'end'
      WHERE s.status = 'done'
        AND s.startedAt > ?
        AND s.agent IN (${LEARNING_AGENTS.map(() => '?').join(',')})
        AND (
          s.error IS NOT NULL AND s.error != ''
          OR e.quality < ?
          OR e.verdict IN ('fail', 'poor')
        )
      GROUP BY s.sessionId
      ORDER BY s.startedAt DESC
      LIMIT 20
    `).all(cutoff, ...LEARNING_AGENTS, MIN_QUALITY_THRESHOLD) as any[];

    // Filter out already-processed
    const unprocessed = candidates.filter(c => !processed.has(c.sessionId));

    if (unprocessed.length === 0) {
      ctx.log("[context-learning] No new failed sessions to learn from.");
      return;
    }

    // Group by agent
    const byAgent = new Map<string, typeof unprocessed>();
    for (const s of unprocessed) {
      const list = byAgent.get(s.agent) || [];
      list.push(s);
      byAgent.set(s.agent, list);
    }

    let totalLessons = 0;
    const agentsUpdated: string[] = [];

    for (const [agent, sessions] of byAgent) {
      const contextPath = join(ctx.projectRoot, "agents", agent, "context.md");
      const existing = readExistingLessons(contextPath);

      const newLessons: string[] = [];
      for (const s of sessions) {
        const lesson = extractLesson(s as FailureRecord);
        if (lesson && !isDuplicate(lesson, existing)) {
          newLessons.push(lesson);
        }
      }

      if (newLessons.length > 0) {
        appendLessons(contextPath, newLessons);
        totalLessons += newLessons.length;
        agentsUpdated.push(agent);
        ctx.log(`[context-learning] Added ${newLessons.length} lesson(s) to ${agent}/context.md`);
      }

      // Mark all as processed regardless of whether lessons were extracted
      for (const s of sessions) {
        processed.add(s.sessionId);
      }
    }

    // Commit if we made changes
    if (agentsUpdated.length > 0) {
      try {
        const files = agentsUpdated.map(a => `agents/${a}/context.md`);
        execSync(`git add ${files.join(" ")} && git commit -m "context-learning: add ${totalLessons} lesson(s) for ${agentsUpdated.join(", ")}"`, {
          cwd: ctx.projectRoot,
          timeout: 15_000,
          stdio: "pipe",
        });
      } catch {
        ctx.log("[context-learning] Git commit failed (non-fatal — lessons still written to disk)");
      }
    }

    // Persist processed set (keep last 500 to prevent unbounded growth)
    const processedArr = [...processed].slice(-500);
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({ sessionIds: processedArr, lastRun: now }, null, 2));

    ctx.log(`[context-learning] Done. Extracted ${totalLessons} lesson(s) for ${agentsUpdated.length} agent(s) from ${unprocessed.length} failed sessions. Pure JS — no LLM sessions used.`);
  };
};
