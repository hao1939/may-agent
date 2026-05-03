import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

// Simulated workflow helpers that mirror patterns in hardened files
function safeJsonParse(text: string, context: string): { data: any; error?: string } {
  try {
    return { data: JSON.parse(text) };
  } catch (e: any) {
    return { data: null, error: `JSON parse failed in ${context}: ${e.message}` };
  }
}

async function safeReadFile(path: string, fallback: string = ''): Promise<{ content: string; error?: string }> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return { content: content as unknown as string };
  } catch (e: any) {
    return { content: fallback, error: `File read failed: ${e.code || e.message}` };
  }
}

async function safeWriteFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    await fs.writeFile(path, content);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: `File write failed: ${e.code || e.message}` };
  }
}

async function safeLlmCall(promptFn: () => Promise<string>, retries = 3): Promise<{ result: string; error?: string }> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await promptFn();
      return { result };
    } catch (e: any) {
      if (i === retries - 1) {
        return { result: '', error: `LLM call failed after ${retries} retries: ${e.message}` };
      }
    }
  }
  return { result: '', error: 'Unexpected failure' };
}

describe('Failure Injection: File I/O Errors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles ENOENT on readFile gracefully', async () => {
    const err = Object.assign(new Error('File not found'), { code: 'ENOENT' });
    vi.mocked(fs.readFile).mockRejectedValue(err);
    const result = await safeReadFile('/nonexistent/path.json', '{}');
    expect(result.content).toBe('{}');
    expect(result.error).toContain('ENOENT');
  });

  it('handles EACCES on readFile gracefully', async () => {
    const err = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    vi.mocked(fs.readFile).mockRejectedValue(err);
    const result = await safeReadFile('/protected/file.ts', 'fallback');
    expect(result.content).toBe('fallback');
    expect(result.error).toContain('EACCES');
  });

  it('handles ENOENT on writeFile gracefully', async () => {
    const err = Object.assign(new Error('No such directory'), { code: 'ENOENT' });
    vi.mocked(fs.writeFile).mockRejectedValue(err);
    const result = await safeWriteFile('/bad/path/file.json', '{}');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });

  it('handles EACCES on writeFile gracefully', async () => {
    const err = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    vi.mocked(fs.writeFile).mockRejectedValue(err);
    const result = await safeWriteFile('/readonly/file.json', 'data');
    expect(result.success).toBe(false);
    expect(result.error).toContain('EACCES');
  });

  it('handles EMFILE (too many open files) gracefully', async () => {
    const err = Object.assign(new Error('Too many open files'), { code: 'EMFILE' });
    vi.mocked(fs.readFile).mockRejectedValue(err);
    const result = await safeReadFile('/any/file.ts', 'default');
    expect(result.content).toBe('default');
    expect(result.error).toContain('EMFILE');
  });

  it('returns content on successful read', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"key": "value"}' as any);
    const result = await safeReadFile('/good/file.json');
    expect(result.content).toBe('{"key": "value"}');
    expect(result.error).toBeUndefined();
  });
});

describe('Failure Injection: JSON Parse Errors', () => {
  it('handles empty string', () => {
    const result = safeJsonParse('', 'config');
    expect(result.data).toBeNull();
    expect(result.error).toContain('JSON parse failed in config');
  });

  it('handles truncated JSON', () => {
    const result = safeJsonParse('{"key": "val', 'response');
    expect(result.data).toBeNull();
    expect(result.error).toContain('JSON parse failed in response');
  });

  it('handles undefined-like strings', () => {
    const result = safeJsonParse('undefined', 'llm-output');
    expect(result.data).toBeNull();
    expect(result.error).toContain('JSON parse failed');
  });

  it('handles valid JSON correctly', () => {
    const result = safeJsonParse('{"status": "ok"}', 'test');
    expect(result.data).toEqual({ status: 'ok' });
    expect(result.error).toBeUndefined();
  });

  it('handles array JSON correctly', () => {
    const result = safeJsonParse('[1,2,3]', 'array');
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.error).toBeUndefined();
  });
});

describe('Failure Injection: LLM Timeout/Errors', () => {
  it('retries on timeout and eventually fails gracefully', async () => {
    const timeoutFn = vi.fn().mockRejectedValue(new Error('Request timeout'));
    const result = await safeLlmCall(timeoutFn, 3);
    expect(timeoutFn).toHaveBeenCalledTimes(3);
    expect(result.result).toBe('');
    expect(result.error).toContain('failed after 3 retries');
  });

  it('succeeds on second retry after initial failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success response');
    const result = await safeLlmCall(fn, 3);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.result).toBe('success response');
    expect(result.error).toBeUndefined();
  });

  it('handles network errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await safeLlmCall(fn, 2);
    expect(result.error).toContain('failed after 2 retries');
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('handles rate limit errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'));
    const result = await safeLlmCall(fn, 3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.error).toContain('429 Too Many Requests');
  });

  it('succeeds immediately when no error', async () => {
    const fn = vi.fn().mockResolvedValue('immediate success');
    const result = await safeLlmCall(fn, 3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.result).toBe('immediate success');
  });

  it('handles single retry config', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await safeLlmCall(fn, 1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.error).toContain('failed after 1 retries');
  });
});
