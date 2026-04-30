# Design: Agent Role Metrics

**Status**: draft
**Date**: 2026-04-30

## Principle: Balanced Pairs

Every agent gets at least 2 metrics on **different dimensions** to prevent single-metric gaming:

```
Activity metric  →  "Are you doing the work?"
Impact metric    →  "Is the work making a difference?"
```

Without both, agents optimize pathologically:
- Scout writes 20 posts nobody reads (activity without impact)
- Optimizer kills sessions to save cost (efficiency without output)
- Coach runs sessions that change nothing (motion without learning)

## Metric Definitions

### May — Coordinator
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `may.dispatch-rate-6h` | Work dispatched (6h) | Activity | `SELECT COUNT(*) as c FROM sessions WHERE source LIKE 'workflow%' AND startedAt > {6h_ago}` | 8 | 2 | < |
| `may.stuck-resolution-h` | Avg hours to unblock projects | Impact | `SELECT AVG((resolved_at - created_at)/3600000.0) as c FROM events WHERE event_type='project.unblocked' AND timestamp > {7d}` | 4 | 12 | > |
| `may.agent-dark-count` | Agents with 0 sessions in 8h | Health | count agents with no session | 0 | 2 | > |

**Balance:** Dispatching lots of work is pointless if blocks persist. Both metrics must be green.

---

### Bob — Architect
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `bob.experiments-active` | Experiments in progress | Activity | `source_command: find agents/shared/knowledge/experiments -name 'design.md' -newer agents/shared/knowledge/experiments/EXP-001 ! -path '*results*' | wc -l` | 2 | 0 | < |
| `bob.experiments-validated` | Experiments with measured outcome (30d) | Impact | count EXP-*/results.md with mtime in last 30d | 2 | 0 | < |
| `bob.hypotheses-lifespan-d` | Avg days hypotheses stay untested | Staleness | mtime of H-*.md files without corresponding EXP-* | 14 | 30 | > |

**Balance:** Starting experiments is easy; finishing them with validated results is what matters.

---

### Coach — Trainer
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `coach.sessions-7d` | Coaching sessions (7d) | Activity | `SELECT COUNT(*) as c FROM sessions WHERE agent='coach' AND startedAt > {7d_ago}` | 8 | 2 | < |
| `coach.skill-adoption-rate` | Skills referenced in agent sessions (7d) / total skills | Impact | ratio of skills that appear in recent session transcripts vs total SKILL.md files | 0.50 | 0.20 | < |
| `coach.lesson-to-behavior` | Agents whose quality improved after coaching | Impact | compare eval scores before/after coaching sessions | — | — | — |

**Balance:** Running coaching sessions that nobody applies = waste. Adoption rate reveals whether training translates to behavior.

---

### Scout — Researcher  
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `scout.findings-7d` | New findings/posts (7d) | Activity | `source_command: find agents/shared/knowledge/library/posts -name '*.md' -mtime -7 | wc -l` | 4 | 1 | < |
| `scout.findings-cited` | Findings referenced by other agents (30d) | Impact | count cross-references or events referencing scout findings | 3 | 0 | < |
| `scout.relevance-hit-rate` | Findings that led to hypothesis/experiment/change | Impact | count posts linked to H-*/EXP-* or cited in design docs | 0.30 | 0.10 | < |

**Balance:** Prolific research is useless if nobody acts on it. Citation/relevance metrics ensure scout produces actionable intelligence.

---

### Amy — XHS Researcher
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `amy.posts-7d` | XHS posts written (7d) | Activity | `source_command: find agents/shared/knowledge/library/posts -name 'HB-*' -mtime -7 | wc -l` | 4 | 1 | < |
| `amy.posts-actionable` | Posts that led to hypothesis or system insight (30d) | Impact | count posts referenced in hypotheses, experiments, or synthesis docs | 2 | 0 | < |

**Balance:** Writing about XHS trends is only valuable if insights connect back to our system's problems.

---

### Tech-lead — Builder
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `tech-lead.build-green` | Build passes (1=yes, 0=no) | Stability | `source_command: bun run bundle 2>&1 | grep -c 'compile' || echo 0` | 1 | 1 | < |
| `tech-lead.test-pass-rate` | Test pass percentage | Quality | parse vitest output | 0.98 | 0.90 | < |
| `tech-lead.regressions-7d` | Test failures introduced (7d) | Impact | count test failures that weren't there before | 0 | 2 | > |

**Balance:** Shipping code fast is fine; shipping code that breaks things is not. Build stability + regression count keeps both in check.

---

### Optimizer — Efficiency Engine
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `optimizer.session-waste-rate` | Sessions with >30 ops and no deliverable / total | Waste | `SELECT CAST(SUM(CASE WHEN opCount > 30 AND outcome IS NULL THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as c FROM sessions WHERE startedAt > {24h} AND status='done'` | 0.05 | 0.20 | > |
| `optimizer.work-output-24h` | Sessions producing deliverables (24h) | Output | `SELECT COUNT(*) as c FROM sessions WHERE status='done' AND outcome IS NOT NULL AND startedAt > {24h}` | 10 | 3 | < |
| `optimizer.ops-per-deliverable` | Avg ops per session that produced output | Efficiency | `SELECT AVG(opCount) as c FROM sessions WHERE status='done' AND outcome IS NOT NULL AND startedAt > {24h}` | 15 | 40 | > |

**Balance:** Reducing waste is good ONLY if output doesn't drop. If waste rate falls but output also falls → optimizer is just killing work.

---

### QA — Quality Guardian
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `qa.reviews-7d` | Review sessions (7d) | Activity | `SELECT COUNT(*) as c FROM sessions WHERE agent='qa' AND startedAt > {7d_ago}` | 5 | 1 | < |
| `qa.issues-caught` | Issues found before deploy (7d) | Impact | count sessions where QA output contains "FAIL"/"BUG"/"FIX" that led to a follow-up session | 3 | 0 | < |
| `qa.false-done-rate` | Projects closed then reopened (30d) | Impact | ratio | 0 | 0.15 | > |

**Balance:** Running reviews that always pass = rubber-stamping. QA must actually catch things. But too many false alarms is also bad (tracked via false-done being low = things don't get reopened).

---

### Evaluator — Scorer
| ID | Name | Dimension | Source | Target | Threshold | Alert |
|----|------|-----------|--------|--------|-----------|-------|
| `evaluator.evals-24h` | Evaluations completed (24h) | Activity | `SELECT COUNT(*) as c FROM evaluations WHERE created_at > {24h}` | 5 | 1 | < |
| `evaluator.eval-led-to-action` | Evaluations that triggered coaching/fix (7d) | Impact | count evals followed by coach session or agent fix within 24h | 2 | 0 | < |
| `evaluator.score-spread` | Score standard deviation (should not be ~0) | Calibration | `SELECT ... as c FROM evaluations WHERE created_at > {7d}` | 0.15 | 0.05 | < |

**Balance:** Evaluating lots of sessions is pointless if scores don't lead to improvement. Score spread prevents rubber-stamp (all 1.0) or all-fail (all 0.0).

---

## Heartbeat Integration

Each heartbeat should begin:

```markdown
## My Metrics
Check your metrics first. Breached = priority action.
- `agent.activity-metric`: Am I doing enough work?
- `agent.impact-metric`: Is my work making a difference?

If activity is low → do more work.
If activity is high but impact is low → work differently (quality over quantity).
If both are green → pick from questions below and push forward.
```

## How to Register

Agents self-register by INSERT (typically during heartbeat or via handler):

```sql
INSERT OR IGNORE INTO metrics (id, name, owner, source_query, target, threshold, alert_op, type, status, speed, unit, created_at, updated_at)
VALUES ('scout.findings-7d', 'Scout findings (7d)', 'scout',
  'source_command here or SQL here', 4, 1, '<', 'domain', 'active', 'daily', 'count', unixepoch()*1000, unixepoch()*1000);
```

The `metrics-snapshot` handler automatically evaluates `source_query` or `source_command` every 5 minutes and records values.

## Anti-Gaming Summary

| Agent | If they game activity metric... | Impact metric catches it |
|-------|--------------------------------|--------------------------|
| Scout | Writes 20 shallow posts | findings-cited stays at 0 |
| Coach | Runs sessions that teach nothing | skill-adoption-rate stays low |
| Optimizer | Kills sessions to "save cost" | work-output-24h drops |
| QA | Rubber-stamps reviews | false-done-rate rises |
| Evaluator | Scores everything 1.0 | score-spread too low |
| May | Dispatches but doesn't follow up | stuck-resolution-h rises |
| Bob | Starts experiments without finishing | experiments-validated stays 0 |
| Amy | Writes posts disconnected from system | posts-actionable stays 0 |
| Tech-lead | Ships fast without testing | regressions-7d rises |
