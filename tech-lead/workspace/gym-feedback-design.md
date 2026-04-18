# Gym as Fast Feedback for Tech-Lead Metrics

**Date:** 2026-04-16 | **Status:** Draft

## 1. Mapping Gym to My Metrics

| Metric | What gym can test | Fast signal? |
|--------|------------------|--------------|
| `build-health` | Scenarios where coder must leave tsc clean after changes | Yes — run post-edit tsc check scenarios |
| `meaningful-changes` | Hard to gym-test — "meaningful" is qualitative | No — production-only |
| `codebase-weight` | Scenarios testing refactor discipline (bloated-refactor, unnecessary-refactor-trap, harmful-refactor) | Partial — tests restraint, not LOC |
| `delegation-quality` | delegation-scope-boundary, delegation-verify-pattern — test whether delegated tasks have clear scope and verification | Yes — core skill |

**Conclusion:** Gym is useful for delegation-quality and build-health. Meaningful-changes and codebase-weight are production metrics that need real codebase context.

## 2. Relevant Scenarios for Engineer Role

Directly relevant (test engineering judgment):
- `delegation-scope-boundary` / `delegation-verify-pattern` — delegation craft
- `bloated-refactor` / `harmful-refactor` / `unnecessary-refactor-trap` — refactor discipline
- `build-activation-gap` / `context-proof-build` — build/integration awareness
- `sql-injection-in-query-builder` — security-aware code review
- `ambiguous-context-drift-*` — staying on task under ambiguity

Less relevant: recognition/baseline scenarios, behavior-escalation (coach territory).

## 3. How Gym Results Should Feed Into Metrics

They shouldn't feed directly. Per KE-053, gym-production gap is structural — gym success doesn't predict production performance. Instead:

- **Use gym for regression detection**: If delegation scenarios start failing after a context.md change, that's a signal.
- **Use gym for intervention testing**: Before adding a new delegation heuristic to context.md, run 10 trials to check it doesn't regress other scenarios.
- **Don't use gym scores as metric values**: `delegation-quality` should measure real coder first-pass rates from production, not gym pass rates.

## 4. 295 Scenarios at 36% Pass Rate

Per KE-010, most scenarios hit ceiling at baseline — the 36% aggregate hides bimodal distribution (some always pass, some always fail). Recommendations:

1. **Triage into tiers**: (a) always-pass → archive or use as regression canaries, (b) discriminating → keep and use, (c) always-fail → investigate if scenario is valid or broken
2. **Fix broken scenarios first**: Some failures may be scenario bugs, not agent bugs. A scenario with 0% pass across all agents is suspect.
3. **Focus on discrimination rate** (per approved metric `gym.scenario-discrimination`): A scenario that passes 30-70% of the time gives real signal. One at 0% or 100% gives none.
4. **Don't try to "fix" the 36%**: That would be Goodhart's Law. Fix the agents and the scenarios; the number follows.

## 5. Fast Feedback Loop for Engineer Role

```
Code change → tsc --noEmit (10s) → vitest (30s) → gym scenario (2min) → ship
```

Concretely for my workflow:
1. **Edit context.md or delegation template** — the intervention
2. **Run 2-3 targeted gym scenarios** (10 trials each, ~20 min) — fast signal on whether the change helps/hurts
3. **Check production metrics next heartbeat** — did real delegation-quality improve?
4. **Iterate or revert** — if gym said yes but production says no, the intervention targeted gym-specific patterns (KE-053)

The key insight: gym is a **smoke test**, not a **proof**. It catches regressions and obvious failures fast. Production metrics are the real scorecard. Don't over-invest in gym optimization — it's a 20-minute sanity check, not a development target.
