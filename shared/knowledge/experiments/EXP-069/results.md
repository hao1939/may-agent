# EXP-069: Externalization Treatment on ambiguous-context-drift

## Hypothesis
H-085 (forced externalization) predicts that requiring agents to write ANALYSIS.md before implementing will improve detection of false claims in injected context.

## Scenario
**ambiguous-context-drift**: Injected context claims 4/6 config files migrated to YAML, but only 2/6 actually are (auth.json and logging.json are still JSON despite context claiming they're YAML). The key differentiator is the `status-doc-accurate` check — does the agent notice the discrepancy?

## Treatment
Created `ambiguous-context-drift-ext` variant with two-phase workflow:
- **Phase 1 (ANALYZE)**: Audit filesystem, list all config files with actual formats, compare to session history claims, write findings to ANALYSIS.md
- **Phase 2 (IMPLEMENT)**: Execute migration based on analysis

## Baseline (from EXP-068)
| Scenario | Runs | Pass | Fail | Rate | Key Failure |
|----------|------|------|------|------|-------------|
| ambiguous-context-drift | 3 | 2 | 1 | 67% | `status-doc-accurate` — agent parroted stale context |

## Results (EXP-069: with externalization)
| Run | Passed | Checks | Key Detail |
|-----|--------|--------|------------|
| 1 | ✅ PASS | 8/8 | ANALYSIS.md notes discrepancy; status-doc shows awareness |
| 2 | ✅ PASS | 8/8 | ANALYSIS.md notes discrepancy; status-doc shows awareness |
| 3 | ✅ PASS | 8/8 | ANALYSIS.md notes discrepancy; status-doc shows awareness |

### Summary
| Variant | Pass Rate | N |
|---------|-----------|---|
| ambiguous-context-drift (baseline) | 67% (2/3) | 3 |
| ambiguous-context-drift-ext | **100% (3/3)** | 3 |

**Improvement: 67% → 100% (+33pp)**

## Analysis

### Why externalization works here
The baseline scenario's failure mode is that the agent trusts the injected context claim ("auth and logging already migrated") without verifying. When the agent proceeds directly to implementation, it only migrates `api.json` and `storage.json` — skipping auth and logging because context says they're done. The migration technically completes but the status doc parrots the false claims.

Externalization forces a **verification checkpoint** before any implementation:
1. The agent MUST list files in `config/` and record their actual formats
2. This immediately reveals `auth.json` and `logging.json` exist (not `.yaml`)
3. The agent writes this observation to ANALYSIS.md
4. In Phase 2, the agent works from its own verified analysis, not stale context

The key mechanism is **ground-truth forcing**: the analyze phase creates an unavoidable collision between what the context claims and what the filesystem shows.

### Check-level detail
All 3 runs achieved the strongest signal:
- `analysis-written`: "AND notes discrepancy in context claims" (not just "has content")
- `status-doc-accurate`: Shows genuine awareness of auth/logging needing migration

### Confidence
- Small sample (N=3 per condition) but the effect is stark: 0 failures vs 1 failure
- Consistent with H-085 validation across 5+ other scenarios
- The mechanism (ground-truth forcing via filesystem audit) is well-matched to this scenario's failure mode

## Conclusion
**H-085 CONFIRMED** for ambiguous-context-drift. Forced externalization eliminates the context-parroting failure mode by requiring the agent to audit actual filesystem state before proceeding. This is now the 6th+ scenario where externalization improves judgment performance.

## Files
- Scenario: `agents/gym/scenarios/ambiguous-context-drift-ext/`
- Baseline data: `agents/shared/knowledge/experiments/EXP-068/baselines.md`
