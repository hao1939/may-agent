# Design: Heartbeat System

**Status:** Draft
**Date:** 2026-04-21
**References:** [core-principles.md](core-principles.md), [project-system.md](project-system.md)

## What is a Heartbeat?

The agent's autonomous time. They wake up, see their domain, judge what needs attention, act. This is where ownership happens — agents check their metrics, review their projects, and do their role-specific work.

## Current Problems

- Trigger chain too long: cron → run-workflow handler (broken) → per-agent workflow → buildAgentHeartbeat() → 4 sessions
- 4 sessions per heartbeat = 4x startup cost, context doesn't carry between steps
- Agent wastes ops querying DB, reading files — should be pre-loaded
- No project accountability — agents don't check their projects
- Op budget is artificial constraint
- Shared buildAgentHeartbeat() prevents per-agent evolution

## Design

### One workflow per agent

Each agent has their own heartbeat workflow. Independent. Evolves separately.

```
agents/may/workflows/may-heartbeat.ts
agents/bob/workflows/bob-heartbeat.ts
agents/coach/workflows/coach-heartbeat.ts
agents/optimizer/workflows/optimizer-heartbeat.ts
agents/scout/workflows/scout-heartbeat.ts
agents/tech-lead/workflows/tech-lead-heartbeat.ts
agents/qa/workflows/qa-heartbeat.ts
```

No shared factory. Copy/paste to start, customize as the agent evolves.

### Trigger

```
cron (30 min) → run-workflow handler → agent's heartbeat workflow
```

```json
{
  "name": "heartbeat-may",
  "handler": "run-workflow",
  "handlerConfig": { "workflow": "may-heartbeat", "agent": "may" },
  "intervalMs": 1800000
}
```

run-workflow handler must be fixed (RuntimeCtx, no src/ imports).

### One session per heartbeat

The workflow pre-loads all context in JS, then runs ONE agent session with everything the agent needs.

```
Workflow executes:
  1. Load metrics from DB          (JS, no LLM ops)
  2. Load projects from files      (JS, no LLM ops)
  3. Load alerts from DB           (JS, no LLM ops)
  4. Read heartbeat.md             (JS, no LLM ops)
  5. Build prompt with all context
  6. Run ONE agent session         (agent observes, decides, acts)
```

The agent gets a single prompt with:
- Their metrics (current values, targets, alerts)
- Their projects (status, health, resume conditions for paused projects)
- Their role guidance (from heartbeat.md)

The agent focuses on judgment and action, not data gathering.

### Prompt structure

```
## Your Metrics
📊 coder.quality: 0.72 (target > 0.7) ✅
📊 coach.skill-effectiveness: 29% (target > 60%) ⚠️ BELOW TARGET
→ Quick check: query gym results for recent skill experiments

## Active Alerts
⚠️ coach.skill-effectiveness below threshold (29% < 60%) — 3 days unresolved

## Your Projects
| Project | Status | Health | Next |
|---------|--------|--------|------|
| agent-autonomy | paused | 7/10 | Resume when: HPR data available after 2-3 days |
| reviewer-effectiveness | active | — | Milestone: redesign reviewer prompt |

## Your Role
{content of heartbeat.md}

---

You are {agent} waking up for your heartbeat. Review your metrics, check your projects, do your job. Act on what matters.
```

### heartbeat.md becomes role guidance

heartbeat.md no longer needs to tell the agent HOW to query data or WHAT steps to follow. The workflow handles that. heartbeat.md focuses on:

- What the agent's domain is
- What to look for (domain-specific concerns)
- How to prioritize (role-specific priority ladder)
- What to dispatch vs do inline
- Role-specific patterns and anti-patterns

Example for May:
```markdown
# May Heartbeat

You are Hao's Deputy — dispatch work, coordinate the team, keep things healthy.

## Your Domain
- System health (errors, stuck sessions, agent activity)
- Dispatch board (route work to the right agent)
- Accountability (ensure metric owners are acting on their metrics)
- Gatekeeper (flag system-scope changes for Hao)

## Priority
1. Red metrics / alerts → dispatch fix immediately
2. Pending requests from Hao → dispatch first
3. Active project work → check progress, unblock if needed
4. Proactive improvements → only if nothing above

## Patterns
- Fork deep work, don't investigate inline
- One board read + one edit max
- If an agent's metric is stale for 3+ days, nudge them
```

No bash queries. No op budgets. No step-by-step instructions. Just guidance the agent uses alongside the pre-loaded data.

### Per-agent workflow template

```typescript
/// <reference path="../../../src/lib/workflow-defs.d.ts" />

export const name = "may-heartbeat";
export const description = "May's heartbeat — triage, dispatch, system health.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "may";
  
  // Pre-load all context in JS (no LLM ops)
  const metrics = loadMetrics(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);

  const prompt = `
## Your Metrics
${metrics || "No metrics data available."}

## Active Alerts
${alerts || "None — all clear."}

## Your Projects
${projects || "No active projects."}

## Your Role
${guidance}

---

You are ${agent} waking up for your heartbeat. Review your metrics, check your projects, do your job. Act on what matters.
`;

  const result = await ctx.runAgent(agent, prompt);
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

// ── Data loaders (JS, no LLM ops) ──────────────────────────────

function loadMetrics(ctx: WorkflowContext, agent: string): string {
  try {
    const db = ctx.getDb();
    const rows = db.prepare(
      "SELECT id, current, target, threshold, alert_direction FROM metrics WHERE owner = ? AND status = 'active'"
    ).all(agent);
    if (!rows.length) return "";
    return (rows as any[]).map(r => {
      const breached = r.threshold != null && r.current != null &&
        (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);
      return `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${breached ? "⚠️ BELOW TARGET" : "✅"}`;
    }).join("\n");
  } catch { return ""; }
}

function loadProjects(ctx: WorkflowContext, agent: string): string {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const projDir = path.join(ctx.agentsRoot, agent, "workspace", "projects");
    if (!fs.existsSync(projDir)) return "";
    const lines: string[] = [];
    for (const entry of fs.readdirSync(projDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pFile = path.join(projDir, entry.name, "project.md");
      if (!fs.existsSync(pFile)) continue;
      const content = fs.readFileSync(pFile, "utf-8");
      const status = content.match(/^\*\*Status\*\*:\s*(\S+)/m)?.[1] ?? "?";
      const health = content.match(/^\*\*Health\*\*:\s*(.+)/m)?.[1] ?? "—";
      const msX = (content.match(/^- \[x\]/gim) || []).length;
      const msT = msX + (content.match(/^- \[ \]/gm) || []).length;
      if (status === "done" || status === "complete") continue; // skip done
      lines.push(`- **${entry.name}**: ${status} | health: ${health} | milestones: ${msX}/${msT}`);
    }
    return lines.join("\n") || "No active projects.";
  } catch { return ""; }
}

function loadAlerts(ctx: WorkflowContext, agent: string): string {
  try {
    const db = ctx.getDb();
    const rows = db.prepare(
      "SELECT metric_id, severity, message FROM metric_alerts WHERE resolved_at IS NULL AND metric_id LIKE ?"
    ).all(`${agent}.%`);
    if (!rows.length) return "";
    return (rows as any[]).map(r => `⚠️ ${r.metric_id}: ${r.message}`).join("\n");
  } catch { return ""; }
}

function loadHeartbeatMd(ctx: WorkflowContext, agent: string): string {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    return fs.readFileSync(path.join(ctx.agentsRoot, agent, "heartbeat.md"), "utf-8");
  } catch { return "(No heartbeat.md found)"; }
}
```

### What changes

| From | To |
|------|----|
| Shared buildAgentHeartbeat() factory | Per-agent workflow file (independent) |
| 4 sessions per heartbeat | 1 session per heartbeat |
| Agent queries DB for metrics | Workflow pre-loads in JS |
| Agent scans for projects | Workflow pre-loads in JS |
| heartbeat.md = step-by-step instructions | heartbeat.md = role guidance |
| Op budget ≤12 | No budget — agent uses judgment |
| No project accountability | Projects injected into every heartbeat |

### Migration

1. Fix run-workflow handler (RuntimeCtx)
2. Rewrite each per-agent heartbeat workflow (7 files, copy/paste template + customize)
3. Simplify heartbeat.md files (remove query instructions, op budget, step numbering)
4. Remove shared agent-heartbeat.ts and heartbeat.ts (after all agents migrated)
5. Remove buildAgentHeartbeat() 

### Alignment

| Principle | How |
|-----------|-----|
| P1: Events | Heartbeat is a timer event. Can also subscribe to other events. |
| P2: Ownership | Agent sees their metrics + projects every heartbeat. Accountability built in. |
| P3: Consumed | Metrics/alerts always visible — can't be missed. |
| P9: Convention | Per-agent workflow at `agents/<name>/workflows/<name>-heartbeat.ts` |
| P10: Simple | 1 workflow file, 1 session, pre-loaded context. No shared factory. |
