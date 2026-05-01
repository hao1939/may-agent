# Deliverables Checklist

## Task: Context-trimming project - Iteration 12 (project complete, produce regression guard)

| # | Deliverable | Status | Path |
|---|------------|--------|------|
| 1 | Regression guard script | DONE | /app/agents/shared/projects/outputs/regression-guard.sh |

## Notes
- Project was already complete (all metrics at target). Produced a regression guard script as the only remaining useful artifact.
- Script validates all SOUL.md files < 600w and context.md files < 450w.
- All in-scope agents pass; only out-of-scope dirs (.lab, gym, _archetypes) show violations.
