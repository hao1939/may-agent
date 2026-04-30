# Design: System & Agent Metrics

**Status**: revised
**Date**: 2026-04-30 (revised 2026-07-02)

## Architecture: Two Layers

```
System Metrics (8)     — "Is the system healthy and producing value?"
  → Measured automatically by metrics-snapshot handler
  → Owned by may, visible to all agents
  → Defined in this doc

Project Metrics (per-project) — "Is this agent's work effective?"
  → Defined in each project.md
  → Owned by project owner
  → Use Balanced Pairs principle (below)
```

**System metrics answer: "Should Hao be worried?"**
**Project metrics answer: "Is this project improving?"**

---

## System Metrics (8)

### Handler Health (4)
Already implemented and measured:

| ID | Name | What it answers | Threshold | Alert |
|----|------|-----------------|-----------|-------|
| `handler.success-rate` | Handler success ratio (6h) | "Are agents completing work?" | > 0.80 | < |
| `handler.heartbeat-coverage` | Distinct agents with heartbeat | "Is anyone dark?" | > 6 | < |
| `handler.p95-duration` | 95th percentile session duration (ms) | "Are sessions hanging?" | < 600000 | > |
| `handler.fires-per-hour` | Total handler fires | "Is the system active?" | > 15 | < |

### System Output (4)
The metrics that matter most:

| ID | Name | What it answers | Threshold | Alert |
|----|------|-----------------|-----------|-------|
| `system.real-output-24h` | Sessions with deliverables (24h) | "Is the system producing?" | > 10 | < |
| `project.iterations-24h` | Project iterations completed (24h) | "Are projects advancing?" | > 3 | < |
| `project.blocked-count` | Projects currently blocked | "Is work stuck?" | < 2 | > |
| `project.blocked-over-6h` | Projects blocked > 6 hours | "Are blocks being resolved?" | 0 | > |

These 8 metrics are the system's vital signs. If all 8 are green, the system is healthy. If any are red, that's the priority.

---

## Balanced Pairs Principle

**For project-level metrics only.** Every project should track at least 2 metrics on different dimensions:

```
Activity metric  →  "Are you doing the work?"
Impact metric    →  "Is the work making a difference?"
```

Without both, agents optimize pathologically:
- Scout writes 20 posts nobody reads (activity without impact)
- Optimizer kills sessions to save cost (efficiency without output)
- Coach runs sessions that change nothing (motion without learning)

### How to Apply in Projects

Each `project.md` should define its own metrics. Examples:

**Skill & Workflow Quality (coach):**
- Activity: agents coached this iteration
- Impact: eval score improvement after coaching

**Evaluation Revival (coach):**
- Activity: evaluations completed per day
- Impact: coverage ratio (evals / sessions)

**Hao Alignment (may):**
- Activity: preference entries updated
- Impact: correction rate (Hao corrections / Hao interactions)

### Anti-Gaming Patterns

| If an agent games activity... | The impact metric catches it |
|-------------------------------|------------------------------|
| Writes 20 shallow posts | findings-cited stays at 0 |
| Runs coaching sessions that teach nothing | eval scores don't improve |
| Kills sessions to "save cost" | real-output-24h drops |
| Rubber-stamps reviews | false-done-rate rises |
| Scores everything 1.0 | score-spread too low |
| Dispatches but doesn't follow up | blocked-over-6h rises |
| Starts experiments without finishing | no validated results |

---

## Metric Lifecycle

Metrics evolve — meeting a target is not "done":

```
CREATE → MEASURE → ALERT → RAISE TARGET → ADD DIMENSIONS → GRADUATE
```

1. **Create** — define metric with initial target (in project.md or system metrics table)
2. **Measure** — snapshot handler records values automatically
3. **Alert** — breaches trigger heartbeat attention
4. **Raise target** — when target is met consistently, the bar should go up
5. **Add dimensions** — after activity is green, add quality/impact sub-metrics
6. **Graduate** — metric moves to passive monitoring (requires Hao approval)

**Key rule:** A metric at target is a signal that the bar is too low or the dimension is too narrow. Never coast.

---

## Heartbeat Integration

Each heartbeat should start by checking relevant metrics:

```markdown
## My Metrics
Check system health first. Breached = priority action.
- System metrics: any red? That's your #1 priority.
- Project metrics: defined in your project.md.

If activity is low → do more work.
If activity is high but impact is low → work differently.
If both are green → raise targets or add dimensions.
```

---

## How to Register Custom Metrics

For project-specific metrics, agents self-register:

```sql
INSERT OR IGNORE INTO metrics (id, name, owner, source_query, target, threshold, alert_op, type, status, speed, unit, created_at, updated_at)
VALUES ('project.skill-adoption', 'Skill adoption rate', 'coach',
  'SELECT ...', 0.50, 0.20, '<', 'domain', 'active', 'daily', 'ratio',
  unixepoch()*1000, unixepoch()*1000);
```

The `metrics-snapshot` handler automatically evaluates `source_query` or `source_command` every 5 minutes and records values.

---

## What This Doc Does NOT Cover

- **Per-agent metric definitions** — those belong in each project's `project.md`
- **Metric snapshot infrastructure** — see `agents/shared/may-agent-docs/metrics.md`
- **Alert routing** — see metric-alert-reactor handler
