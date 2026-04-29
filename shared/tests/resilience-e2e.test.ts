import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the 3 resilience modules
import { saveIncrementalCheckpoint, detectIncompleteCheckpoint, markCheckpointComplete } from '../workflows/incremental-checkpoint';
import { withRetry, RetryConfig, isRetryableError } from '../workflows/provider-retry';
import { validateOutput, ValidationResult } from '../workflows/output-validator';

describe('Resilience E2E — Full Stack Integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resilience-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Full Flow: Checkpoint → Crash → Resume → Retry → Validate', () => {
    it('saves checkpoint, detects it on resume, and continues', async () => {
      const checkpointDir = path.join(tmpDir, '.state', 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });

      // Step 1: Save checkpoint mid-iteration
      const checkpoint = {
        sessionId: 'session-123',
        step: 3,
        partialResults: { tasksCompleted: ['read file', 'parse content'] },
        timestamp: Date.now(),
      };
      const cpPath = path.join(checkpointDir, 'session-123.json');
      fs.writeFileSync(cpPath, JSON.stringify(checkpoint));

      // Step 2: Simulate crash — checkpoint file persists
      expect(fs.existsSync(cpPath)).toBe(true);

      // Step 3: On resume, detect incomplete checkpoint
      const saved = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      expect(saved.sessionId).toBe('session-123');
      expect(saved.step).toBe(3);
      expect(saved.partialResults.tasksCompleted).toHaveLength(2);

      // Step 4: Resume from step 3, trigger provider call with retry
      let attempts = 0;
      const flakyProvider = async () => {
        attempts++;
        if (attempts <= 2) {
          const err: any = new Error('Service Unavailable');
          err.status = 503;
          throw err;
        }
        return { content: '# Valid Output\n\nThis is a real result.' };
      };

      const config: RetryConfig = { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 };
      const result = await withRetry(flakyProvider, config);
      expect(attempts).toBe(3);
      expect(result.content).toContain('Valid Output');

      // Step 5: Validate the output before persisting
      const validation = validateOutput(result.content, 'markdown');
      expect(validation.valid).toBe(true);

      // Step 6: Mark checkpoint complete
      fs.unlinkSync(cpPath);
      expect(fs.existsSync(cpPath)).toBe(false);
    });

    it('rejects empty output after successful retry', async () => {
      const emptyProvider = async () => ({ content: '' });
      const config: RetryConfig = { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 50 };
      const result = await withRetry(emptyProvider, config);

      const validation = validateOutput(result.content, 'markdown');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('empty');
    });

    it('rejects duplicate output after successful retry', async () => {
      const existingFiles = ['# Existing Doc\n\nSame content here.'];
      const duplicateProvider = async () => ({ content: '# Existing Doc\n\nSame content here.' });

      const config: RetryConfig = { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 50 };
      const result = await withRetry(duplicateProvider, config);

      const validation = validateOutput(result.content, 'markdown', existingFiles);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('duplicate');
    });
  });

  describe('Checkpoint Edge Cases', () => {
    it('handles multiple incomplete checkpoints — picks most recent', () => {
      const checkpointDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });

      const old = { sessionId: 'old', step: 1, timestamp: 1000 };
      const recent = { sessionId: 'recent', step: 5, timestamp: 9000 };

      fs.writeFileSync(path.join(checkpointDir, 'old.json'), JSON.stringify(old));
      fs.writeFileSync(path.join(checkpointDir, 'recent.json'), JSON.stringify(recent));

      const files = fs.readdirSync(checkpointDir);
      const checkpoints = files.map(f => JSON.parse(fs.readFileSync(path.join(checkpointDir, f), 'utf-8')));
      const latest = checkpoints.sort((a, b) => b.timestamp - a.timestamp)[0];

      expect(latest.sessionId).toBe('recent');
      expect(latest.step).toBe(5);
    });

    it('corrupted checkpoint file is handled gracefully', () => {
      const checkpointDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });
      fs.writeFileSync(path.join(checkpointDir, 'corrupt.json'), 'not valid json{{{');

      const files = fs.readdirSync(checkpointDir);
      const checkpoints = files.map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(checkpointDir, f), 'utf-8'));
        } catch {
          return null;
        }
      }).filter(Boolean);

      expect(checkpoints).toHaveLength(0);
    });
  });

  describe('Retry Edge Cases', () => {
    it('non-retryable error (401) fails immediately without retry', async () => {
      let attempts = 0;
      const authFail = async () => {
        attempts++;
        const err: any = new Error('Unauthorized');
        err.status = 401;
        throw err;
      };

      const config: RetryConfig = { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 };
      await expect(withRetry(authFail, config)).rejects.toThrow('Unauthorized');
      expect(attempts).toBe(1);
    });

    it('exhausts all retries on persistent 503', async () => {
      let attempts = 0;
      const alwaysFail = async () => {
        attempts++;
        const err: any = new Error('Server Error');
        err.status = 503;
        throw err;
      };

      const config: RetryConfig = { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 };
      await expect(withRetry(alwaysFail, config)).rejects.toThrow('Server Error');
      expect(attempts).toBe(4); // 1 initial + 3 retries
    });

    it('timeout errors are retryable', () => {
      const err: any = new Error('Request timeout');
      err.code = 'ETIMEDOUT';
      expect(isRetryableError(err)).toBe(true);
    });

    it('rate limit (429) is retryable', () => {
      const err: any = new Error('Too Many Requests');
      err.status = 429;
      expect(isRetryableError(err)).toBe(true);
    });
  });

  describe('Output Validation Edge Cases', () => {
    it('markdown without headers is flagged', () => {
      const content = 'just plain text without any markdown structure';
      const validation = validateOutput(content, 'markdown');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('header');
    });

    it('test file without test blocks is flagged', () => {
      const content = '// just a comment\nconst x = 1;\n';
      const validation = validateOutput(content, 'test');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('test');
    });

    it('valid test file passes', () => {
      const content = `import { describe, it } from 'vitest';\ndescribe('foo', () => {\n  it('works', () => { expect(true).toBe(true); });\n});\n`;
      const validation = validateOutput(content, 'test');
      expect(validation.valid).toBe(true);
    });

    it('whitespace-only content is treated as empty', () => {
      const validation = validateOutput('   \n\n  \t  ', 'markdown');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('empty');
    });
  });

  describe('Combined Resilience Scenarios', () => {
    it('checkpoint saves partial results that survive provider failure', async () => {
      const checkpointDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });

      // Save checkpoint with partial work
      const partial = {
        sessionId: 'combo-test',
        step: 2,
        partialResults: { files: ['a.md', 'b.md'] },
        timestamp: Date.now(),
      };
      fs.writeFileSync(path.join(checkpointDir, 'combo-test.json'), JSON.stringify(partial));

      // Provider fails permanently
      const failProvider = async () => {
        const err: any = new Error('Down');
        err.status = 503;
        throw err;
      };

      const config: RetryConfig = { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 };
      await expect(withRetry(failProvider, config)).rejects.toThrow();

      // Checkpoint still exists with partial work preserved
      const saved = JSON.parse(fs.readFileSync(path.join(checkpointDir, 'combo-test.json'), 'utf-8'));
      expect(saved.partialResults.files).toHaveLength(2);
    });

    it('full success path: resume → retry succeeds → validate passes → clean checkpoint', async () => {
      const checkpointDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });

      // 1. Incomplete checkpoint from crash
      const cpPath = path.join(checkpointDir, 'full-flow.json');
      fs.writeFileSync(cpPath, JSON.stringify({ sessionId: 'full-flow', step: 1, timestamp: Date.now() }));

      // 2. Resume detected
      expect(fs.existsSync(cpPath)).toBe(true);

      // 3. Provider succeeds on 2nd try
      let calls = 0;
      const provider = async () => {
        calls++;
        if (calls === 1) { const e: any = new Error('timeout'); e.status = 504; throw e; }
        return { content: '# Report\n\n## Results\n\nAll good.' };
      };

      const result = await withRetry(provider, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 });
      expect(calls).toBe(2);

      // 4. Validate output
      const v = validateOutput(result.content, 'markdown');
      expect(v.valid).toBe(true);

      // 5. Clean checkpoint
      fs.unlinkSync(cpPath);
      expect(fs.existsSync(cpPath)).toBe(false);
    });
  });
});
