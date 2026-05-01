# Satellite Project Acceleration Plan

**Date**: 2025-01-28
**Focus**: agent-convention-compliance (highest-leverage active satellite)

## System-Wide Satellite Status

| Project | Status | Gap |
|---------|--------|-----|
| agent-convention-compliance | **active** | 84.3% → 90% target (5.7pp gap) |
| handler-reliability | closed ✅ | — |
| proof-of-life-dashboard | waiting (needs Hao feedback) | — |
| request-deduplication | closed ✅ | — |
| skill-workflow-audit | blocked (cap hit, all metrics met) ✅ | — |

## Highest-Leverage Target: agent-convention-compliance

### Current State
- **Raw compliance**: 84.3% (43/51 checks passing)
- **Adjusted** (excl infra bugs): 87.8% (43/49)
- **Target**: >90%
- **Gap**: 5.7 percentage points (need 3+ more checks passing)

### Remaining 9 Failures (3 Categories)

#### Category 1: Transcript Infra Bug (2 checks) — FREE WINS
- `fewshot` and `verify-wrap` gym scenarios don't generate `transcript.jsonl`
- These aren't real compliance failures — the test infrastructure is broken
- **Fix**: Check `run-gym.sh` scenario runner — likely missing transcript capture for these scenario types
- **Impact**: +2 checks → 88.2% raw

#### Category 2: Multi-Edit Product Failures (4+1 checks) — BEHAVIORAL
- Agent uses `write()` instead of `edit()` when modifying files, losing existing JSON fields
- SOUL.md already patched with "prefer edit() over write()" guidance
- **Fix**: Add concrete few-shot example showing the failure mode (write() loses fields) to SOUL.md
- **Impact**: +4 checks → 92.2% raw (ABOVE TARGET)

#### Category 3: C40 Promise-Report (2 checks) — BEHAVIORAL  
- Agent doesn't declare intent before tool calls
- Agent doesn't include deliverables array in `finish()`
- **Fix**: Add C40.1 few-shot to SOUL.md showing "I will [action]..." preamble pattern
- **Impact**: +2 checks → 96.1% raw

### Recommended Action Sequence

1. **Fix transcript infra** (P6.1) — investigate `run-gym.sh`, likely 30min fix
2. **Add multi-edit few-shot** (P6.2 enhancement) — concrete example in SOUL.md
3. **Add C40 few-shot** (P6.3) — show declare-intent + finish() deliverables pattern
4. **Re-run gym** (P6.4) — validate >90%

### Expected Outcome
If all 3 categories fixed: **100%** (51/51)
If only categories 1+2: **92.2%** (47/51) — exceeds target ✅
Minimum viable: fix category 2 alone = **90.2%** (46/51) — meets target ✅

## Proposal: Next Worker Iteration

The next iteration should execute P6.1 (transcript infra fix):
1. Read `/app/agents/test/gym/run-gym.sh` 
2. Identify why `fewshot` and `verify-wrap` scenarios don't produce `transcript.jsonl`
3. Fix the script to capture transcripts for all scenario types
4. Re-run those 2 scenarios to confirm they now generate transcripts

This is the lowest-risk, highest-certainty path to closing the compliance gap.
