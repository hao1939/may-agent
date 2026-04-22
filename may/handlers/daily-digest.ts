/**
 * daily-digest.ts — Generates a daily progress digest for human review.
 *
 * Shows what ACTUALLY CHANGED — code commits, agent knowledge, skills,
 * research — not just session counts. The human wants to know:
 * - What code was written/fixed? (src/ commits)
 * - What did agents learn/create? (agents/ commits, new files)
 * - What did I ask for, and what happened? (requests)
 * - Is quality improving? (evaluation trends)
 * - What broke? (errors, failed requests)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const dateStr = new Date().toISOString().split("T")[0]!;
    const digestDir = join(ctx.agentsRoot, "shared", "daily-digests");
    mkdirSync(digestDir, { recursive: true });
    const digestPath = join(digestDir, `${dateStr}.md`);

    if (existsSync(digestPath)) {
      ctx.log(`[daily-digest] Already generated for ${dateStr}`);
      return;
    }

    const digest = generateDigest(ctx, dateStr);
    if (!digest) return;

    writeFileSync(digestPath, digest, "utf-8");
    ctx.log(`[daily-digest] Written to ${digestPath}`);
    ctx.notify(condense(digest));
  };
};

function generateDigest(ctx: HandlerContext, dateStr: string): string | null {
  const dayStart = new Date(dateStr + "T00:00:00Z").getTime();
  const dayEnd = dayStart + 86400000;
  const prevDayStart = dayStart - 86400000;

  let db: ReturnType<HandlerContext["getDb"]>;
  try { db = ctx.getDb(); } catch { return null; }

  const lines: string[] = [];
  lines.push(`# Daily Digest — ${dateStr}`, "");

  // ── Code Changes (src/) ─────────────────────────────────────────
  try {
    const commits = execSync(
      `git log --oneline --after="${dateStr}T00:00:00Z" --before="${dateStr}T23:59:59Z" --no-merges -- src/ 2>/dev/null`,
      { cwd: ctx.projectRoot, encoding: "utf-8", timeout: 10000 },
    ).trim().split("\n").filter(Boolean);

    if (commits.length > 0) {
      // Group by type
      const feats = commits.filter(c => c.includes("feat"));
      const fixes = commits.filter(c => c.includes("fix"));
      const other = commits.filter(c => !c.includes("feat") && !c.includes("fix"));

      lines.push(`## Code Changes (${commits.length} commits)`, "");
      if (feats.length > 0) {
        lines.push("**New features:**");
        for (const c of feats.slice(0, 8)) lines.push(`- ${c.slice(8)}`);
        if (feats.length > 8) lines.push(`- ... and ${feats.length - 8} more`);
        lines.push("");
      }
      if (fixes.length > 0) {
        lines.push("**Fixes:**");
        for (const c of fixes.slice(0, 8)) lines.push(`- ${c.slice(8)}`);
        if (fixes.length > 8) lines.push(`- ... and ${fixes.length - 8} more`);
        lines.push("");
      }
      if (other.length > 0 && feats.length + fixes.length < 5) {
        lines.push("**Other:**");
        for (const c of other.slice(0, 5)) lines.push(`- ${c.slice(8)}`);
        lines.push("");
      }
    }
  } catch {}

  // ── Agent Changes ───────────────────────────────────────────────
  try {
    const agentsDir = join(ctx.projectRoot, "agents");
    // Meaningful commits (not auto-commits)
    const agentCommits = execSync(
      `git log --oneline --after="${dateStr}T00:00:00Z" --before="${dateStr}T23:59:59Z" --no-merges 2>/dev/null | grep -vi "chore(auto)\\|auto-commit\\|auto:"`,
      { cwd: agentsDir, encoding: "utf-8", timeout: 10000 },
    ).trim().split("\n").filter(Boolean);

    // New files created
    const newFiles = execSync(
      `git log --after="${dateStr}T00:00:00Z" --before="${dateStr}T23:59:59Z" --diff-filter=A --name-only --format="" 2>/dev/null`,
      { cwd: agentsDir, encoding: "utf-8", timeout: 10000 },
    ).trim().split("\n").filter(Boolean);

    // Categorize new files
    const newSkills = newFiles.filter(f => f.includes("/skills/") && f.endsWith("SKILL.md"));
    const newScenarios = newFiles.filter(f => f.includes("gym/scenarios/") && f.endsWith("scenario.json"));
    const newKnowledge = newFiles.filter(f => f.includes("/knowledge/") && !f.includes("/library/"));
    const newDeepDives = newFiles.filter(f => f.includes("deep-dive") || f.includes("deep-dives/"));

    if (agentCommits.length > 0 || newSkills.length > 0 || newScenarios.length > 0) {
      lines.push(`## Agent Changes`, "");
      if (agentCommits.length > 0) {
        lines.push(`**${agentCommits.length} meaningful commits:**`);
        for (const c of agentCommits.slice(0, 10)) lines.push(`- ${c.slice(8)}`);
        if (agentCommits.length > 10) lines.push(`- ... and ${agentCommits.length - 10} more`);
        lines.push("");
      }
      if (newSkills.length > 0) {
        lines.push(`**${newSkills.length} new skill(s):** ${newSkills.map(f => f.split("/skills/")[1]?.split("/")[0]).join(", ")}`);
        lines.push("");
      }
      if (newScenarios.length > 0) {
        lines.push(`**${newScenarios.length} new gym scenario(s):** ${newScenarios.map(f => f.split("/scenarios/")[1]?.split("/")[0]).join(", ")}`);
        lines.push("");
      }
      if (newDeepDives.length > 0) {
        lines.push(`**${newDeepDives.length} new research deep-dive(s)**`);
        lines.push("");
      }
    }
  } catch {}

  // ── Your Requests ───────────────────────────────────────────────
  try {
    const humanReqs = db.prepare(`
      SELECT r.task, r.status, r.toAgent, r.summary, r.durationMs, r.source, s.outcome
      FROM requests r LEFT JOIN sessions s ON r.sessionId = s.sessionId
      WHERE r.fromEntity = 'human' AND r.createdAt BETWEEN ? AND ?
        AND COALESCE(r.source, '') != 'cli-oneshot'
      ORDER BY r.createdAt DESC
    `).all(dayStart, dayEnd) as any[];

    // Filter out trivial test commands (echo/say hello, etc.)
    const meaningful = (humanReqs as any[]).filter(r => {
      const task = (r.task || "").trim();
      if (task.length < 20) return false; // too short to be real
      if (/^(echo|say)\s/i.test(task)) return false; // test commands
      return true;
    });

    if (meaningful.length > 0) {
      lines.push("## Your Requests", "");
      for (const r of meaningful) {
        const task = (r.task || "").slice(0, 80).replace(/\n/g, " ");
        const dur = r.durationMs ? formatDuration(r.durationMs) : "";
        const outcome = r.outcome || r.summary || "";
        const status = r.status === "COMPLETED" ? "✅" : r.status === "FAILED" ? "❌" : "⏳";
        lines.push(`- ${status} **${task}**${dur ? " (" + dur + ")" : ""}`);
        if (outcome) lines.push(`  → ${outcome.slice(0, 120).replace(/\n/g, " ")}`);
      }
      lines.push("");
    }
  } catch {}

  // ── Quality ─────────────────────────────────────────────────────
  try {
    const today = db.prepare(`
      SELECT AVG(quality) as q, AVG(efficiency) as e, COUNT(*) as cnt,
        SUM(CASE WHEN verdict='good' THEN 1 ELSE 0 END) as good,
        SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) as bad
      FROM evaluations WHERE createdAt BETWEEN ? AND ? AND verdict != 'skipped'
    `).get(dayStart, dayEnd) as any;

    const prev = db.prepare(`
      SELECT AVG(quality) as q, AVG(efficiency) as e
      FROM evaluations WHERE createdAt BETWEEN ? AND ? AND verdict != 'skipped'
    `).get(prevDayStart, dayStart) as any;

    if (today && today.cnt > 0) {
      const qTrend = prev?.q ? (today.q > prev.q + 0.1 ? " ↑" : today.q < prev.q - 0.1 ? " ↓" : "") : "";
      const eTrend = prev?.e ? (today.e > prev.e + 0.1 ? " ↑" : today.e < prev.e - 0.1 ? " ↓" : "") : "";
      lines.push("## Quality", "");
      lines.push(`- **${today.cnt}** sessions evaluated — quality **${today.q.toFixed(1)}**/5${qTrend}, efficiency **${today.e.toFixed(1)}**/5${eTrend}`);
      lines.push(`- ${today.good} good, ${today.bad} needs improvement`);
      lines.push("");
    }
  } catch {}

  // ── Agent Activity ──────────────────────────────────────────────
  try {
    const agents = db.prepare(`
      SELECT agent, COUNT(*) as cnt,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors
      FROM sessions WHERE startedAt BETWEEN ? AND ?
      GROUP BY agent ORDER BY cnt DESC
    `).all(dayStart, dayEnd) as any[];

    if (agents.length > 0) {
      const total = agents.reduce((s: number, a: any) => s + a.cnt, 0);
      lines.push(`## Agent Activity (${total} sessions)`, "");
      for (const a of agents) {
        const errStr = a.errors > 0 ? `, ${a.errors} errors` : "";
        lines.push(`- **${a.agent}**: ${a.cnt} sessions (${a.done} done${errStr})`);
      }
      lines.push("");
    }
  } catch {}

  // ── Issues ──────────────────────────────────────────────────────
  const issues: string[] = [];
  try {
    const errSessions = db.prepare(`
      SELECT agent, COUNT(*) as cnt FROM sessions
      WHERE startedAt BETWEEN ? AND ? AND status = 'error'
      GROUP BY agent HAVING cnt >= 3 ORDER BY cnt DESC
    `).all(dayStart, dayEnd) as any[];
    for (const s of errSessions) {
      issues.push(`⚠️ ${s.agent}: ${s.cnt} error sessions`);
    }
  } catch {}

  if (issues.length > 0) {
    lines.push("## Issues", "");
    for (const i of issues) lines.push(`- ${i}`);
    lines.push("");
  }

  if (lines.length <= 2) return null;
  return lines.join("\n");
}

function condense(digest: string): string {
  // Extract first 3 items from Code Changes and Agent Changes
  const sections: string[] = [];
  for (const section of ["Code Changes", "Agent Changes", "Your Requests", "Quality"]) {
    const match = digest.match(new RegExp(`## ${section}[^\\n]*\\n\\n([\\s\\S]*?)(?=\\n## |$)`));
    if (match) {
      const content = match[1].trim().split("\n").slice(0, 5).join("\n");
      sections.push(`*${section}*\n${content}`);
    }
  }
  const dateStr = new Date().toISOString().split("T")[0]!;
  return `📊 *Daily Digest — ${dateStr}*\n\n${sections.join("\n\n")}`;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
