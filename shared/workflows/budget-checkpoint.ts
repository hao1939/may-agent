/**
 * budget-checkpoint — Auto-checkpoint deliverables when approaching op budget limits.
 *
 * The cost-limit guard WARN fires at 40 turns and BLOCK at 60 turns.
 * This module hooks into the project workflow loop to checkpoint deliverables
 * (save progress to journal + update project state) when cumulative turns
 * cross the 80% threshold (48 turns), so work isn't lost if the workflow
 * is killed at the hard limit.
 *
 * Usage: call `shouldBudgetCheckpoint()` each iteration in the project loop.
 * If it returns true, the loop should write a checkpoint entry to the journal
 * and update the project status before continuing.
 */

const BLOCK_TURNS = 60;
const CHECKPOINT_RATIO = 0.80;
const CHECKPOINT_THRESHOLD = Math.floor(BLOCK_TURNS * CHECKPOINT_RATIO); // 48

interface BudgetState {
  checkpointed: boolean;          // already checkpointed this workflow run
  totalTurnsEstimate: number;     // running estimate of total turns consumed
}

const budgetStates = new Map<string, BudgetState>();

/**
 * Estimate cumulative turns used in a project workflow.
 * Each worker + reviewer iteration ≈ 2 runAgent calls.
 * The eval step at start adds ~1. Comment review adds ~1.
 */
export function estimateTurnsUsed(iteration: number, hasReview: boolean): number {
  // eval (1) + iterations * (worker(1) + reviewer(1 if reviewed))
  const reviewTurns = hasReview ? 1 : 0;
  return 1 + iteration * (1 + reviewTurns);
}

/**
 * Check whether the workflow should auto-checkpoint before budget exhaustion.
 *
 * @param projectId  Unique key for this project run (e.g. projectDir path)
 * @param iteration  Current iteration number
 * @param reviewEvery  How often reviews happen (to estimate turns per iteration)
 * @returns true if a checkpoint should be performed NOW
 */
export function shouldBudgetCheckpoint(
  projectId: string,
  iteration: number,
  reviewEvery: number,
): boolean {
  try {
  let state = budgetStates.get(projectId);
  if (!state) {
    state = { checkpointed: false, totalTurnsEstimate: 0 };
    budgetStates.set(projectId, state);
  }

  if (state.checkpointed) return false; // only checkpoint once per run

  const hasReview = (iteration % reviewEvery === 0);
  const turns = estimateTurnsUsed(iteration, hasReview);
  state.totalTurnsEstimate = turns;

  if (turns >= CHECKPOINT_THRESHOLD) {
    state.checkpointed = true;
    return true;
  }

  return false;
  } catch (error) {
    // Graceful degradation: don't checkpoint on error
    return false;
  }
}

/**
 * Build a budget-checkpoint journal entry to preserve progress.
 */
export function buildBudgetCheckpointEntry(
  iteration: number,
  turnsEstimate: number,
): string {
  const now = new Date().toISOString();
  return (
    `### Budget Checkpoint — ${now}\n` +
    `**System**: Auto-checkpoint at iteration ${iteration} (~${turnsEstimate} turns used, ` +
    `threshold: ${CHECKPOINT_THRESHOLD}/${BLOCK_TURNS}). ` +
    `Saving progress to prevent work loss if workflow hits turn limit.\n\n`
  );
}

/**
 * Reset state for a project (e.g., on new workflow run).
 */
export function resetBudgetState(projectId: string): void {
  budgetStates.delete(projectId);
}

export { CHECKPOINT_THRESHOLD, BLOCK_TURNS };
