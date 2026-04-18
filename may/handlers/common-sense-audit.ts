/**
 * Common-sense-audit — agent-owned cron handler.
 *
 * Replaces the LLM-based `common-sense-verify` cron (req:35fd118e / c4cdeb41)
 * with a pure JS handler that picks one rule from agents/shared/common-sense.md
 * by daily rotation, queries `convention_checks` for that rule over the last
 * 7 days, and writes a markdown audit report to
 * agents/coach/workspace/common-sense-audit.md.
 *
 * Saves ~110 ops/day. Zero LLM calls.
 *
 * Exports create() conforming to HandlerModule.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// Source of truth: agents/may/handlers/convention-check.ts (which rules it implements).
// Keep in sync manually — common-sense.md is narrative prose and no longer carries C-IDs.
const RULES = ['C1.1','C1.3','C1.4','C1.5','C1.7','C2.1','C3.2','C3.3','C6.1','C7.1','C8.2','C12.1'];

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const outPath = join(ctx.agentsRoot, "coach", "workspace", "common-sense-audit.md");
    mkdirSync(dirname(outPath), { recursive: true });

    // Rules come from hardcoded RULES (source of truth = convention-check.ts).
    const rules = RULES;

    // Pick by day-of-year rotation.
    const now = new Date();
    const dayOfYear = Math.floor(
      (Date.now() - new Date(now.getUTCFullYear(), 0, 0).getTime()) / 86400000,
    );
    const rule = rules[dayOfYear % rules.length];

    // Query convention_checks for last 7d.
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const db = ctx.getDb();
    const rows: ConventionCheckRow[] = db.prepare(
      `SELECT agent, session_id AS sessionId, passed, violations, checked_at AS checkedAt
       FROM convention_checks
       WHERE convention = ? AND checked_at > ?
       ORDER BY checked_at DESC`,
    ).all(rule, cutoff) as ConventionCheckRow[];

    // 6. Aggregate + format.
    const report = formatReport(rule, rules, rows, cutoff, Date.now());
    writeFileSync(outPath, report, "utf-8");
    ctx.log(
      `[cron:common-sense-audit] rule=${rule} rows=${rows.length} — wrote ${outPath}`,
    );
  };
};

// ── Types ─────────────────────────────────────────────────────────────

interface ConventionCheckRow {
  agent: string;
  sessionId: string;
  passed: number;
  violations: string | null;
  checkedAt: number;
}

interface AgentAgg {
  agent: string;
  pass: number;
  fail: number;
  total: number;
  rate: number;
}

// ── Pure logic ────────────────────────────────────────────────────────

export function parseRuleIds(content: string): string[] {
  // Match rule IDs appearing in headings, bullets, or bolded spans at start of line.
  // e.g. "## C1.1 ...", "- **C2.1** ...", "* C3 — ..."
  const re = /^[#*\-]?\s*\*?\*?(C\d+(?:\.\d+)?)\*?\*?/gm;
  const seen = new Set<string>();
  const rules: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const id = m[1];
    if (!seen.has(id)) {
      seen.add(id);
      rules.push(id);
    }
  }
  return rules;
}

function aggregateByAgent(rows: ConventionCheckRow[]): AgentAgg[] {
  const map = new Map<string, { pass: number; fail: number }>();
  for (const r of rows) {
    const cur = map.get(r.agent) || { pass: 0, fail: 0 };
    if (r.passed) cur.pass++; else cur.fail++;
    map.set(r.agent, cur);
  }
  const out: AgentAgg[] = [];
  for (const [agent, v] of map) {
    const total = v.pass + v.fail;
    out.push({
      agent,
      pass: v.pass,
      fail: v.fail,
      total,
      rate: total > 0 ? v.pass / total : 0,
    });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatEmptyReport(csPath: string): string {
  return [
    `# Common-Sense Audit`,
    ``,
    `_Generated ${new Date().toISOString()}_`,
    ``,
    `## Rule picked`,
    ``,
    `_No rule IDs (matching \`C\\d+(\\.\\d+)?\`) found in \`${csPath}\`._`,
    ``,
    `## 7-day pass rate summary`,
    ``,
    `_No rules to audit._`,
    ``,
    `## Sample violations`,
    ``,
    `_None._`,
    ``,
    `## Coverage`,
    ``,
    `- Total checks: 0`,
    `- Agents observed: 0`,
    ``,
  ].join("\n");
}

function formatReport(
  rule: string,
  rules: string[],
  rows: ConventionCheckRow[],
  cutoff: number,
  now: number,
): string {
  const lines: string[] = [];
  const agg = aggregateByAgent(rows);
  const totalPass = rows.filter(r => r.passed).length;
  const totalFail = rows.length - totalPass;
  const overallRate = rows.length > 0 ? totalPass / rows.length : 0;

  lines.push(`# Common-Sense Audit`);
  lines.push(``);
  lines.push(`_Generated ${new Date(now).toISOString()}_`);
  lines.push(``);

  // Rule picked
  lines.push(`## Rule picked`);
  lines.push(``);
  lines.push(`**${rule}** — selected by day-of-year rotation from ${rules.length} hardcoded rule ID(s) (source: \`agents/may/handlers/convention-check.ts\`).`);
  lines.push(``);
  lines.push(`_All rules parsed:_ ${rules.map(r => `\`${r}\``).join(", ")}`);
  lines.push(``);
  lines.push(`_Window:_ ${new Date(cutoff).toISOString()} → ${new Date(now).toISOString()} (7 days)`);
  lines.push(``);

  // Pass rate summary
  lines.push(`## 7-day pass rate summary`);
  lines.push(``);
  if (agg.length === 0) {
    lines.push(`_No \`convention_checks\` rows matched \`convention = '${rule}'\` in the last 7 days._`);
    lines.push(``);
  } else {
    lines.push(`| Agent | Pass | Fail | Rate |`);
    lines.push(`|-------|------|------|------|`);
    for (const a of agg) {
      lines.push(`| ${a.agent} | ${a.pass} | ${a.fail} | ${pct(a.rate)} |`);
    }
    lines.push(`| **total** | **${totalPass}** | **${totalFail}** | **${pct(overallRate)}** |`);
    lines.push(``);
  }

  // Sample violations
  lines.push(`## Sample violations`);
  lines.push(``);
  const failures = rows.filter(r => !r.passed).slice(0, 5);
  if (failures.length === 0) {
    lines.push(`_No failing checks in the window._`);
    lines.push(``);
  } else {
    for (const f of failures) {
      const snippet = summarizeViolations(f.violations);
      lines.push(`- \`${f.sessionId}\` (${f.agent}, ${new Date(f.checkedAt).toISOString()}) — ${snippet}`);
    }
    lines.push(``);
  }

  // Coverage
  lines.push(`## Coverage`);
  lines.push(``);
  lines.push(`- Total checks: ${rows.length}`);
  lines.push(`- Agents observed: ${agg.length}${agg.length > 0 ? ` (${agg.map(a => a.agent).join(", ")})` : ""}`);
  lines.push(`- Overall pass rate: ${pct(overallRate)}`);
  lines.push(``);

  lines.push(`[SIG: ${now}:common-sense-audit-handler]`);
  lines.push(``);
  return lines.join("\n");
}

function summarizeViolations(raw: string | null): string {
  if (!raw) return "_(no violations payload)_";
  const trimmed = raw.trim();
  // Try JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return "_(empty violations array)_";
      const first = parsed[0];
      const text = typeof first === "string" ? first : JSON.stringify(first);
      const more = parsed.length > 1 ? ` (+${parsed.length - 1} more)` : "";
      return truncate(text, 180) + more;
    }
    if (typeof parsed === "string") return truncate(parsed, 200);
    return truncate(JSON.stringify(parsed), 200);
  } catch {
    return truncate(trimmed, 200);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
