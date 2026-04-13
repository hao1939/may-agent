/**
 * priority-drift — Sensor+Judge cron handler.
 *
 * Pattern: JS collects data (free) → detects anomaly → spawns focused LLM
 * session only when judgment is needed.
 *
 * Sensor phase (runs every 2h, zero LLM cost):
 *   1. Read recent human messages (last 48h) → extract topics
 *   2. Read recent agent sessions (last 12h) → extract what agents are doing
 *   3. Compare: are agents working on what Hao cares about?
 *   4. If drift detected → write report + spawn LLM judge session
 *
 * Judge phase (only when drift detected):
 *   - Receives pre-collected structured data
 *   - Decides: should we redirect agents? Update dispatch board?
 *   - ~5-10 ops per judgment (vs 15-20 for a heartbeat doing this)
 *
 * Expected cost: ~0 ops most cycles. ~8 ops when drift detected (est 1-2x/day).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  HandlerContext,
  HandlerModule,
} from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Configuration ─────────────────────────────────────────────────────

/** How far back to scan human messages. */
const HUMAN_WINDOW_MS = 48 * 60 * 60 * 1000;

/** How far back to scan agent sessions. */
const AGENT_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Minimum human messages needed to detect topics (skip if too few). */
const MIN_HUMAN_MESSAGES = 3;

/** Minimum keyword overlap ratio to consider agents "aligned". */
const ALIGNMENT_THRESHOLD = 0.3;

/** Cooldown: don't trigger judge more than once per N ms. */
const JUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Path to write the drift report. */
const REPORT_PATH = "agents/may/workspace/priority-drift-report.md";

/** Path to track last judge invocation. */
const STATE_PATH = "agents/may/workspace/.priority-drift-state.json";

// ── Topic extraction helpers ──────────────────────────────────────────

/** High-signal keywords to extract from human messages. Lowercase. */
const TOPIC_KEYWORDS = [
  // Architecture & design
  "workflow", "handler", "cron", "handler", "experiment", "deployment",
  "knowledge", "skill", "few-shot", "fewshot",
  // Quality & process  
  "evidence", "validation", "testing", "quality", "bug", "error",
  "autonomous", "proactive", "systematic",
  // Specific systems
  "coach", "optimizer", "bob", "scout", "tech-lead", "qa", "evaluator",
  "web ui", "visualization", "dashboard",
  "session", "compaction", "memory", "context",
  "prompt", "heartbeat", "standing-orders",
  // Directives
  "priority", "urgent", "important", "focus", "stop", "don't", "should",
];

/** Extract topic keywords from text. Returns Set of lowercase keywords found. */
function extractTopics(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const kw of TOPIC_KEYWORDS) {
    if (lower.includes(kw)) found.add(kw);
  }
  return found;
}

/** Extract 2-3 word phrases that appear frequently. */
function extractPhrases(texts: string[]): Map<string, number> {
  const phrases = new Map<string, number>();
  for (const text of texts) {
    // Simple: split into 2-3 word windows
    const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 1; i++) {
      const bi = `${words[i]} ${words[i + 1]}`;
      phrases.set(bi, (phrases.get(bi) || 0) + 1);
      if (i < words.length - 2) {
        const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        phrases.set(tri, (phrases.get(tri) || 0) + 1);
      }
    }
  }
  // Filter to phrases appearing 2+ times
  const result = new Map<string, number>();
  for (const [phrase, count] of phrases) {
    if (count >= 2) result.set(phrase, count);
  }
  return result;
}

// ── Data collection (Sensor phase) ────────────────────────────────────

interface HumanMessage {
  ts: number;
  text: string;
  topics: Set<string>;
}

interface AgentActivity {
  agent: string;
  task: string;
  topics: Set<string>;
  startedAt: number;
}

interface DriftReport {
  timestamp: number;
  humanTopics: Record<string, number>; // topic → frequency
  humanPhrases: Record<string, number>; // phrase → frequency
  agentTopics: Record<string, string[]>; // agent → topics they're working on
  alignedTopics: string[]; // topics both human and agents mention
  driftedTopics: string[]; // human topics agents aren't working on
  unusedEffort: string[]; // agent topics human hasn't mentioned
  alignmentScore: number; // 0-1, higher = more aligned
  humanMessageCount: number;
  agentSessionCount: number;
  recentHumanMessages: { ts: number; text: string }[]; // last 5 for LLM context
}

function collectHumanMessages(projectRoot: string, windowMs: number): HumanMessage[] {
  const path = join(projectRoot, ".state", "human-inputs.jsonl");
  if (!existsSync(path)) return [];

  const cutoff = Date.now() - windowMs;
  const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
  const messages: HumanMessage[] = [];

  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      if (d.ts >= cutoff && d.text) {
        messages.push({
          ts: d.ts,
          text: d.text,
          topics: extractTopics(d.text),
        });
      }
    } catch {
      // skip malformed lines
    }
  }
  return messages;
}

function collectAgentActivity(ctx: HandlerContext, windowMs: number): AgentActivity[] {
  const db = ctx.getDb();
  const cutoff = Date.now() - windowMs;
  const rows = db
    .prepare(
      `SELECT agent, task, startedAt FROM sessions 
       WHERE startedAt > ? AND agent NOT IN ('may', 'evaluator')
       AND source IS NULL OR source != 'handler'
       ORDER BY startedAt DESC LIMIT 50`
    )
    .all(cutoff) as { agent: string; task: string; startedAt: number }[];

  return rows.map((r) => ({
    agent: r.agent,
    task: r.task || "",
    topics: extractTopics(r.task || ""),
    startedAt: r.startedAt,
  }));
}

function computeDrift(
  humanMessages: HumanMessage[],
  agentActivities: AgentActivity[]
): DriftReport {
  // Aggregate human topics with frequency
  const humanTopicFreq = new Map<string, number>();
  for (const msg of humanMessages) {
    for (const topic of msg.topics) {
      humanTopicFreq.set(topic, (humanTopicFreq.get(topic) || 0) + 1);
    }
  }

  // Aggregate agent topics by agent
  const agentTopicsByAgent = new Map<string, Set<string>>();
  const allAgentTopics = new Set<string>();
  for (const act of agentActivities) {
    if (!agentTopicsByAgent.has(act.agent)) {
      agentTopicsByAgent.set(act.agent, new Set());
    }
    for (const topic of act.topics) {
      agentTopicsByAgent.get(act.agent)!.add(topic);
      allAgentTopics.add(topic);
    }
  }

  // Compute alignment
  const humanTopicSet = new Set(humanTopicFreq.keys());
  const aligned = [...humanTopicSet].filter((t) => allAgentTopics.has(t));
  const drifted = [...humanTopicSet].filter((t) => !allAgentTopics.has(t));
  const unused = [...allAgentTopics].filter((t) => !humanTopicSet.has(t));

  const alignmentScore =
    humanTopicSet.size > 0 ? aligned.length / humanTopicSet.size : 1;

  // Extract frequent phrases from human messages
  const phrases = extractPhrases(humanMessages.map((m) => m.text));

  // Agent topics as record
  const agentTopicsRecord: Record<string, string[]> = {};
  for (const [agent, topics] of agentTopicsByAgent) {
    agentTopicsRecord[agent] = [...topics];
  }

  return {
    timestamp: Date.now(),
    humanTopics: Object.fromEntries(humanTopicFreq),
    humanPhrases: Object.fromEntries(phrases),
    agentTopics: agentTopicsRecord,
    alignedTopics: aligned,
    driftedTopics: drifted,
    unusedEffort: unused,
    alignmentScore,
    humanMessageCount: humanMessages.length,
    agentSessionCount: agentActivities.length,
    recentHumanMessages: humanMessages
      .slice(-5)
      .map((m) => ({ ts: m.ts, text: m.text.slice(0, 200) })),
  };
}

// ── Report formatting ─────────────────────────────────────────────────

function formatReport(report: DriftReport): string {
  const date = new Date(report.timestamp).toISOString().slice(0, 16);
  const lines: string[] = [
    `# Priority Drift Report`,
    `Generated: ${date} UTC`,
    `Alignment score: **${(report.alignmentScore * 100).toFixed(0)}%**`,
    `Human messages (48h): ${report.humanMessageCount} | Agent sessions (12h): ${report.agentSessionCount}`,
    "",
  ];

  // Human priorities
  lines.push("## Human Priorities (by frequency)");
  const sorted = Object.entries(report.humanTopics).sort((a, b) => b[1] - a[1]);
  for (const [topic, freq] of sorted.slice(0, 15)) {
    lines.push(`- **${topic}** (×${freq})`);
  }
  lines.push("");

  // Key phrases
  if (Object.keys(report.humanPhrases).length > 0) {
    lines.push("## Recurring Phrases");
    const phrasesSorted = Object.entries(report.humanPhrases).sort((a, b) => b[1] - a[1]);
    for (const [phrase, freq] of phrasesSorted.slice(0, 10)) {
      lines.push(`- "${phrase}" (×${freq})`);
    }
    lines.push("");
  }

  // Agent activity
  lines.push("## Agent Activity Topics");
  for (const [agent, topics] of Object.entries(report.agentTopics)) {
    lines.push(`- **${agent}**: ${topics.join(", ") || "(no keyword match)"}`);
  }
  lines.push("");

  // Alignment
  if (report.alignedTopics.length > 0) {
    lines.push("## ✅ Aligned Topics");
    lines.push(report.alignedTopics.join(", "));
    lines.push("");
  }

  // Drift!
  if (report.driftedTopics.length > 0) {
    lines.push("## ⚠️ Drifted Topics (Hao mentioned, agents NOT working on)");
    for (const t of report.driftedTopics) {
      lines.push(`- **${t}** — mentioned ${report.humanTopics[t]}× by Hao, no agent activity`);
    }
    lines.push("");
  }

  // Unused effort
  if (report.unusedEffort.length > 0) {
    lines.push("## 📊 Agent Topics Not In Human Priorities");
    lines.push(report.unusedEffort.join(", "));
    lines.push("(These may be fine — agents do maintenance work independently)");
    lines.push("");
  }

  // Recent human messages for LLM context
  lines.push("## Recent Human Messages (for context)");
  for (const msg of report.recentHumanMessages) {
    const t = new Date(msg.ts).toISOString().slice(5, 16);
    lines.push(`> [${t}] ${msg.text}`);
  }

  return lines.join("\n");
}

// ── Main handler ──────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry
) => {
  return async () => {
    const projectRoot = ctx.projectRoot;

    // ── Sensor phase: collect data ────────────────────────────────
    const humanMessages = collectHumanMessages(projectRoot, HUMAN_WINDOW_MS);

    if (humanMessages.length < MIN_HUMAN_MESSAGES) {
      ctx.log(
        `[priority-drift] Only ${humanMessages.length} human messages in window — skipping.`
      );
      return;
    }

    const agentActivity = collectAgentActivity(ctx, AGENT_WINDOW_MS);
    const report = computeDrift(humanMessages, agentActivity);

    // Always write the report (useful as a dashboard even without judging)
    const reportPath = join(projectRoot, REPORT_PATH);
    mkdirSync(join(projectRoot, "agents/may/workspace"), { recursive: true });
    writeFileSync(reportPath, formatReport(report), "utf-8");
    ctx.log(
      `[priority-drift] Report written. Alignment: ${(report.alignmentScore * 100).toFixed(0)}%, ` +
        `drifted topics: ${report.driftedTopics.length}, human msgs: ${report.humanMessageCount}`
    );

    // ── Decision: should we invoke the Judge? ─────────────────────
    const needsJudgment =
      report.alignmentScore < ALIGNMENT_THRESHOLD &&
      report.driftedTopics.length >= 2;

    if (!needsJudgment) {
      ctx.log("[priority-drift] Alignment OK — no judgment needed.");
      return;
    }

    // Check cooldown
    const statePath = join(projectRoot, STATE_PATH);
    try {
      if (existsSync(statePath)) {
        const state = JSON.parse(readFileSync(statePath, "utf-8"));
        if (Date.now() - state.lastJudgeTs < JUDGE_COOLDOWN_MS) {
          ctx.log("[priority-drift] Judge cooldown active — skipping LLM call.");
          return;
        }
      }
    } catch {
      // corrupted state — proceed
    }

    // ── Judge phase: spawn focused LLM session ───────────────────
    ctx.log(
      `[priority-drift] Drift detected! Alignment ${(report.alignmentScore * 100).toFixed(0)}%, ` +
        `${report.driftedTopics.length} drifted topics. Spawning judge.`
    );

    const judgePrompt = `
## Priority Drift Alert — Judgment Needed

A priority drift has been detected between what Hao is asking about and what agents are working on.

**Read the full report**: \`${REPORT_PATH}\`

Key findings:
- Alignment score: ${(report.alignmentScore * 100).toFixed(0)}%
- Topics Hao mentioned that agents are NOT working on: ${report.driftedTopics.join(", ")}
- Topics agents are working on that Hao hasn't mentioned: ${report.unusedEffort.slice(0, 5).join(", ")}

Your job:
1. Read the report carefully
2. Decide: should any agents be redirected? Which ones and to what?
3. If yes, dispatch the work (send messages to appropriate agents)
4. Update the dispatch board if priorities have shifted
5. If the drift is acceptable (agents doing valid maintenance), just note it and skip

Be concise. Don't over-react to small drift — only redirect if there's a clear mismatch.
`.trim();

    ctx.manager.run("may", judgePrompt, { source: "handler" });

    // Update cooldown state
    writeFileSync(
      statePath,
      JSON.stringify({ lastJudgeTs: Date.now(), alignmentScore: report.alignmentScore }),
      "utf-8"
    );
  };
};
