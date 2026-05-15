# Audit Metrics

**Date:** 2025-01-27

## Metric Definitions

### 1. `workflow.pass-rate`

**Definition:** Percentage of shared workflows that load/execute without errors.

**Formula:** `(workflows passing load test / total workflows) × 100`

**Current Value:** **100%** (10/10)

**Data Source:** `outputs/workflows-runtest.md` — dynamic import test of all 10 files in `/app/agents/shared/workflows/*.ts`

**How to Re-measure:**
```bash
pass=0; total=0
for f in /app/agents/shared/workflows/*.ts; do
  total=$((total + 1))
  timeout 10 npx tsx -e "import('file://$f').then(m => console.log('OK')).catch(e => { console.error('FAIL'); process.exit(1) })" 2>/dev/null && pass=$((pass + 1))
done
echo "workflow.pass-rate = $pass / $total = $(( pass * 100 / total ))%"
```

---

### 2. `skill.verified-rate`

**Definition:** Percentage of shared skills that have measured positive impact (deployed, used by agents, and confirmed to improve outcomes).

**Formula:** `(skills with verified positive impact / total skills) × 100`

**Current Value:** **0%** (0/18)

**Data Source:** `outputs/skills-audit.md` — 18 skill files inventoried. None have been deployed with before/after measurement of agent performance.

**How to Re-measure:**
1. For each skill in `/app/agents/shared/skills/`, check if any agent's configuration references it.
2. For referenced skills, check if there are logs/metrics showing improvement after adoption.
3. Count skills meeting both criteria as "verified."

---

### 3. `skill.usage-rate`

**Definition:** Percentage of top deployed shared skills that show evidence of being referenced or applied in actual agent work (sessions, state, context).

**Formula:** `(skills with evidence of usage / skills checked) × 100`

**Current Value:** **0%** (0/10)

**Data Source:** `outputs/skill-usage.md` — Searched agent `.state/`, `sessions/`, and `context.md` for references to the top 10 most-deployed skills. No evidence found.

**How to Re-measure:**
```bash
# For each skill name, search agent dirs (excluding skills/ itself) for references
for skill in evidence-over-narrative verification state-check-before-action plan-once-amend obstacle-pivot know-when-blocked reading-metrics creating-projects closing-the-loop prerequisite-gap-protocol; do
  rg -l "$skill" /app/agents/{amy,bob,coder,coach,evaluator,optimizer,qa,scout,tech-lead,may}/.state/ 2>/dev/null
done
```

---

## Summary Table

| Metric | Current Value | Target | Status |
|--------|--------------|--------|--------|
| `workflow.pass-rate` | 100% (10/10) | 100% | ✅ Met |
| `skill.verified-rate` | 20% (1/5 top skills) | >50% | 🔶 In progress |
| `skill.usage-rate` | 0% (0/10) | >50% | 🔴 No evidence of usage |

## Notes

- `workflow.pass-rate` at 100% means all workflows are structurally sound (no import errors). This does not guarantee correctness under real execution.
- `skill.verified-rate` updated to 20%: `obstacle-pivot` has measured positive impact via gym data (help-blocked-agent: 0% → 100% pass rate between gym runs). See `skills-impact.md` Appendix A for full before/after data.
- Remaining 4 top skills (error-handling, state-check-before-action, coder-edit-discipline, delegation-verification) need deploy+measure cycles.
