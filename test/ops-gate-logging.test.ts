import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logOpsReceipt, OpsReceipt } from '../src/lib/ops-gate';

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:path');

describe('Ops Gate Logging', () => {
  const mockReceipt: OpsReceipt = {
    operation: 'test-op',
    status: 'success',
    timestamp: '2026-03-12T18:00:00.000Z',
    outputHash: 'test-hash',
    meta: { key: 'value' }
  };

  const mockCwd = '/mock/cwd';
  const mockLogPath = '.state/ops-receipts.jsonl';
  const expectedPath = '/mock/cwd/.state/ops-receipts.jsonl';

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    // Setup path.resolve to behave simply for our test
    vi.mocked(path.resolve).mockImplementation((base, file) => `${base}/${file}`);
    vi.mocked(path.dirname).mockReturnValue('/mock/cwd/.state');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should write receipt to the default log file', () => {
    logOpsReceipt(mockReceipt);

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/cwd/.state', { recursive: true });
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expectedPath,
      JSON.stringify(mockReceipt) + '\n',
      'utf-8'
    );
  });

  it('should use custom log path if provided', () => {
    const customPath = 'custom/log.jsonl';
    vi.mocked(path.dirname).mockReturnValue('/mock/cwd/custom');
    
    logOpsReceipt(mockReceipt, customPath);

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/cwd/custom', { recursive: true });
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/mock/cwd/custom/log.jsonl',
      JSON.stringify(mockReceipt) + '\n',
      'utf-8'
    );
  });

  it('should not throw if file operations fail (silent failure)', () => {
    vi.mocked(fs.appendFileSync).mockImplementation(() => {
      throw new Error('Disk full');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    expect(() => logOpsReceipt(mockReceipt)).not.toThrow();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ops-gate] Failed to log receipt:'),
      expect.any(Error)
    );
  });

  it('should resolve path relative to provided cwd', () => {
    const customCwd = '/custom/cwd';
    vi.mocked(path.dirname).mockReturnValue('/custom/cwd/.state');
    
    logOpsReceipt(mockReceipt, undefined, customCwd);

    expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/cwd/.state', { recursive: true });
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/custom/cwd/.state/ops-receipts.jsonl',
      JSON.stringify(mockReceipt) + '\n',
      'utf-8'
    );
  });
});
