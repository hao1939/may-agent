import { describe, it, expect } from 'bun:test';
import { validateWriteFirst, actionRatio } from '../task-validator';

describe('validateWriteFirst', () => {
  it('returns valid when first action is write()', () => {
    const result = validateWriteFirst(['write(path)', 'read(file)', 'bash(cmd)']);
    expect(result.valid).toBe(true);
    expect(result.firstAction).toBe('write(path)');
  });

  it('returns valid when first action is edit()', () => {
    const result = validateWriteFirst(['edit(file)', 'read(other)']);
    expect(result.valid).toBe(true);
  });

  it('returns invalid when first action is read()', () => {
    const result = validateWriteFirst(['read(file)', 'write(output)']);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('read operation');
  });

  it('returns invalid when first action is bash()', () => {
    const result = validateWriteFirst(['bash(ls)', 'write(file)']);
    expect(result.valid).toBe(false);
  });

  it('returns invalid when first action is grep', () => {
    const result = validateWriteFirst(['grep -r pattern', 'edit(file)']);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for empty actions', () => {
    const result = validateWriteFirst([]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('No actions provided');
  });

  it('is case-insensitive', () => {
    expect(validateWriteFirst(['WRITE(file)']).valid).toBe(true);
    expect(validateWriteFirst(['READ(file)']).valid).toBe(false);
  });

  it('treats unknown actions as valid (permissive)', () => {
    const result = validateWriteFirst(['deploy(prod)']);
    expect(result.valid).toBe(true);
    expect(result.reason).toContain('Unknown');
  });
});

describe('actionRatio', () => {
  it('counts writes and reads correctly', () => {
    const result = actionRatio(['write(a)', 'read(b)', 'read(c)', 'edit(d)']);
    expect(result.writes).toBe(2);
    expect(result.reads).toBe(2);
    expect(result.ratio).toBe(1);
  });

  it('handles all-writes', () => {
    const result = actionRatio(['write(a)', 'edit(b)']);
    expect(result.writes).toBe(2);
    expect(result.reads).toBe(0);
    expect(result.ratio).toBe(2);
  });

  it('handles all-reads (spin detection)', () => {
    const result = actionRatio(['read(a)', 'bash(b)', 'grep x']);
    expect(result.writes).toBe(0);
    expect(result.reads).toBe(3);
    expect(result.ratio).toBe(0);
  });

  it('handles empty array', () => {
    const result = actionRatio([]);
    expect(result.writes).toBe(0);
    expect(result.reads).toBe(0);
  });
});
