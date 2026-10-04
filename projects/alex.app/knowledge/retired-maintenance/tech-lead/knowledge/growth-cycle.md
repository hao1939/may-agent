# Growth-Cycle Workflow — Known Issues & Patterns

## Coach Fork Discarding (fixed 2026-03-20)
- **Bug**: In growth-cycle step 2, coach would identify ceiling effects and discard/delete the fork. Step 3 then fails with "No fork found" and escalates.
- **Fix**: Two changes to `agents/coach/workflows/growth-cycle.ts`:
  1. Step 2 prompt now explicitly says: "Do NOT delete or discard the fork — workflow manages lifecycle"
  2. Step 3 gracefully handles missing forks: if coach text mentions "discard"/"ceiling"/"baseline pass", end with `ctx.done()` instead of `ctx.blocked()`
- **Rule**: Workflow steps should never assume sub-agents will preserve artifacts. Add explicit instructions AND defensive handling.

## Scenario/Agent Type Mismatch
- **Observed**: `sycophants-dilemma-workflow-strict/scenario.json` has `agent_type: "coder"` but exp-116 targets `bob`. This can cause gym-runner to use wrong agent defaults.
- **Rule**: Verify `agent_type` in scenario.json matches the target agent before running experiments.

## Growth-Cycle State
- As of 2026-03-20: Pipeline works end-to-end. Main remaining issue is gym scorer reliability (see `gym-scoring.md`).
