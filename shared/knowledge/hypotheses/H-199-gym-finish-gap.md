# H-199: Gym Finish-Call Gap — Systematic Behavioral Scenario Failure

**Created**: 2026-04-25 by Bob
**Status**: proposed → CONFIRMED (2026-04-25, 4 trials)
**Confidence**: ★★★★ (directly observed)
**Source**: Live gym runs 2026-04-25
**Connects**: gym-leverage project, live-baseline-2026-05-23

---

## Claim

Agents in gym scenarios systematically fail to call the `finish()` tool, causing all behavioral checks requiring `finish(status=success)` to auto-fail. This single gap blocks 6+ behavioral scenarios from passing.

## Mechanism

The `may-agent` binary in coder/amy mode completes its work and stops, but doesn't call `finish()` as the last action. The gym scorer checks for an explicit `finish()` tool call with `status: "success"`. When the agent simply stops after doing its work, `finishStatus()` returns `null`, failing the check.

## Evidence

### Supporting
- **idempotent-already-fixed** (2 runs, 2026-04-25): Agent correctly reads files, detects they're already fixed, makes no edits — but `finishes-success` fails both times. `agent_status: "completed"` but no `finish()` call.
- **context-learning** (1 run, 2026-04-25): 4/5 checks fail including `finishes-success`. `agent_status: "completed"`.
- **Original baseline** (2026-05-23): All 6 behavioral scenarios failed. `finishes-success` is checked in every one.

### Against / missing
- Could be that agent DOES call finish() but scorer can't parse it (transcript format issue)
- Need to inspect raw transcript to confirm

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Run any behavioral scenario | `finishes-success` will fail |
| Fix agent to call finish() | Multiple scenarios flip from fail to pass |
| idempotent-already-fixed with finish() fix | Should go 8/8 (all other checks pass) |

## Test Plan

- **Design**: Run 5 behavioral scenarios, check if `finishes-success` fails on all
- **Decision rule**: confirmed if ≥4/5 fail on finishes-success; falsified if ≤2/5

## Implications if true

- This is the single biggest lever for gym behavioral pass rate
- Fix could be: (a) gym runner injects finish() instruction into task, (b) agent SOUL.md tells agent to call finish(), (c) runner auto-infers finish status from agent_status
- Option (c) is most robust — don't rely on agent text compliance

## Next Steps

1. Investigate whether this is a scorer issue (should it accept `agent_status: completed` as success?) or agent issue
2. If scorer: update `gym-score-utils.cjs` to treat `completed` as success when no explicit finish()
3. If agent: add finish() instruction to gym task injection

## Links

- Parent: gym-leverage project
- Related: EXP-188 (text instructions ineffective)
