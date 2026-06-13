# Workflow Runtime Audit

**Generated**: 2025-01-13
**Source**: `agents/shared/workflows/REGISTRY.md`, workflow run files, sessions DB

## Summary

- **Active shared workflows**: 3 (project, implement-and-verify, verify-wrap)
- **Agent-specific workflows**: 5 (growth-cycle, gym-helpers, training-sprint, investigate-and-fix, verified-coder)
- **Heartbeat workflows**: 8 (one per agent)
- **Total DB-tracked runs**: 180
- **System workflow success rate**: 65-75% (varies by type)
- **Dead/archived workflows deleted**: 12+ (3,800+ lines recovered)

## Production Usage by Workflow

| Workflow | Location | Production Use? | Frequency | Runs (DB) | Success% | Known Failures |
|----------|----------|----------------|-----------|-----------|----------|----------------|
| `project` | shared/ | ✅ YES | High — core execution engine | N/A (meta) | N/A | None reported |
| `implement-and-verify` | shared/ | ✅ YES | High — "85% of all workflow usage" | 78 (as impl-and-review) | 65.4% | Verdict parsing (fixed), env limitations |
| `verify-wrap` | shared/ | ⚠️ UNCERTAIN | Unknown — EXP-138 experimental | 0 confirmed | N/A | No evidence of production runs |
| `growth-cycle` | coach/ | ✅ YES | Was 7-8/day, dropped to 0 after heartbeat rewrite | 88 (combined coach) | 70.5% | Collapsed when workflow.run() removed from heartbeat |
| `training-sprint` | coach/ | ✅ YES | Low (4 on-disk runs) | (included above) | 100% | None |
| `investigate-and-fix` | optimizer/ | ✅ YES | Low | 12 | 75.0% | None |
| `verified-coder` | tech-lead/ | ⚠️ MINIMAL | 1 known run | 1 | 100% | Insufficient data |
| Per-agent heartbeats (x8) | various | ✅ YES | Cron-driven, regular | Not tracked as workflows | N/A | None |

## Key Findings

### 1. Only 3 workflows see meaningful production use
- `implement-and-verify` (high volume, 65% success)
- `growth-cycle` (high volume when wired, 70% success)  
- `investigate-and-fix` (low volume, 75% success)

### 2. Workflow adoption is fragile
- **EXP-028 proved**: Removing `workflow.run()` from heartbeat instructions instantly killed all Coach workflow usage (7-8/day → 0)
- LLMs do NOT spontaneously discover or use workflows
- Explicit instructions in heartbeats are required

### 3. verify-wrap has no evidence of production use
- Created as EXP-138 experimental workflow
- No run files found, no DB entries confirmed
- 233 lines of potentially dead code

### 4. Cost efficiency is questionable
- **EXP-001**: Workflows cost 2.7x more per good outcome ($3.19 vs $1.19)
- BUT: Higher done rate (89% vs 76%) and lower error rate (2.6% vs 17.6%)
- Trade-off: reliability vs cost

### 5. implement-and-verify overhead
- **EXP-050**: Adds 1.76–3.78x duration overhead on medium-complexity tasks
- stateApproach() was removed as a result
- Shell verification is negligible (~130ms) but usually redundant

## Workflow Health Scores

| Workflow | Health | Rationale |
|----------|--------|-----------|
| `project` | 🟢 Healthy | Core engine, actively maintained |
| `implement-and-verify` | 🟡 Moderate | High use but 65% success rate, overhead concerns |
| `verify-wrap` | 🔴 Unknown | No production evidence, may be dead code |
| `growth-cycle` | 🟡 Fragile | Excellent when wired (100% on-disk), but adoption collapsed once |
| `training-sprint` | 🟢 Healthy | 100% success, low volume |
| `investigate-and-fix` | 🟢 Healthy | 75% success, serves its purpose |
| `verified-coder` | 🟡 Underused | Only 1 run, insufficient data |

## Recommendations

1. **Verify `verify-wrap` usage** — if no production evidence after 30 days, archive it (saves 233 lines)
2. **Monitor `implement-and-verify` success rate** — 65% is below the 80% target; investigate remaining failure modes
3. **Ensure heartbeat wiring is maintained** — single point of failure for workflow adoption (EXP-028 lesson)
4. **Consider archiving `verified-coder`** — 1 run in entire history suggests it's not needed alongside `implement-and-verify`
5. **Track workflow.pass-rate honestly** — current 1.0 metric is from synthetic test, not production reality (actual: 65-75%)

## Context Cost

| Category | Files | Est. Lines |
|----------|-------|-----------|
| Active shared workflows | 3 | ~1,365 |
| Helper modules (not workflows) | 2 | ~200 |
| Agent-specific workflows | 5 | ~1,624 |
| Heartbeat workflows | 8 | ~472 |
| REGISTRY.md | 1 | ~180 |
| **Total workflow code** | **19** | **~3,841** |

Previously deleted: 12 archived workflows (3,800+ lines) + 5 dead workflows (~1,500 lines) = ~5,300 lines removed historically.
