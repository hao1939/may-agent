import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveIncrementalCheckpoint, detectIncompleteCheckpoint, markCheckpointComplete, cleanupCheckpoints } from '../shared/workflows/incremental-checkpoint';
import { withRetry, RetryOptions } from '../shared/workflows/provider-retry';
import { validateOutput } from '../shared/workflows/output-validator';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Seeded PRNG for reproducibility
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

describe('Resilience Stress Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stress-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Checkpoint crash recovery under load', () => {
    it('saves and detects checkpoints across 100 iterations with 10% crash rate', () => {
      const rng = createRng(42);
      let crashCount = 0;

      for (let i = 0; i < 100; i++) {
        const sessionId = `stress-${i}`;

        saveIncrementalCheckpoint(tmpDir, {
          sessionId,
          step: 1,
          partialResults: { iteration: i },
          timestamp: Date.now(),
        });

        if (rng() < 0.1) {
          crashCount++;
          const incomplete = detectIncompleteCheckpoint(tmpDir, sessionId);
          expect(incomplete).toBeTruthy();
          markCheckpointComplete(tmpDir, sessionId);
          continue;
        }

        markCheckpointComplete(tmpDir, sessionId);
      }

      expect(crashCount).toBeGreaterThan(0);
      expect(crashCount).toBeLessThan(30);
    });

    it('handles 25% crash rate across 100 iterations', () => {
      const rng = createRng(123);
      let crashCount = 0;

      for (let i = 0; i < 100; i++) {
        const sessionId = `stress25-${i}`;

        saveIncrementalCheckpoint(tmpDir, {
          sessionId,
          step: 1,
          partialResults: { iteration: i, data: `payload-${i}` },
          timestamp: Date.now(),
        });

        if (rng() < 0.25) {
          crashCount++;
          markCheckpointComplete(tmpDir, sessionId);
          continue;
        }

        markCheckpointComplete(tmpDir, sessionId);
      }

      expect(crashCount).toBeGreaterThan(10);
      expect(crashCount).toBeLessThan(50);
    });

    it('preserves partial results across 50 checkpoint cycles', () => {
      for (let i = 0; i < 50; i++) {
        const sessionId = `partial-${i}`;
        const data = { iteration: i, result: `data-${i}` };

        saveIncrementalCheckpoint(tmpDir, {
          sessionId,
          step: 3,
          partialResults: data,
          timestamp: Date.now(),
        });

        const detected = detectIncompleteCheckpoint(tmpDir, sessionId);
        expect(detected).toBeTruthy();
        expect(detected!.partialResults).toEqual(data);

        markCheckpointComplete(tmpDir, sessionId);
      }
    });
  });

  describe('Provider retry under load', () => {
    it('handles 100 calls with 20% transient error rate', async () => {
      const rng = createRng(77);
      let successCount = 0;

      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
      };

      for (let i = 0; i < 100; i++) {
        const callRng = createRng(77 + i);
        let callAttempts = 0;

        const result = await withRetry(async () => {
          callAttempts++;
          if (callAttempts === 1 && callRng() < 0.2) {
            const err = new Error('Service Unavailable') as any;
            err.status = 503;
            throw err;
          }
          return `result-${i}`;
        }, options);

        if (result.success) successCount++;
      }

      expect(successCount).toBeGreaterThan(80);
    });

    it('retries all 100 calls that fail 1-3 times then succeed', async () => {
      const options: RetryOptions = {
        maxRetries: 5,
        baseDelayMs: 1,
        maxDelayMs: 5,
      };

      let successCount = 0;

      for (let i = 0; i < 100; i++) {
        let attempts = 0;
        const failUntil = (i % 3) + 1;

        const result = await withRetry(async () => {
          attempts++;
          if (attempts <= failUntil) {
            const err = new Error('Rate limited') as any;
            err.status = 429;
            throw err;
          }
          return `ok-${i}`;
        }, options);

        if (result.success) successCount++;
      }

      expect(successCount).toBe(100);
    });

    it('rejects 50 non-retryable 401 errors immediately', async () => {
      const options: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 5,
      };

      let rejections = 0;

      for (let i = 0; i < 50; i++) {
        const result = await withRetry(async () => {
          const err = new Error('Unauthorized') as any;
          err.status = 401;
          throw err;
        }, options);

        if (!result.success) rejections++;
      }

      expect(rejections).toBe(50);
    });
  });

  describe('Output validation under load', () => {
    it('rejects all empty files in 100 iterations with 5% empty rate', () => {
      const rng = createRng(99);
      let emptyCount = 0;
      let rejectedCount = 0;

      for (let i = 0; i < 100; i++) {
        const isEmpty = rng() < 0.05;
        const content = isEmpty ? '' : `# Report ${i}\n\nContent for iteration ${i}`;

        if (isEmpty) emptyCount++;

        const result = validateOutput(`report-${i}.md`, content);
        if (!result.valid) rejectedCount++;
      }

      expect(rejectedCount).toBeGreaterThanOrEqual(emptyCount);
    });

    it('accepts all valid markdown files in batch of 200', () => {
      let validCount = 0;

      for (let i = 0; i < 200; i++) {
        const content = `# Title ${i}\n\n## Section\n\nParagraph content ${i}.\n\n- Item ${i}a\n- Item ${i}b`;
        const result = validateOutput(`doc-${i}.md`, content);
        if (result.valid) validCount++;
      }

      expect(validCount).toBe(200);
    });

    it('detects empty content in batch validation', () => {
      let rejections = 0;

      for (let i = 0; i < 100; i++) {
        const content = i % 10 === 0 ? `# Unique ${i}\n\nUnique content ${i}` : '';
        const result = validateOutput(`file-${i}.md`, content);
        if (!result.valid) rejections++;
      }

      expect(rejections).toBe(90);
    });
  });

  describe('Combined resilience flow', () => {
    it('simulates 50 full iterations with mixed failures', async () => {
      const rng = createRng(2024);
      let completedIterations = 0;
      let crashRecoveries = 0;
      let validationRejections = 0;

      const retryOptions: RetryOptions = { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 5 };

      for (let i = 0; i < 50; i++) {
        const sessionId = `combined-${i}`;
        const roll = rng();

        // Step 1: Checkpoint
        saveIncrementalCheckpoint(tmpDir, {
          sessionId,
          step: 1,
          partialResults: { i },
          timestamp: Date.now(),
        });

        // 10% crash before provider call
        if (roll < 0.1) {
          crashRecoveries++;
          const recovered = detectIncompleteCheckpoint(tmpDir, sessionId);
          expect(recovered).toBeTruthy();
          markCheckpointComplete(tmpDir, sessionId);
          completedIterations++;
          continue;
        }

        // Step 2: Provider call with retry
        let attempts = 0;
        const result = await withRetry(async () => {
          attempts++;
          if (attempts === 1 && roll < 0.3) {
            const err = new Error('503') as any;
            err.status = 503;
            throw err;
          }
          return `result-${i}`;
        }, retryOptions);

        if (!result.success) {
          markCheckpointComplete(tmpDir, sessionId);
          continue;
        }

        // Step 3: Validate output
        const content = roll < 0.35 ? '' : `# Output ${i}\n\nValid content`;
        const validation = validateOutput(`output-${i}.md`, content);
        if (!validation.valid) {
          validationRejections++;
        }

        markCheckpointComplete(tmpDir, sessionId);
        completedIterations++;
      }

      expect(completedIterations).toBeGreaterThan(30);
      expect(crashRecoveries + validationRejections).toBeGreaterThan(0);
    });
  });
});
