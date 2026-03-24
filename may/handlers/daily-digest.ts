/**
 * daily-digest.ts — Generates a daily progress digest for human review.
 *
 * Queries requests, sessions, evaluations, and agent journals to produce
 * a structured markdown digest answering:
 * - What did the human ask for, and what happened?
 * - What new capabilities were created (skills, scenarios)?
 * - What's the quality trend?
 * - What broke or needs attention?
 * - What did each agent do?
 *
 * Output: writes to agents/shared/daily-digests/YYYY-MM-DD.md
 * Also pushes a condensed version to telegram via ctx.notify.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const digest = generateDigest(ctx);
    if (!digest) return;

    // Write to file
    const dateStr = new Date().toISOString().split("T")[0]!;
    const digestDir = join(ctx.agentsRoot, "shared", "daily-digests");
    mkdirSync(digestDir, { recursive: true });
    const digestPath = join(digestDir, `${dateStr}.md`);

    // Don't regenerate if already written today
    if (existsSync(digestPath)) {
      ctx.log(`[daily-digest] Already generated for ${dateStr}`);
      return;
    }

    writeFileSync(digestPath, digest, "utf-8");
    ctx.log(`[daily-digest] Written to ${digestPath}`);

    // Push condensed version to telegram
    const condensed = condense(digest);
    ctx.notify(condensed);
  };
};

// ── Generation ────────────────────────────────────────────────────────

function generateDigest(ctx: HandlerContext): string | null {
  const now = Date.now();
  const dayAgo = now - 86400000;
  const weekAgo = now - 7 * 86400000;
  const dateStr = new Date().toISOString().split("T")[0]!;

  let db: ReturnType<HandlerContext["getDb"]>;
  try { db = ctx.getDb(); } catch { return null; }

  const lines: string[] = [];
  lines.push(`# Daily Digest — ${dateStr}`, "");

  // ── Your Requests ───────────────────────────────────────────────
  try {
    const humanReqs = db.prepare(`
      SELECT r.requestId, r.task, r.status, r.toAgent, r.source, r.summary,
             r.durationMs, r.createdAt,
             s.outcome, s.agent as sessAgent
      FROM requests r
      LEFT JOIN sessions s ON r.sessionId = s.sessionId
      WHERE r.fromEntity = 'human' AND r.createdAt > ?
      ORDER BY r.createdAt DESC
    `).all(dayAgo) as any[];

    if (humanReqs.length > 0) {
      lines.push("## Your Requests", "");
      lines.push("| Request | Status | Agent | Duration | Outcome |");
      lines.push("|---------|--------|-------|----------|---------|");
      for (const r of humanReqs) {
        const task = (r.task || "").slice(0, 60).replace(/\|/g, "/").replace(/\n/g, " ");
        const dur = r.durationMs ? formatDuration(r.durationMs) : "—";
        const outcome = (r.outcome || r.summary || "—").slice(0, 80).replace(/\|/g, "/").replace(/\n/g, " ");
        const status = r.status === "COMPLETED" ? "✅" : r.status === "FAILED" ? "❌" : "⏳";
        lines.push(`| ${task} | ${status} | ${r.toAgent} | ${dur} | ${outcome} |`);
      }
      lines.push("");
    }
  } catch { /* best-effort */ }

  // ── New Capabilities ────────────────────────────────────────────
  const capabilities: string[] = [];

  // New skills (check file creation time)
  try {
    const skillsDir = join(ctx.agentsRoot, "shared", "skills");
    if (existsSync(skillsDir)) {
      for (const name of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, name, "SKILL.md");
        if (existsSync(skillPath)) {
          try {
            const stat = statSync(skillPath);
            if (stat.mtimeMs > dayAgo) {
              capabilities.push(`Skill: **${name}** (updated)`);
            }
          } catch {}
        }
      }
    }
  } catch {}

  // New gym scenarios
  try {
    const gymDir = join(ctx.agentsRoot, "gym", "scenarios");
    if (existsSync(gymDir)) {
      let newScenarios = 0;
      for (const name of readdirSync(gymDir)) {
        const scenDir = join(gymDir, name);
        try {
          if (statSync(scenDir).mtimeMs > dayAgo) newScenarios++;
        } catch {}
      }
      if (newScenarios > 0) capabilities.push(`**${newScenarios}** gym scenarios updated`);
    }
  } catch {}

  // Git commits in agents/ (meaningful, not auto-commits)
  try {
    const commits = execSync(
      `git log --since='24 hours ago' --oneline --no-merges 2>/dev/null | grep -v 'chore(auto)' | head -10`,
      { cwd: join(ctx.projectRoot, "agents"), encoding: "utf-8", timeout: 5000 },
    ).trim().split("\n").filter(Boolean);
    if (commits.length > 0) {
      capabilities.push(`**${commits.length}** meaningful commits:`);
      for (const c of commits.slice(0, 5)) {
        capabilities.push(`  - ${c.slice(9)}`); // strip hash
      }
    }
  } catch {}

  if (capabilities.length > 0) {
    lines.push("## New Capabilities", "");
    for (const c of capabilities) lines.push(`- ${c}`);
    lines.push("");
  }

  // ── Quality ─────────────────────────────────────────────────────
  try {
    const today = db.prepare(`
      SELECT AVG(quality) as q, AVG(efficiency) as e, COUNT(*) as cnt,
        SUM(CASE WHEN verdict='good' THEN 1 ELSE 0 END) as good,
        SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) as bad
      FROM evaluations WHERE createdAt > ? AND verdict != 'skipped'
    `).get(dayAgo) as any;

    const prev = db.prepare(`
      SELECT AVG(quality) as q, AVG(efficiency) as e
      FROM evaluations WHERE createdAt BETWEEN ? AND ? AND verdict != 'skipped'
    `).get(dayAgo - 86400000, dayAgo) as any;

    if (today && today.cnt > 0) {
      lines.push("## Quality", "");
      const qTrend = prev?.q ? (today.q > prev.q ? "↑" : today.q < prev.q ? "↓" : "→") : "";
      const eTrend = prev?.e ? (today.e > prev.e ? "↑" : today.e < prev.e ? "↓" : "→") : "";
      lines.push(`- **${today.cnt}** sessions evaluated`);
      lines.push(`- Quality: **${today.q.toFixed(1)}**/5 ${qTrend}  |  Efficiency: **${today.e.toFixed(1)}**/5 ${eTrend}`);
      lines.push(`- ${today.good} good, ${today.bad} needs improvement`);
      lines.push("");
    }
  } catch {}

  // ── Issues ──────────────────────────────────────────────────────
  const issues: string[] = [];
  try {
    // Failed requests
    const failed = db.prepare(`
      SELECT fromEntity, toAgent, task, error FROM requests
      WHERE createdAt > ? AND status = 'FAILED'
      ORDER BY createdAt DESC LIMIT 5
    `).all(dayAgo) as any[];
    for (const r of failed) {
      issues.push(`❌ ${r.fromEntity}→${r.toAgent}: ${(r.task || "").slice(0, 60)} — ${(r.error || "unknown").slice(0, 40)}`);
    }
  } catch {}

  // Stuck/terminated agents from log events (check session errors)
  try {
    const errorSessions = db.prepare(`
      SELECT agent, error, sessionId FROM sessions
      WHERE startedAt > ? AND status = 'error' AND error IS NOT NULL
      ORDER BY startedAt DESC LIMIT 5
    `).all(dayAgo) as any[];
    for (const s of errorSessions) {
      if (s.error && !issues.some(i => i.includes(s.agent))) {
        issues.push(`⚠️ ${s.agent}: ${s.error.slice(0, 80)}`);
      }
    }
  } catch {}

  if (issues.length > 0) {
    lines.push("## Issues", "");
    for (const i of issues.slice(0, 10)) lines.push(`- ${i}`);
    lines.push("");
  }

  // ── Agent Activity ──────────────────────────────────────────────
  try {
    const agents = db.prepare(`
      SELECT agent, COUNT(*) as cnt,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
        AVG(CASE WHEN endedAt IS NOT NULL THEN endedAt - startedAt END) as avgMs
      FROM sessions WHERE startedAt > ? AND agent NOT LIKE '%-%'
      GROUP BY agent ORDER BY cnt DESC
    `).all(dayAgo) as any[];

    if (agents.length > 0) {
      lines.push("## Agent Activity", "");
      lines.push("| Agent | Sessions | Done | Errors | Avg Duration |");
      lines.push("|-------|----------|------|--------|-------------|");
      for (const a of agents) {
        const avgDur = a.avgMs ? formatDuration(a.avgMs) : "—";
        lines.push(`| ${a.agent} | ${a.cnt} | ${a.done} | ${a.errors} | ${avgDur} |`);
      }
      lines.push("");
    }
  } catch {}

  // ── Research Highlights (from scout journal) ────────────────────
  try {
    const journalPath = join(ctx.agentsRoot, "scout", "workspace", "journal.md");
    if (existsSync(journalPath)) {
      const journal = readFileSync(journalPath, "utf-8");
      // Extract the most recent session entry (starts with "## Session")
      const entries = journal.split(/^## Session /m).filter(Boolean);
      const latest = entries[entries.length - 1];
      if (latest) {
        // Look for "What was done" or deliverables
        const doneMatch = latest.match(/### What was done\n([\s\S]*?)(?=\n###|\n## |$)/);
        if (doneMatch) {
          const highlights = doneMatch[1].trim().split("\n").filter(l => l.startsWith("1.") || l.startsWith("2.") || l.startsWith("3.")).slice(0, 3);
          if (highlights.length > 0) {
            lines.push("## Research Highlights", "");
            for (const h of highlights) lines.push(`- ${h.replace(/^\d+\.\s*/, "").slice(0, 120)}`);
            lines.push("");
          }
        }
      }
    }
  } catch {}

  if (lines.length <= 2) return null; // nothing to report
  return lines.join("\n");
}

// ── Condensed version for telegram ────────────────────────────────────

function condense(digest: string): string {
  const sections: string[] = [];

  // Extract just the key sections
  for (const section of ["Your Requests", "New Capabilities", "Quality", "Issues"]) {
    const match = digest.match(new RegExp(`## ${section}\\n\\n([\\s\\S]*?)(?=\\n## |$)`));
    if (match) {
      // Take first 3 lines of each section
      const sectionLines = match[1].trim().split("\n").filter(l => !l.startsWith("|---")).slice(0, 4);
      sections.push(`*${section}*\n${sectionLines.join("\n")}`);
    }
  }

  const dateStr = new Date().toISOString().split("T")[0]!;
  return `📊 *Daily Digest — ${dateStr}*\n\n${sections.join("\n\n")}`;
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
