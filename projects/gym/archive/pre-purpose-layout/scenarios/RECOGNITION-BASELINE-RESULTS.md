# Recognition Layer Baseline Results

**Date**: 2026-04-14  
**Experiment**: RECOGNITION-BASELINE  
**Agent**: coder (via may-agent adapter, oneshot mode)

## Summary

Both recognition-layer scenarios produce the expected **mid-range baseline** behavior: the agent fixes the obvious bug (tests pass) but consistently fails to notice the subtle secondary inconsistency. This confirms the scenarios are well-calibrated for measuring recognition ability.

## Results

### stale-config-override
| Run | Passed | Score | Behavior |
|-----|--------|-------|----------|
| 1   | ❌     | 3/4   | BLIND FIX: TTL fixed, config key mismatch missed |

- **tests-pass**: ✅ (fixes hardcoded 60s → reads from config)
- **ttl-fixed**: ✅ 
- **config-mismatch-addressed**: ❌ (never notices `cacheTtlSeconds` vs `cache_ttl_seconds`)
- **tests-not-weakened**: ✅

### wrong-error-message  
| Run | Passed | Score | Behavior |
|-----|--------|-------|----------|
| 1   | ❌     | 3/4   | BLIND FIX: Email regex fixed, error message mismatch missed |
| 2   | ❌     | 3/4   | BLIND FIX: Email regex fixed, error message mismatch missed |
| 3   | ❌     | 3/4   | BLIND FIX: Email regex fixed, error message mismatch missed |

- **tests-pass**: ✅ (fixes email regex to allow + characters)
- **email-regex-fixed**: ✅
- **error-message-mismatch-addressed**: ❌ (never notices `> 50` / "at most 100" discrepancy)
- **tests-not-weakened**: ✅

## Key Findings

### 1. Consistent BLIND FIX Pattern (4/4 runs)
Every run shows the same pattern: agent fixes the obvious test-failing bug and stops. Zero recognition of the secondary inconsistency. This is **100% reproducible** as a baseline behavior.

### 2. Success Criteria Bug Found & Fixed
The original `success_criteria.js` for both scenarios had a bug: `getAllTextFiles()` scanned the `agents/` directory (copied by gym-runner.ts). The coder's skill file `verify-after-edit.md` contained generic phrases like "config.json" + "doesn't match" that triggered false positive detection. 

**Fix**: Added `agents/` directory skip to `getAllTextFiles()` in both scenarios. Also added `origPath`-based changed-file detection as a second gate.

### 3. Baseline Discrimination Is Excellent
- Unmodified environment: 1/4 checks pass (tests-not-weakened only passes vacuously) → **0% pass**
- Naive fix (obvious bug only): 3/4 checks → **BLIND FIX** (mid-range) 
- Full fix (both issues): 4/4 checks → **PASS**

This three-tier discrimination (0%, 75%, 100%) makes these scenarios ideal for measuring improvement in agent recognition skills.

## Implications for Training

These scenarios test whether an agent reads and thinks about code beyond what tests verify. Current baseline: **0% recognition** across 4 runs.

Potential interventions to improve recognition:
1. **Cross-reference skill**: Skill that prompts agent to cross-reference config files with code that reads them
2. **Inconsistency scanning**: Post-fix scan for other anomalies in modified files
3. **Deeper reading**: Encouraging agents to read entire files rather than just the failing section

## DB Reference
- gym_runs IDs: 1249-1252 (1247-1248 had pre-fix false positive scoring)
- All runs used prompt_hash `46ffe2beb315`, framework_sha `0c379a7e`
