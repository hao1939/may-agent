import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { saveIncrementalCheckpoint, detectIncompleteCheckpoint, markCheckpointComplete } from '../workflows/incremental-checkpoint';
import { withRetry, RetryOptions, isRetryableError } from '../workflows/provider-retry';
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
    it('saves checkpoint, detects it on resume, retries provider, validates output', async () => {
      // Step 1: Save checkpoint mid-iteration
      const checkpointDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });
      const checkpoint = { sessionId: 'session-123', step: 3, partialResults: { done: ['a', 'b'] }, timestamp: Date.now() };
      const cpPath = path.join(checkpointDir, 'session-123.json');
      fs.writeFileSync(cpPath, JSON.stringify(checkpoint));

      // Step 2: Simulate crash — checkpoint persists
      expect(fs.existsSync(cpPath)).toBe(true);

      // Step 3: Resume — detect checkpoint
      const saved = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      expect(saved.step).toBe(3);

      // Step 4: Provider call with retry (fails twice, succeeds third)
      let attempts = 0;
      const flakyProvider = async () => {
        attempts++;
        if (attempts <= 2) {
          const err: any = new Error('Service Unavailable');
          err.status = 503;
          throw err;
        }
        return '# Report\n\n## Results\n\nAll systems operational.';
      };

      const opts: RetryOptions = { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 };
      const result = await withRetry(flakyProvider, opts);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.value).toContain('Report');

      // Step 5: Validate output
      const validation = validateOutput('report.md', result.value!);
      expect(validation.valid).toBe(true);

      // Step 6: Clean checkpoint
      fs.unlinkSync(cpPath);
      expect(fs.existsSync(cpPath)).toBe(false);
    });

    it('rejects empty output after successful retry', async () => {
      const emptyProvider = async () => '';
      const result = await withRetry(emptyProvider, { maxRetries: 1, baseDelayMs: 10 });
      expect(result.success).toBe(true);

      const validation = validateOutput('output.md', result.value!);
      expect(validation.valid).toBe(false);
      expect(validation.errors.join(' ')).toContain('empty');
    });

    it('rejects duplicate output after successful retry', async () => {
      // Create an existing file to detect duplicates against
      const existingPath = path.join(tmpDir, 'existing.md');
      fs.writeFileSync(existingPath, '# Existing Doc\n\nSame content here.');

      const dupProvider = async () => '# Existing Doc\n\nSame content here.';
      const result = await withRetry(dupProvider, { maxRetries: 1, baseDelayMs: 10 });

      const validation = validateOutput('new.md', result.value!, { existingFiles: [existingPath] });
      expect(validation.valid).toBe(false);
    });
  });

  describe('Checkpoint Edge Cases', () => {
    it('handles multiple checkpoints — picks most recent by timestamp', () => {
      const cpDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(cpDir, { recursive: true });

      fs.writeFileSync(path.join(cpDir, 'old.json'), JSON.stringify({ sessionId: 'old', step: 1, timestamp: 1000 }));
      fs.writeFileSync(path.join(cpDir, 'recent.json'), JSON.stringify({ sessionId: 'recent', step: 5, timestamp: 9000 }));

      const files = fs.readdirSync(cpDir);
      const checkpoints = files.map(f => JSON.parse(fs.readFileSync(path.join(cpDir, f), 'utf-8')));
      const latest = checkpoints.sort((a, b) => b.timestamp - a.timestamp)[0];
      expect(latest.sessionId).toBe('recent');
    });

    it('corrupted checkpoint is handled gracefully', () => {
      const cpDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(cpDir, { recursive: true });
      fs.writeFileSync(path.join(cpDir, 'corrupt.json'), 'not valid json{{{');

      const checkpoints = fs.readdirSync(cpDir).map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(cpDir, f), 'utf-8')); }
        catch { return null; }
      }).filter(Boolean);
      expect(checkpoints).toHaveLength(0);
    });
  });

  describe('Retry Edge Cases', () => {
    it('non-retryable error (401) fails immediately', async () => {
      let attempts = 0;
      const authFail = async () => {
        attempts++;
        const err: any = new Error('Unauthorized');
        err.status = 401;
        throw err;
      };

      const result = await withRetry(authFail, { maxRetries: 3, baseDelayMs: 10 });
      expect(result.success).toBe(false);
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

      const result = await withRetry(alwaysFail, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 });
      expect(result.success).toBe(false);
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
    it('whitespace-only content is treated as empty', () => {
      const v = validateOutput('file.md', '   \n\n  \t  ');
      expect(v.valid).toBe(false);
      expect(v.errors.join(' ')).toContain('empty');
    });

    it('valid markdown passes validation', () => {
      const v = validateOutput('report.md', '# Title\n\n## Section\n\nContent here.');
      expect(v.valid).toBe(true);
    });

    it('valid test file passes validation', () => {
      const content = `import { describe, it } from 'vitest';\ndescribe('foo', () => {\n  it('works', () => { expect(true).toBe(true); });\n});\n`;
      const v = validateOutput('foo.test.ts', content);
      expect(v.valid).toBe(true);
    });
  });

  describe('Combined Resilience Scenarios', () => {
    it('checkpoint survives provider failure', async () => {
      const cpDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(cpDir, { recursive: true });
      const cpPath = path.join(cpDir, 'combo.json');
      fs.writeFileSync(cpPath, JSON.stringify({ sessionId: 'combo', step: 2, partialResults: { files: ['a.md'] }, timestamp: Date.now() }));

      const failProvider = async () => { const e: any = new Error('Down'); e.status = 503; throw e; };
      const result = await withRetry(failProvider, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 });
      expect(result.success).toBe(false);

      // Checkpoint still exists
      const saved = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      expect(saved.partialResults.files).toHaveLength(1);
    });

    it('full success: resume → retry → validate → cleanup', async () => {
      const cpDir = path.join(tmpDir, 'checkpoints');
      fs.mkdirSync(cpDir, { recursive: true });
      const cpPath = path.join(cpDir, 'full.json');
      fs.writeFileSync(cpPath, JSON.stringify({ sessionId: 'full', step: 1, timestamp: Date.now() }));

      // Resume detected
      expect(fs.existsSync(cpPath)).toBe(true);

      // Provider succeeds on 2nd try
      let calls = 0;
      const provider = async () => {
        calls++;
        if (calls === 1) { const e: any = new Error('timeout'); e.status = 504; throw e; }
        return '# Final Report\n\n## Summary\n\nDone.';
      };

      const result = await withRetry(provider, { maxRetries: 3, baseDelayMs: 10 });
      expect(result.success).toBe(true);
      expect(calls).toBe(2);

      // Validate
      const v = validateOutput('final.md', result.value!);
      expect(v.valid).toBe(true);

      // Cleanup
      fs.unlinkSync(cpPath);
      expect(fs.existsSync(cpPath)).toBe(false);
    });
  });
});
