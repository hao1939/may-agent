export const BLOCK_TURNS = 60;
export const CHECKPOINT_THRESHOLD = 48; // 80% of 60

const checkpointed = new Set<string>();

export function estimateTurnsUsed(iteration: number, hasReview: boolean): number {
  return hasReview ? 1 + iteration * 2 : 1 + iteration;
}

export function shouldBudgetCheckpoint(project: string, iteration: number, reviewEvery: number): boolean {
  if (checkpointed.has(project)) return false;
  const hasReview = reviewEvery > 0 && iteration % reviewEvery === 0;
  const turns = estimateTurnsUsed(iteration, hasReview);
  if (turns >= CHECKPOINT_THRESHOLD) {
    checkpointed.add(project);
    return true;
  }
  return false;
}

export function buildBudgetCheckpointEntry(iteration: number, turns: number): string {
  return `### Budget Checkpoint\n\nAt iteration ${iteration}, ~${turns} turns used (${turns}/${BLOCK_TURNS} block budget).\n`;
}

export function resetBudgetState(project: string): void {
  checkpointed.delete(project);
}
