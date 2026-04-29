/**
 * Tests for workflows/budget-checkpoint.ts
 * Budget-aware auto-checkpoint logic for workflow turn limits.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimateTurnsUsed,
  shouldBudgetCheckpoint,
  buildBudgetCheckpointEntry,
  resetBudgetState,
  CHECKPOINT_THRESHOLD,
  BLOCK_TURNS,
} from '../workflows/budget-checkpoint.ts';

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
  beforeEach(() => {
    resetBudgetState('p1');
    resetBudgetState('p2');
    resetBudgetState('new-proj');
  });

  it('returns false for early iterations', () => {
    expect(shouldBudgetCheckpoint('p1', 1, 3)).toBe(false);
  });

  it('returns false at iteration 10 (11 turns, well under 48)', () => {
    expect(shouldBudgetCheckpoint('p1', 10, 3)).toBe(false);
  });

  it('returns true when turns reach threshold (iteration 47, no review)', () => {
    expect(shouldBudgetCheckpoint('p1', 47, 999)).toBe(true);
  });

  it('returns true when turns exceed threshold with review', () => {
    expect(shouldBudgetCheckpoint('p1', 24, 24)).toBe(true);
  });

  it('only checkpoints once per project', () => {
    shouldBudgetCheckpoint('p1', 47, 999);
    expect(shouldBudgetCheckpoint('p1', 48, 999)).toBe(false);
    expect(shouldBudgetCheckpoint('p1', 59, 999)).toBe(false);
  });

  it('different projects have independent state', () => {
    shouldBudgetCheckpoint('p1', 47, 999);
    expect(shouldBudgetCheckpoint('p2', 47, 999)).toBe(true);
  });

  it('reviewEvery affects turn count — review iteration triggers sooner', () => {
    expect(shouldBudgetCheckpoint('p1', 24, 3)).toBe(true);
  });

  it('non-review iteration at same number stays under threshold', () => {
    expect(shouldBudgetCheckpoint('p1', 24, 5)).toBe(false);
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
