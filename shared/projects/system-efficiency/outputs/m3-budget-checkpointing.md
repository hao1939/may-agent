# M3: Budget-Aware Checkpointing — Design & Implementation

## Problem
When project workflows hit the cost-limit guard's hard block at 60 turns, all
unsaved progress from the current iteration is lost. Workers may have completed
significant work that never gets recorded.

## Solution
Intercept the project workflow loop **before** the turn limit kills it.
At 80% of the budget (48 turns), automatically:
1. Write a checkpoint entry to the journal
2. Update project status to "paused" with turn count info
3. Gracefully exit the workflow via `ctx.done()`

The project can then be resumed in a new workflow run with full context preserved.

## Implementation

### New file: `agents/shared/workflows/budget-checkpoint.ts`
- `shouldBudgetCheckpoint(projectId, iteration, reviewEvery)` — returns true once
  per workflow run when estimated turns ≥ 48
- `estimateTurnsUsed(iteration, hasReview)` — estimates cumulative turns:
  1 (eval) + iteration × (1 worker + 1 review if applicable)
- `buildBudgetCheckpointEntry(iteration, turnsEstimate)` — formatted journal entry
- Module-level `Map<string, BudgetState>` tracks per-project checkpoint status

### Integration: `agents/shared/workflows/project.ts`
- Import added at line 15
- Checkpoint check inserted after worker phase, before reviewer phase (line ~913)
- On trigger: writes journal entry, sets status to "paused", emits `budget_checkpoint` event, returns `ctx.done()`

### Constants
| Constant | Value | Rationale |
|---|---|---|
| BLOCK_TURNS | 60 | Matches cost-limit guard |
| CHECKPOINT_RATIO | 0.80 | Leave 20% buffer for cleanup |
| CHECKPOINT_THRESHOLD | 48 | 60 × 0.80 |

## How It Works
```
Iteration loop:
  1. Worker runs (1 turn)
  2. ** Budget check ** ← NEW
     - If estimatedTurns ≥ 48: checkpoint + exit
  3. Reviewer runs (1 turn)
  4. Continue loop
```

## Trade-offs
- **Conservative estimate**: The turn estimate is approximate (doesn't account for
  comment review steps or eval re-runs). Being conservative means we checkpoint
  slightly early rather than risk losing work.
- **One checkpoint per run**: We only checkpoint once. After pausing, the workflow
  must be re-triggered to continue. This avoids checkpoint spam.
- **Graceful exit**: Uses `ctx.done()` not `ctx.escalate()` since this is expected
  behavior, not an error.

## Verification
The implementation can be verified by:
1. Running a project workflow with enough iterations to cross 48 estimated turns
2. Checking that the journal contains a "Budget Checkpoint" entry
3. Checking that project status is "paused" with turn count info
