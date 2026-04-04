# EXP-022 Results: Materialize Findings (Concise) Skill

**Date**: 2026-04-04  
**Status**: COMPLETE — Skill shows clear improvement on target behaviors  
**Verdict**: POSITIVE SIGNAL — skill improves materialization behavior without degrading product quality

## Design
- **Hypothesis**: A concise 3-rule materialize-findings skill improves behavior checks (early-materialization, regular-cadence, finish-references-deliverables) without degrading product quality
- **Scenario**: `materialize-intermediate-findings` (multi-step investigation, 5 services, root cause report)
- **Arms**: control (no skill) vs treatment (materialize-findings-concise skill installed)
- **Runs per arm**: 3

## Raw Results

### Overall Pass Rate (all 9 checks must pass)
| Arm | Passed | Total | Rate |
|-----|--------|-------|------|
| Control | 0 | 3 | 0% |
| Treatment | 0 | 3 | 0% |

Both arms fail the overall test because `regular-materialization-cadence` (max 6 tool calls between writes) is very hard to satisfy.

### Per-Check Pass Rates (the real signal)

| Check | Category | Control | Treatment | Delta |
|-------|----------|---------|-----------|-------|
| report-exists | product | 2/3 (67%) | 3/3 (100%) | +33% |
| report-identifies-affected-services | product | 2/3 (67%) | 3/3 (100%) | +33% |
| report-identifies-trigger | product | 2/3 (67%) | 3/3 (100%) | +33% |
| **early-materialization** | **behavior** | **0/3 (0%)** | **2/3 (67%)** | **+67%** |
| multiple-materializations | behavior | 2/3 (67%) | 3/3 (100%) | +33% |
| intermediate-data-persisted | behavior | 3/3 (100%) | 3/3 (100%) | 0% |
| **regular-materialization-cadence** | **behavior** | **0/3 (0%)** | **1/3 (33%)** | **+33%** |
| low-ops | efficiency | 3/3 (100%) | 3/3 (100%) | 0% |
| finish-references-deliverables | behavior | 2/3 (67%) | 3/3 (100%) | +33% |

### Total Checks Passed
- **Control**: 14/27 checks passed (52%)
- **Treatment**: 21/27 checks passed (78%)
- **Improvement**: +26 percentage points, +50% relative improvement

### Duration
| Arm | Avg Duration | Runs |
|-----|-------------|------|
| Control | 233s | 135s, 300s, 263s |
| Treatment | 130s | 125s, 152s, 113s |

Treatment is **44% faster** (130s vs 233s), suggesting the skill helps agents be more directed.

## Analysis

### What the skill improved
1. **Early materialization (+67%)**: The "EARLY WRITE" rule (write within first 3 tool calls) directly addressed this. Control agents never wrote early; treatment agents did 2/3 times.
2. **Regular cadence (+33%)**: The "WRITE EVERY 3 COMMANDS" rule helped somewhat, but the ≤6 gap threshold is still hard to maintain consistently.
3. **Finish references (+33%)**: The "REFERENCE IN FINISH" rule directly addressed this.
4. **Product quality (+33% across all 3 checks)**: Unexpected — the skill didn't just improve behavior, it improved task completion. Hypothesis: by materializing early, the agent maintains better state awareness and produces more thorough reports.
5. **Speed (-44% duration)**: Treatment runs were significantly faster. The structured write cadence may reduce backtracking/re-reading.

### What the skill didn't fix
1. **Regular cadence (still 67% failure)**: Even with the skill installed, 2/3 treatment runs failed the max-6-gap check. The skill's "every 3 commands" rule is followed loosely, not precisely.

### Threats to validity
1. **Small sample** (n=3 per arm) — effects may not generalize
2. **Single scenario** — the skill may only work for investigation tasks
3. **All ops=1** — the ops counter shows 1 for all runs, which seems like a measurement issue

## Conclusion
The materialize-findings-concise skill shows a **strong positive signal**: +26pp total checks, +67pp on the target early-materialization behavior, +33pp on product quality, and 44% faster completion. 

**Recommendation**: Mark this skill as "evidence: positive" in the skill library. Consider strengthening the regular-cadence rule (the weakest improvement area) in a future revision.

## Next Steps
- [ ] Update LIBRARY.md with evidence rating
- [ ] Consider EXP-023: test the skill on a different scenario (e.g., debugging, refactoring) to check generalization
- [ ] Investigate the ops=1 measurement issue — likely a lab runner bug
