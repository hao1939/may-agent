/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * coaching-feedback — Sensor-Judge workflow for convention violation coaching.
 *
 * Migrated from: agents/may/handlers/coaching-feedback.ts (JS cron handler)
 *
 * Pattern:
 *   Step 1 (sensor): JS queries convention_checks DB → structured violation data (zero LLM cost)
 *   Step 2 (judge):  Coach LLM analyzes violations, decides coaching strategy (LLM cost only when needed)
 *
 * Benefits over old handler:
 *   - Coach LLM can decide *how* to intervene (skill update, gym scenario, SOUL edit, or skip)
 *   - Guards can observe the workflow (e.g. block if coach is overloaded)
 *   - Short-circuits when no significant violations found (most cycles)
 *   - Coach gets full context, not just formatted text
 *
 * Cron entry (agents/may/cron.json):
 *   handler: "run-workflow"
 *   handlerConfig: { workflow: "coaching-feedback", agent: "coach", task: "..." }
 */

import { join } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────

interface ViolationSummary {
  convention: string;
  count: number;
  total: number;
  rate: number;
  examples: string[];
}

interface AgentViolations {
  agent: string;
  sessionCount: number;
  violations: ViolationSummary[];
}

interface ScanResult {
  agentsWithViolations: AgentViolations[];
  totalAgentsScanned: number;
  lookbackHours: number;
  scanTimestamp: string;
}

// ── Configuration ─────────────────────────────────────────────────────

const LOOKBACK_MS = 86_400_000; // 24h
const TOP_N = 3; // max violations per agent
const MIN_VIOLATIONS = 3; // threshold to report
const SKIP_AGENTS = new Set(["may", "coach"]); // meta-agents don't need coaching

// ── Sensor: Query DB for violations (zero LLM cost) ───────────────────

function scanViolations(persistDir: string): ScanResult {
  // Dynamic import to avoid hard dependency on DB module at load time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDb } = require(join(process.cwd(), "src", "lib", "requests.js"));
  const db = getDb(persistDir);

  const cutoff = Date.now() - LOOKBACK_MS;

  const rows = db.prepare(`
    SELECT agent, convention,
           COUNT(*) as total,
           SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as violations,
           GROUP_CONCAT(CASE WHEN passed = 0 THEN violations ELSE NULL END, '|||') as examples
    FROM convention_checks
    WHERE checked_at > ?
    GROUP BY agent, convention
    HAVING violations >= ?
    ORDER BY agent, violations DESC
  `).all(cutoff, MIN_VIOLATIONS) as Array<{
    agent: string;
    convention: string;
    total: number;
    violations: number;
    examples: string | null;
  }>;

  // Group by agent, take top N per agent
  const byAgent = new Map<string, ViolationSummary[]>();
  const allAgents = new Set<string>();

  for (const row of rows) {
    allAgents.add(row.agent);
    if (SKIP_AGENTS.has(row.agent)) continue;

    const list = byAgent.get(row.agent) ?? [];
    if (list.length < TOP_N) {
      const exampleTexts: string[] = [];
      if (row.examples) {
        for (const chunk of row.examples.split("|||")) {
          try {
            const parsed = JSON.parse(chunk);
            if (Array.isArray(parsed)) {
              for (const v of parsed.slice(0, 2)) {
                exampleTexts.push(typeof v === "string" ? v.slice(0, 120) : String(v).slice(0, 120));
              }
            }
          } catch {
            if (chunk.trim()) exampleTexts.push(chunk.trim().slice(0, 120));
          }
          if (exampleTexts.length >= 3) break;
        }
      }

      list.push({
        convention: row.convention,
        count: row.violations,
        total: row.total,
        rate: row.violations / row.total,
        examples: exampleTexts.slice(0, 3),
      });
    }
    byAgent.set(row.agent, list);
  }

  const agentsWithViolations: AgentViolations[] = [];
  for (const [agent, violations] of byAgent) {
    agentsWithViolations.push({
      agent,
      sessionCount: violations.reduce((sum, v) => sum + v.total, 0),
      violations,
    });
  }

  // Sort by total violations descending
  agentsWithViolations.sort((a, b) => {
    const aTotal = a.violations.reduce((s, v) => s + v.count, 0);
    const bTotal = b.violations.reduce((s, v) => s + v.count, 0);
    return bTotal - aTotal;
  });

  return {
    agentsWithViolations,
    totalAgentsScanned: allAgents.size,
    lookbackHours: LOOKBACK_MS / 3_600_000,
    scanTimestamp: new Date().toISOString(),
  };
}

// ── Format scan results for LLM judge ─────────────────────────────────

function formatViolationReport(scan: ScanResult): string {
  const lines: string[] = [
    `# Convention Violation Scan — ${scan.scanTimestamp}`,
    ``,
    `Scanned ${scan.totalAgentsScanned} agents over last ${scan.lookbackHours}h.`,
    `Found ${scan.agentsWithViolations.length} agents with significant violations.`,
    ``,
  ];

  for (const av of scan.agentsWithViolations) {
    lines.push(`## Agent: ${av.agent}`);
    for (const v of av.violations) {
      const rateStr = (v.rate * 100).toFixed(0) + "%";
      lines.push(`- **${v.convention}**: ${v.count}/${v.total} sessions (${rateStr} violation rate)`);
      if (v.examples.length > 0) {
        lines.push(`  Examples: ${v.examples.join("; ")}`);
      }
    }
    lines.push(``);
  }

  return lines.join("\n");
}

// ── Workflow Definition ───────────────────────────────────────────────

export const name = "coaching-feedback";

export const description: string =
  "Sensor-judge workflow: JS scans convention violations (zero LLM cost), " +
  "Coach LLM decides intervention strategy (cost only when patterns need coaching).";

export async function execute(ctx: WorkflowContext): Promise<void> {
  // Resolve persist dir from known location
  const persistDir = join(process.cwd(), ".state");

  // ── Step 1: Sensor — scan convention violations (zero LLM cost) ──

  const sensorResult = await ctx.runFunction("scan-violations", async () => {
    const scan = scanViolations(persistDir);

    // Short-circuit: no significant violations
    if (scan.agentsWithViolations.length === 0) {
      return JSON.stringify({
        shortCircuit: true,
        message: `Clean scan — no significant violations across ${scan.totalAgentsScanned} agents in last ${scan.lookbackHours}h.`,
      });
    }

    return JSON.stringify({
      shortCircuit: false,
      report: formatViolationReport(scan),
      summary: {
        agentCount: scan.agentsWithViolations.length,
        agents: scan.agentsWithViolations.map(a => ({
          name: a.agent,
          topViolation: a.violations[0]?.convention,
          violationCount: a.violations.reduce((s, v) => s + v.count, 0),
        })),
      },
    });
  });

  // Parse sensor output
  const sensorText = sensorResult.lastAssistantText ?? "";
  let parsed: { shortCircuit: boolean; message?: string; report?: string; summary?: { agentCount: number } };
  try {
    parsed = JSON.parse(sensorText);
  } catch {
    ctx.done(`Sensor produced unparseable output: ${sensorText.slice(0, 200)}`);
    return;
  }

  // Short-circuit: clean scan
  if (parsed.shortCircuit) {
    ctx.done(parsed.message ?? "No violations found.");
    return;
  }

  // ── Step 2: Judge — Coach LLM decides intervention strategy ──

  const judgeTask = [
    `[coaching-feedback] Convention violation analysis`,
    ``,
    `You're reviewing convention violations detected by the automated scanner.`,
    `For each agent with violations, decide the best intervention:`,
    ``,
    `Options:`,
    `1. **skill-update**: Write or update a skill file in the agent's skills/ directory`,
    `2. **gym-scenario**: Design a gym scenario to train this specific behavior`,
    `3. **soul-edit**: Suggest a SOUL.md or heartbeat.md edit to reinforce the convention`,
    `4. **skip**: The violations are noise or already being addressed`,
    ``,
    `For each agent, write your recommendation as a structured message.`,
    `If you choose skill-update or soul-edit, make the edit directly.`,
    `If you choose gym-scenario, write the design to agents/coach/workspace/.`,
    ``,
    `## Violation Report`,
    ``,
    parsed.report ?? "(no report)",
    ``,
    `## Guidelines`,
    `- Focus on the highest-rate violations (>50% rate = serious)`,
    `- Skip agents that are already improving (check recent sessions)`,
    `- Prefer lightweight interventions (skill > gym > soul edit)`,
    `- Maximum 2 interventions per cycle to avoid overload`,
  ].join("\n");

  await ctx.runAgent("coach", judgeTask);

  ctx.done(`Coaching feedback cycle complete. Analyzed violations for ${parsed.summary?.agentCount ?? "?"} agents.`);
}
