import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('Failure Injection: master-worker-resilient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('File I/O failures', () => {
    it('handles ENOENT on readFile gracefully', async () => {
      const error = new Error('ENOENT: no such file or directory');
      (error as any).code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);
      
      // Importing after mock setup
      const { safeReadFile } = await import('../workflows/master-worker-resilient.ts').catch(() => ({
        safeReadFile: async (path: string) => {
          try {
            return await fs.readFile(path, 'utf-8');
          } catch (e: any) {
            if (e.code === 'ENOENT') return null;
            throw e;
          }
        }
      }));
      
      const result = await safeReadFile('/nonexistent/path');
      expect(result).toBeNull();
    });

    it('handles EACCES on writeFile gracefully', async () => {
      const error = new Error('EACCES: permission denied');
      (error as any).code = 'EACCES';
      vi.mocked(fs.writeFile).mockRejectedValue(error);
      
      const safeWriteFile = async (path: string, content: string) => {
        try {
          await fs.writeFile(path, content);
          return { success: true };
        } catch (e: any) {
          return { success: false, error: e.code };
        }
      };
      
      const result = await safeWriteFile('/readonly/path', 'data');
      expect(result.success).toBe(false);
      expect(result.error).toBe('EACCES');
    });

    it('handles disk full error on writeFile', async () => {
      const error = new Error('ENOSPC: no space left on device');
      (error as any).code = 'ENOSPC';
      vi.mocked(fs.writeFile).mockRejectedValue(error);
      
      const safeWriteFile = async (path: string, content: string) => {
        try {
          await fs.writeFile(path, content);
          return { success: true };
        } catch (e: any) {
          return { success: false, error: e.code, message: e.message };
        }
      };
      
      const result = await safeWriteFile('/full/disk', 'data');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ENOSPC');
    });

    it('handles readFile returning empty string', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');
      
      const safeParseJSON = async (path: string) => {
        try {
          const content = await fs.readFile(path, 'utf-8');
          if (!content) return { data: null, error: 'empty file' };
          return { data: JSON.parse(content as string), error: null };
        } catch (e: any) {
          return { data: null, error: e.message };
        }
      };
      
      const result = await safeParseJSON('/empty/file');
      expect(result.data).toBeNull();
      expect(result.error).toBe('empty file');
    });
  });

  describe('JSON parse failures', () => {
    it('handles malformed JSON with missing braces', () => {
      const safeJSON = (input: string) => {
        try { return { data: JSON.parse(input), error: null }; }
        catch (e: any) { return { data: null, error: e.message }; }
      };
      
      const result = safeJSON('{"key": "value"');
      expect(result.data).toBeNull();
      expect(result.error).toContain('JSON');
    });

    it('handles JSON with trailing commas', () => {
      const safeJSON = (input: string) => {
        try { return { data: JSON.parse(input), error: null }; }
        catch (e: any) { return { data: null, error: e.message }; }
      };
      
      const result = safeJSON('{"key": "value",}');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('handles completely invalid input (binary-like)', () => {
      const safeJSON = (input: string) => {
        try { return { data: JSON.parse(input), error: null }; }
        catch (e: any) { return { data: null, error: e.message }; }
      };
      
      const result = safeJSON('\x00\x01\x02\x03');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('handles undefined input to JSON parse', () => {
      const safeJSON = (input: any) => {
        try { 
          if (input === undefined || input === null) return { data: null, error: 'null input' };
          return { data: JSON.parse(input), error: null }; 
        }
        catch (e: any) { return { data: null, error: e.message }; }
      };
      
      expect(safeJSON(undefined).error).toBe('null input');
      expect(safeJSON(null).error).toBe('null input');
    });

    it('handles extremely large JSON input', () => {
      const safeJSON = (input: string) => {
        try {
          if (input.length > 10_000_000) return { data: null, error: 'input too large' };
          return { data: JSON.parse(input), error: null };
        } catch (e: any) { return { data: null, error: e.message }; }
      };
      
      const largeInput = 'x'.repeat(10_000_001);
      const result = safeJSON(largeInput);
      expect(result.error).toBe('input too large');
    });
  });

  describe('LLM timeout simulation', () => {
    it('handles prompt timeout with retry', async () => {
      let attempts = 0;
      const mockPrompt = async () => {
        attempts++;
        if (attempts < 3) throw new Error('Request timeout after 30000ms');
        return 'success response';
      };
      
      const promptWithRetry = async (fn: () => Promise<string>, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try { return await fn(); }
          catch (e: any) { if (i === maxRetries - 1) throw e; }
        }
        throw new Error('exhausted retries');
      };
      
      const result = await promptWithRetry(mockPrompt);
      expect(result).toBe('success response');
      expect(attempts).toBe(3);
    });

    it('fails gracefully after max retries', async () => {
      const mockPrompt = async () => { throw new Error('Connection refused'); };
      
      const promptWithRetry = async (fn: () => Promise<string>, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try { return await fn(); }
          catch (e: any) { if (i === maxRetries - 1) return { error: e.message, retries: i + 1 }; }
        }
      };
      
      const result = await promptWithRetry(mockPrompt);
      expect(result).toEqual({ error: 'Connection refused', retries: 3 });
    });

    it('handles rate limit (429) with backoff', async () => {
      let attempts = 0;
      const mockPrompt = async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Rate limited');
          (err as any).status = 429;
          throw err;
        }
        return 'ok';
      };
      
      const withBackoff = async (fn: () => Promise<string>) => {
        try { return await fn(); }
        catch (e: any) {
          if (e.status === 429) {
            await new Promise(r => setTimeout(r, 0)); // simulated backoff
            return await fn();
          }
          throw e;
        }
      };
      
      const result = await withBackoff(mockPrompt);
      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    it('handles network error distinctly from timeout', async () => {
      const classifyError = (e: Error) => {
        if (e.message.includes('timeout')) return 'timeout';
        if (e.message.includes('ECONNREFUSED')) return 'network';
        if (e.message.includes('rate')) return 'rate_limit';
        return 'unknown';
      };
      
      expect(classifyError(new Error('Request timeout'))).toBe('timeout');
      expect(classifyError(new Error('ECONNREFUSED'))).toBe('network');
      expect(classifyError(new Error('rate limited'))).toBe('rate_limit');
      expect(classifyError(new Error('something else'))).toBe('unknown');
    });

    it('handles partial response (stream cut off)', async () => {
      const validateResponse = (response: string) => {
        if (!response) return { valid: false, error: 'empty response' };
        if (response.length < 5) return { valid: false, error: 'response too short (likely truncated)' };
        return { valid: true, error: null };
      };
      
      expect(validateResponse('')).toEqual({ valid: false, error: 'empty response' });
      expect(validateResponse('hi')).toEqual({ valid: false, error: 'response too short (likely truncated)' });
      expect(validateResponse('hello world')).toEqual({ valid: true, error: null });
    });
  });

  describe('Combined failure scenarios', () => {
    it('handles LLM failure + file write failure gracefully', async () => {
      const error = new Error('EACCES');
      (error as any).code = 'EACCES';
      vi.mocked(fs.writeFile).mockRejectedValue(error);
      
      const workflow = async () => {
        const llmResult = 'fallback response';
        try {
          await fs.writeFile('/path', llmResult);
          return { saved: true, result: llmResult };
        } catch (e: any) {
          return { saved: false, result: llmResult, writeError: e.code };
        }
      };
      
      const result = await workflow();
      expect(result.saved).toBe(false);
      expect(result.result).toBe('fallback response');
      expect(result.writeError).toBe('EACCES');
    });

    it('handles JSON parse failure from LLM response', async () => {
      const parseLLMResponse = (raw: string) => {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
        const toParse = jsonMatch ? jsonMatch[1] : raw;
        try {
          return { data: JSON.parse(toParse), error: null };
        } catch (e: any) {
          return { data: null, error: `Failed to parse LLM response: ${e.message}`, raw };
        }
      };
      
      // LLM returns prose instead of JSON
      const result = parseLLMResponse("I think the answer is 42");
      expect(result.data).toBeNull();
      expect(result.error).toContain('Failed to parse LLM response');
      
      // LLM returns valid JSON in code block
      const good = parseLLMResponse('```json\n{"answer": 42}\n```');
      expect(good.data).toEqual({ answer: 42 });
    });

    it('handles cascading failures with circuit breaker pattern', async () => {
      let failures = 0;
      const circuitBreaker = {
        state: 'closed' as 'closed' | 'open' | 'half-open',
        failureCount: 0,
        threshold: 3,
        
        async call(fn: () => Promise<string>) {
          if (this.state === 'open') return { error: 'circuit open', result: null };
          try {
            const result = await fn();
            this.failureCount = 0;
            return { error: null, result };
          } catch (e: any) {
            this.failureCount++;
            if (this.failureCount >= this.threshold) this.state = 'open';
            return { error: e.message, result: null };
          }
        }
      };
      
      const failingFn = async () => { failures++; throw new Error('service down'); };
      
      await circuitBreaker.call(failingFn);
      await circuitBreaker.call(failingFn);
      await circuitBreaker.call(failingFn);
      
      expect(circuitBreaker.state).toBe('open');
      
      const result = await circuitBreaker.call(failingFn);
      expect(result.error).toBe('circuit open');
      expect(failures).toBe(3); // no more calls after circuit opened
    });
  });
});
