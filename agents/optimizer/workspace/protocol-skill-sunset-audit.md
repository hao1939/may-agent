# Protocol: Skill Sunset Audit

**Version**: 1.0
**Date**: 2026-04-13
**Cadence**: Every 2 weeks (biweekly)
**Owner**: Optimizer (runs audit), Coach (validates gym results), May (approves removals)
**Motivation**: KE-122 (interventions become redundant through internalization) + KE-123 (stacking interventions degrades performance) + KE-025 (more context hurts performance)

---

## Purpose

Skills are deployed to improve agent behavior, but they are never removed. Over time this creates:
1. **Over-intervention risk** (KE-123) — stacked skills interfere destructively
2. **Context overhead** (KE-025) — each skill file consumes tokens that dilute attention
3. **Dead weight** — internalized skills (KE-122) provide zero lift but still cost tokens

This protocol provides a lightweight, repeatable process to identify and remove skills that have outlived their usefulness.

---

## When to Run

- **Regular cadence**: Every 2 weeks (1st and 15th of each month)
- **Triggered**: After any new skill deployment (run 2 weeks after deployment to check for internalization)
- **Ad hoc**: When an agent enters "red zone" (>5 behavioral skills or >30 total intervention points)

---

## Pre-Audit Data Collection (15 minutes)

Before running the checklist, gather these data points:

### 1. Skill Inventory
```bash
# List all agent skill files with sizes
for agent in bob coach may scout qa tech-lead evaluator coder optimizer; do
  echo "=== $agent ==="
  ls -la agents/$agent/skills/ 2>/dev/null
done
```

### 2. Convention Check Pass Rates (last 14 days)
```javascript
// Run via: bun -e "<this script>"
import { Database } from 'bun:sqlite';
const db = new Database('.state/may.db', { readonly: true });
const rows = db.query(`
  SELECT agent, convention, 
    COUNT(*) as total,
    SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
    ROUND(100.0 * SUM(CASE WHEN passed THEN 1 ELSE 0 END) / COUNT(*), 1) as rate
  FROM convention_checks 
  WHERE timestamp > datetime('now', '-14 days')
  GROUP BY agent, convention
  ORDER BY agent, convention
`).all();
console.table(rows);
```

### 3. Gym Baseline Measurement (if removing a skill)
Before removing any skill, run 3 baseline trials on related scenarios:
```bash
scripts/gym-run.sh <related-scenario> --agent <agent-name>
```
Record the baseline score. After removal, re-run to confirm no regression.

---

## Audit Checklist

For each agent, evaluate each deployed skill against these 5 criteria. A skill is a **sunset candidate** if it triggers ≥2 criteria.

### Criterion 1: Internalization (KE-122)
**Question**: Has the agent internalized this behavior — does it exhibit the skill's target behavior even without the skill file?

**How to check**:
- Look at convention check pass rates for the relevant behavior (C1.1 for read-before-edit, C1.3 for verify-after-edit, C1.7 for verify-before-finish)
- If pass rate is >95% for the last 14 days → behavior is likely internalized
- If pass rate was always >95% since deployment → skill may never have been needed

**Decision**:
- [ ] Pass rate >95% sustained for 14+ days → **SUNSET CANDIDATE**
- [ ] Pass rate <95% or fluctuating → **KEEP**
- [ ] No convention check exists for this skill → **CANNOT EVALUATE** (flag for measurement gap)

### Criterion 2: Overlap (KE-123)
**Question**: Does this skill overlap with another deployed skill, a context.md item, or a SOUL.md instruction?

**How to check**:
- Read the skill's target behavior (what it teaches the agent to do)
- Search context.md for lines addressing the same behavior: `grep -i "<keyword>" agents/<agent>/context.md`
- Search other skill files for the same behavior
- Check the Overlap Matrix (see finding-over-intervention-audit-0413.md)

**Decision**:
- [ ] ≥1 other intervention covers the same behavior → **SUNSET CANDIDATE** (remove the weaker/redundant one)
- [ ] Unique behavior, no overlap → **KEEP**

### Criterion 3: Measurable Lift
**Question**: Did this skill produce measurable improvement when deployed?

**How to check**:
- Check LIBRARY.md status for the skill (`agents/shared/skills/LIBRARY.md`)
- Look for gym experiment results in `agents/shared/knowledge/experiments/`
- Check convention check trends before/after deployment

**Decision**:
- [ ] Gym-proven with >10pp lift → **KEEP**
- [ ] Deployed but no measurable lift (⚠️ status in LIBRARY.md) → **SUNSET CANDIDATE**
- [ ] Never tested → **SUNSET CANDIDATE** (unless role-critical procedure)
- [ ] Gym-disproven (❌ status) → **IMMEDIATE REMOVE**

### Criterion 4: Age Without Review
**Question**: How long has this skill been deployed without being re-evaluated?

**How to check**:
```bash
# Check file modification dates
ls -la agents/<agent>/skills/<skill>.md
# Check git log for last meaningful update
cd agents && git log --oneline -5 -- <agent>/skills/<skill>.md
```

**Decision**:
- [ ] Deployed >30 days with no review or update → **SUNSET CANDIDATE**
- [ ] Reviewed/updated within 30 days → **KEEP**
- [ ] Created >60 days ago and never updated → **STRONG SUNSET CANDIDATE**

### Criterion 5: Token Cost vs. Value
**Question**: Is this skill's token cost justified by its impact?

**How to check**:
```bash
wc -c agents/<agent>/skills/<skill>.md   # bytes
wc -w agents/<agent>/skills/<skill>.md   # words (~tokens × 0.75)
```

**Decision**:
- [ ] >5KB file with no gym evidence → **SUNSET CANDIDATE** (high cost, unproven value)
- [ ] <1KB file with clear trigger → **KEEP** (low cost even if unproven)
- [ ] Any size with gym-proven lift → **KEEP**

---

## Scoring and Action

For each skill, count how many criteria flagged it as a "SUNSET CANDIDATE":

| Score | Action |
|-------|--------|
| 0 | ✅ Keep — no action needed |
| 1 | ⚪ Watch — note it, re-evaluate next cycle |
| 2 | 🟡 Test removal — run gym baseline, remove skill, re-run gym. Restore if regression detected |
| 3+ | 🔴 Remove — high confidence this skill is dead weight. Remove and monitor convention checks for 1 week |

### Removal Process

1. **Record pre-removal state**: Note convention check pass rates for relevant behaviors
2. **Move file** (don't delete): `mv agents/<agent>/skills/<skill>.md agents/shared/skills/archive/<agent>-<skill>.md`
3. **Monitor for 7 days**: Check convention check pass rates daily
4. **If regression detected** (pass rate drops >5pp): Restore the skill immediately
5. **If stable**: Delete the archived file after 14 days

---

## Audit Output Template

After running the checklist, write results to:
`agents/optimizer/workspace/finding-skill-sunset-audit-MMDD.md`

Use this template:

```markdown
# Skill Sunset Audit — [Date]

## Inventory
| Agent | Skills | Context items | Total | Status |
|-------|--------|--------------|-------|--------|
| bob   | N      | N            | N     | 🔴/🟡/🟢 |

## Per-Skill Assessment
### [Agent] / [Skill Name]
- Internalization: [PASS/KEEP/N/A] — [evidence]
- Overlap: [CANDIDATE/KEEP] — [overlapping item]
- Lift: [PROVEN/UNPROVEN/DISPROVEN] — [evidence]
- Age: [N days since deployment/update]
- Token cost: [N bytes] — [justified/unjustified]
- **Score: N/5 → [ACTION]**

## Actions Taken
- [ ] Removed: [skill] from [agent] — reason: [...]
- [ ] Archived: [skill] — reason: [...]
- [ ] Flagged for gym test: [skill] — reason: [...]

## Measurement Gaps
- Skills without convention checks: [list]
- Skills without gym scenarios: [list]
```

---

## Connection to Broader System

This protocol completes the **KE-122 internalization lifecycle**:

```
Experiment → Deploy → Internalize → Sunset (THIS PROTOCOL) → Archive
   (1)        (2)        (3)             (4)                    (5)
```

Without step (4), the lifecycle is incomplete — skills accumulate without limit, triggering KE-123 (over-intervention) and KE-025 (instruction overhead).

### Integration Points
- **Coach** validates gym results when removal requires testing
- **May** approves removals that affect agent behavior (final sign-off)
- **Optimizer** runs the audit and writes the finding
- **LIBRARY.md** (`agents/shared/skills/LIBRARY.md`) is updated with status changes
- **Convention checks** provide the continuous monitoring data that feeds Criterion 1

### Guardrails
- **Never remove gym-proven skills without regression testing** — even if internalized, the gym is the ground truth
- **Never remove code-enforced skills** (Channel 1) — these are structural, not behavioral text
- **One removal at a time** — if removing 3 skills, space them 1 week apart to isolate effects
- **Always archive, never delete** — archived skills can be restored in <1 minute if regression detected

---

## First Audit Actions (from 2026-04-13 findings)

Based on the concurrent over-intervention audit (`finding-over-intervention-audit-0413.md`):

| Priority | Action | Agents | Risk |
|----------|--------|--------|------|
| P0 | Remove KE-093 line from Operational Knowledge block for agents that have `evidence-over-narrative.md` | bob, coach, optimizer, scout, tech-lead | Low (skill file is more comprehensive) |
| P1 | Remove bob's `verify-context-claims.md` (subsumed by `evidence-over-narrative.md`) | bob | Low (redundant) |
| P1 | Delete bob's `knowledge-base-navigation.md.backup-exp095` | bob | Zero (dead file) |
| P2 | Remove optimizer's `batch-processing.md` | optimizer | Low (generic, no evidence) |
| P2 | Test-remove scout's `search-governance.md` (28+ days old) | scout | Medium (run gym first) |
| P3 | Audit may's 40 context.md items | may | Medium (requires line-by-line review) |
