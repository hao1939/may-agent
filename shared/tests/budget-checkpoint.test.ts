/**
 * Tests for workflows/budget-checkpoint.ts
 * Budget-aware auto-checkpoint logic for workflow turn limits.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Replicate the pure logic from budget-checkpoint.ts to test without side effects
const BLOCK_TURNS = 60;
const CHECKPOINT_RATIO = 0.80;
const CHECKPOINT_THRESHOLD = Math.floor(BLOCK_TURNS * CHECKPOINT_RATIO); // 48

function estimateTurnsUsed(iteration: number, hasReview: boolean): number {
  const reviewTurns = hasReview ? 1 : 0;
  return 1 + iteration * (1 + reviewTurns);
}

interface BudgetState {
  checkpointed: boolean;
  totalTurnsEstimate: number;
}

function shouldBudgetCheckpoint(
  states: Map<string, BudgetState>,
  projectId: string,
  iteration: number,
  reviewEvery: number,
): boolean {
  let state = states.get(projectId);
  if (!state) {
    state = { checkpointed: false, totalTurnsEstimate: 0 };
    states.set(projectId, state);
  }
  if (state.checkpointed) return false;
  const hasReview = (iteration % reviewEvery === 0);
  const turns = estimateTurnsUsed(iteration, hasReview);
  state.totalTurnsEstimate = turns;
  if (turns >= CHECKPOINT_THRESHOLD) {
    state.checkpointed = true;
    return true;
  }
  return false;
}

function buildBudgetCheckpointEntry(iteration: number, turnsEstimate: number): string {
  const now = new Date().toISOString();
  return (
    `### Budget Checkpoint — ${now}\n` +
    `**System**: Auto-checkpoint at iteration ${iteration} (~${turnsEstimate} turns used, ` +
    `threshold: ${CHECKPOINT_THRESHOLD}/${BLOCK_TURNS}). ` +
    `Saving progress to prevent work loss if workflow hits turn limit.\n\n`
  );
}

// ─── Tests ───

describe('Constants', () => {
  it('CHECKPOINT_THRESHOLD is 48', () => {
    expect(CHECKPOINT_THRESHOLD).toBe(48);
  });

  it('BLOCK_TURNS is 60', () => {
    expect(BLOCK_TURNS).toBe(60);
  });

  it('threshold is 80% of block turns', () => {
    expect(CHECKPOINT_THRESHOLD).toBe(Math.floor(BLOCK_TURNS * 0.8));
  });
});

describe('estimateTurnsUsed', () => {
  it('iteration 0 with no review = 1 turn (eval only)', () => {
    expect(estimateTurnsUsed(0, false)).toBe(1);
  });

  it('iteration 1 with no review = 2 turns', () => {
    expect(estimateTurnsUsed(1, false)).toBe(2);
  });

  it('iteration 1 with review = 3 turns', () => {
    expect(estimateTurnsUsed(1, true)).toBe(3);
  });

  it('iteration 10 with no review = 11 turns', () => {
    expect(estimateTurnsUsed(10, false)).toBe(11);
  });

  it('iteration 10 with review = 21 turns', () => {
    expect(estimateTurnsUsed(10, true)).toBe(21);
  });

  it('iteration 24 with review = 49 turns (just over threshold)', () => {
    expect(estimateTurnsUsed(24, true)).toBe(49);
  });

  it('iteration 47 with no review = 48 turns (exactly at threshold)', () => {
    expect(estimateTurnsUsed(47, false)).toBe(48);
  });
});

describe('shouldBudgetCheckpoint', () => {
  let states: Map<string, BudgetState>;

  beforeEach(() => {
    states = new Map();
  });

  it('returns false for early iterations', () => {
    expect(shouldBudgetCheckpoint(states, 'p1', 1, 3)).toBe(false);
  });

  it('returns false at iteration 10 (11 turns, well under 48)', () => {
    expect(shouldBudgetCheckpoint(states, 'p1', 10, 3)).toBe(false);
  });

  it('returns true when turns reach threshold (iteration 47, no review)', () => {
    // 1 + 47*1 = 48 >= 48
    expect(shouldBudgetCheckpoint(states, 'p1', 47, 999)).toBe(true);
  });

  it('returns true when turns exceed threshold with review', () => {
    // iteration 24, reviewEvery=24 → hasReview=true → 1 + 24*2 = 49
    expect(shouldBudgetCheckpoint(states, 'p1', 24, 24)).toBe(true);
  });

  it('only checkpoints once per project', () => {
    shouldBudgetCheckpoint(states, 'p1', 47, 999); // triggers
    expect(shouldBudgetCheckpoint(states, 'p1', 48, 999)).toBe(false);
    expect(shouldBudgetCheckpoint(states, 'p1', 59, 999)).toBe(false);
  });

  it('different projects have independent state', () => {
    shouldBudgetCheckpoint(states, 'p1', 47, 999); // triggers for p1
    expect(shouldBudgetCheckpoint(states, 'p2', 47, 999)).toBe(true); // p2 independent
  });

  it('creates state on first call', () => {
    expect(states.has('new-proj')).toBe(false);
    shouldBudgetCheckpoint(states, 'new-proj', 1, 3);
    expect(states.has('new-proj')).toBe(true);
  });

  it('updates totalTurnsEstimate in state', () => {
    shouldBudgetCheckpoint(states, 'p1', 5, 999);
    expect(states.get('p1')!.totalTurnsEstimate).toBe(6); // 1 + 5*1
  });

  it('reviewEvery affects turn count — review iteration triggers sooner', () => {
    // iteration 24, reviewEvery=3 → 24%3=0 → hasReview=true → 1+24*2=49
    expect(shouldBudgetCheckpoint(states, 'p1', 24, 3)).toBe(true);
  });

  it('non-review iteration at same number stays under threshold', () => {
    // iteration 24, reviewEvery=5 → 24%5=4 → hasReview=false → 1+24*1=25
    expect(shouldBudgetCheckpoint(states, 'p1', 24, 5)).toBe(false);
  });
});

describe('buildBudgetCheckpointEntry', () => {
  it('contains iteration number', () => {
    const entry = buildBudgetCheckpointEntry(47, 48);
    expect(entry).toContain('iteration 47');
  });

  it('contains turns estimate', () => {
    const entry = buildBudgetCheckpointEntry(47, 48);
    expect(entry).toContain('~48 turns used');
  });

  it('contains threshold info', () => {
    const entry = buildBudgetCheckpointEntry(47, 48);
    expect(entry).toContain('threshold: 48/60');
  });

  it('starts with markdown heading', () => {
    const entry = buildBudgetCheckpointEntry(10, 20);
    expect(entry).toMatch(/^### Budget Checkpoint — /);
  });

  it('contains ISO date', () => {
    const entry = buildBudgetCheckpointEntry(10, 20);
    expect(entry).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('ends with double newline', () => {
    const entry = buildBudgetCheckpointEntry(10, 20);
    expect(entry).toMatch(/\n\n$/);
  });
});
