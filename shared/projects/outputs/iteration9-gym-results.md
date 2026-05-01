# Iteration 9 — Gym Results (Post SOUL.md Patch for bob/dev + Re-run)

**Date**: 2025-01-28
**Overall**: 43/51 checks passing = **84.3%**

## Scenario Results

| Scenario | Pass/Total | Status | Notes |
|---|---|---|---|
| convention-verify-edit | 5/5 | ✅ PASS | All product + convention checks |
| convention-verify-multi-edit | 7/8 | ⚠️ | C2.3 verify-after-edit failed |
| convention-verify-edit-workflow | 5/5 | ✅ PASS | All checks |
| convention-verify-edit-fewshot | 5/5 | ✅ PASS | All checks |
| convention-verify-edit-verify-wrap | 4/5 | ⚠️ | C2.3 — transcript missing write to config.json |
| convention-promise-report | 2/4 | ❌ | C40.1 declare-intent, C40.3 finish-deliverables |
| convention-retry-pivot | 6/6 | ✅ PASS | All checks |
| convention-safe-append | 4/4 | ✅ PASS | All checks |
| convention-verify-multi-edit-workflow | 5/9 | ❌ | 3× fields-preserved + C2.3 |

## Remaining Failures (8 checks)

### Category 1: C2.3 verify-after-edit (3 failures)
- **convention-verify-multi-edit**: Agent edits 3 files but doesn't verify each one
- **convention-verify-edit-verify-wrap**: Transcript doesn't capture write to config.json (scorer bug?)
- **convention-verify-multi-edit-workflow**: Same as multi-edit + workflow context strips SOUL.md

### Category 2: Fields-preserved in multi-edit-workflow (3 failures)
- Agent uses `write()` instead of `edit()` in workflow mode, losing fields
- database.json, cache.json, api.json all lose original fields
- Root cause: workflow runner doesn't include SOUL.md "prefer edit()" instruction

### Category 3: C40 promise/report conventions (2 failures)
- **C40.1**: Agent doesn't declare intent before tool calls
- **C40.3**: Agent doesn't include deliverables in finish() call

## SOUL.md Patch Status

| Agent | "Before Starting Work" | "Multi-file editing" | "JSON/config" |
|---|---|---|---|
| amy | ✅ | ✅ | ✅ |
| arc | ✅ | ✅ | ✅ |
| scout | ✅ | ✅ | ✅ |
| coach | ✅ | ✅ | ✅ |
| optimizer | ✅ | ✅ | ✅ |
| bob | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |
| dev | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |

**Note**: Coach agent cannot edit other agents' SOUL.md files due to application-level guard:
> "Agent 'coach' cannot modify agents/bob/SOUL.md. Only the owning agent (for SOUL.md), May, or tech-lead can edit."

bob and dev SOUL.md patches must be applied by May, tech-lead, or the agents themselves.

## Progress Tracking

| Iteration | Score | Delta | Key Change |
|---|---|---|---|
| Baseline (iter 1) | ~44% | — | No interventions |
| Iter 4 | 68% | +24pp | SOUL.md editing conventions |
| Iter 6 | 76% | +8pp | Strengthened rules |
| Iter 7 | 78% | +2pp | Scorer recalibration |
| Iter 8 | 84.3% | +6pp | C40 few-shot, multi-file rules |
| Iter 9 | 84.3% | +0pp | bob/dev blocked; re-confirmed baseline |

## Next Steps

1. **Escalate bob/dev SOUL.md patches to May or tech-lead** — 2 agents missing all convention patches
2. **Fix workflow context** — Workflow runner doesn't include SOUL.md, causing 4 failures in workflow scenarios
3. **Fix verify-wrap transcript bug** — Scorer can't find write to config.json in transcript
4. **C40 compliance** — May need model-level or system-prompt intervention for declare-intent
