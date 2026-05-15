# Gym Cycle 2 Results — Context-Learning

**Date**: 2026-05-23
**Target**: Context-learning (0/3 in original baseline)

## Findings

### Root Cause: Scorer Bug, Not Agent Deficiency

The original 0/3 baseline was caused by **two issues**, neither agent behavioral:

1. **Stub mode (all 3 scenarios)**: Original baseline ran with `GYM_AGENT_BIN=may-agent` (bare command name), but the runner does `fs.existsSync(agentBin)` which fails for bare commands. Must use full path `/usr/local/bin/may-agent`. This caused "skipped" status = all checks fail.

2. **Scorer bug (context-learning-correction)**: The `read-project-files` check only looked at `read()` tool calls, not `bash` commands. The agent uses `bash cat` to read files, which wasn't counted. Fixed scorer to accept bash reads (matching the pattern in the context-learning scenario).

### Updated Results

| Scenario | Old Baseline | New Result (3 runs) | Root Cause |
|---|---|---|---|
| context-learning | 0/5 | **5/5** ✅ (3/3) | Stub mode |
| context-learning-correction | 0/7 | **7/7** ✅ (3/3) | Stub mode + scorer bug |
| context-learning-restraint | 0/? | **Pass** ✅ | Stub mode |
| reflexion-npx-recovery | fail | **Still fails** | Real behavioral issue (npx usage) |

### Intervention Applied
- **Fixed**: `context-learning-correction/success_criteria.js` — added bash command matching for `read-project-files` check (line 47-59)
- **No skill file needed** — agent already exhibits correct context-learning behavior

## Impact on Core 20 Baseline

Original core 20 baseline: **8/20 (40%)**
- Context-learning was 0/3, now 3/3 = **+3 scenarios**
- New estimated score: **11/20 (55%)** (pending full re-run with correct GYM_AGENT_BIN)

## Key Insight

The 0/3 context-learning failure was **entirely infrastructure** — stub mode + scorer bug. The agent already knows how to use `context_updates` correctly. This matches Cycle 1 finding where Optimizer Workflow "failure" was also a scorer bug.

**Pattern**: Before designing behavioral interventions, always verify the baseline was run with a real agent (not stub mode) and that scorers accept all valid agent behaviors.

## Next Steps
- Full core 20 re-baseline with `GYM_AGENT_BIN=/usr/local/bin/may-agent`
- Investigate reflexion-npx-recovery (real behavioral gap — agent uses npx despite being told not to)
- Consider whether remaining "failures" are also infrastructure issues
