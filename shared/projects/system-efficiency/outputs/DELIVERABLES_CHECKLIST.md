# DELIVERABLES_CHECKLIST

## Task: Exclude gym scenarios from vitest

| # | Deliverable | Status | Path |
|---|-------------|--------|------|
| 1 | vitest.config.ts exclude list | DONE | `/app/agents/vitest.config.ts` — added `exclude: ["gym/**", "node_modules/**", "shared/projects/outputs/**"]` |
| 2 | regression-guard.sh fix | DONE | `outputs/regression-guard.sh` — changed `cd /app` → `cd /app/agents`, threshold 1500→500 |
| 3 | vitest-gym-exclusion-fix.md report | DONE | `outputs/vitest-gym-exclusion-fix.md` — documents problem, finding, fix, recommendation |
