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

## Summary Table

| Metric | Current Value | Target | Status |
|--------|--------------|--------|--------|
| `workflow.pass-rate` | 100% (10/10) | 100% | ✅ Met |
| `skill.verified-rate` | 0% (0/18) | >50% | ❌ Not started |

## Notes

- `workflow.pass-rate` at 100% means all workflows are structurally sound (no import errors). This does not guarantee correctness under real execution.
- `skill.verified-rate` at 0% is expected — no skills have gone through a deploy+measure cycle yet. This is the key gap for Phase 3.
