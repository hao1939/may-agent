import { describe, it, expect } from 'vitest';
import {
  validateTask,
  extractReferencedFiles,
  estimateFileOperations,
  isDuplicateTask,
  checkFileExistence,
  checkToolAvailability,
  estimateComplexity,
  checkOutputDirectory,
} from '../workflows/task-validator';

describe('extractReferencedFiles', () => {
  it('extracts backtick-wrapped file paths', () => {
    const task = 'Read `src/index.ts` and `lib/utils.ts` for context';
    const files = extractReferencedFiles(task);
    expect(files).toContain('src/index.ts');
    expect(files).toContain('lib/utils.ts');
  });

  it('extracts paths with action verbs', () => {
    const task = 'Create outputs/report.md with the findings';
    const files = extractReferencedFiles(task);
    expect(files).toContain('outputs/report.md');
  });

  it('extracts absolute paths', () => {
    const task = 'Check /app/agents/shared/workflows/master-worker.ts';
    const files = extractReferencedFiles(task);
    expect(files).toContain('/app/agents/shared/workflows/master-worker.ts');
  });

  it('returns empty for tasks without file references', () => {
    const task = 'Think about the architecture and propose improvements';
    const files = extractReferencedFiles(task);
    expect(files.length).toBe(0);
  });

  it('handles relative paths with dots', () => {
    const task = 'Read ./config/settings.json for defaults';
    const files = extractReferencedFiles(task);
    expect(files).toContain('./config/settings.json');
  });
});

describe('estimateFileOperations', () => {
  it('counts write operations', () => {
    const task = 'Create file A, write file B, generate file C';
    expect(estimateFileOperations(task)).toBe(3);
  });

  it('counts read operations', () => {
    const task = 'Read the config, check the output, verify the test';
    expect(estimateFileOperations(task)).toBe(3);
  });

  it('counts mixed operations', () => {
    const task = 'Read src/app.ts, edit the imports, write a test, verify it passes';
    expect(estimateFileOperations(task)).toBe(4);
  });

  it('returns 0 for simple tasks', () => {
    const task = 'Think about the best approach';
    expect(estimateFileOperations(task)).toBe(0);
  });
});

describe('isDuplicateTask', () => {
  it('detects duplicate tasks', () => {
    const task = 'Write a test for the output validator module';
    const recent = ['Write tests for the output validator module'];
    expect(isDuplicateTask(task, recent)).toBe(true);
  });

  it('allows different tasks', () => {
    const task = 'Implement retry logic with exponential backoff';
    const recent = ['Write a latency profiling report'];
    expect(isDuplicateTask(task, recent)).toBe(false);
  });

  it('handles empty recent list', () => {
    expect(isDuplicateTask('any task', [])).toBe(false);
  });

  it('respects threshold', () => {
    const task = 'Create a comprehensive test suite for validation';
    const recent = ['Create a test suite for retry logic'];
    // Different enough at 0.7 threshold
    expect(isDuplicateTask(task, recent, 0.9)).toBe(false);
  });
});

describe('checkFileExistence', () => {
  it('identifies existing files', () => {
    const { found } = checkFileExistence(['/app/agents/shared/workflows/task-validator.ts'], '/app');
    expect(found).toContain('/app/agents/shared/workflows/task-validator.ts');
  });

  it('identifies missing files', () => {
    const { missing } = checkFileExistence(['nonexistent/file.ts'], '/app');
    expect(missing).toContain('nonexistent/file.ts');
  });

  it('handles empty file list', () => {
    const { missing, found } = checkFileExistence([], '/app');
    expect(missing).toHaveLength(0);
    expect(found).toHaveLength(0);
  });
});

describe('checkToolAvailability', () => {
  it('detects missing tools', () => {
    const missing = checkToolAvailability('Run vitest and prettier', ['node', 'npx']);
    expect(missing).toContain('vitest');
    expect(missing).toContain('prettier');
  });

  it('passes when tools are available', () => {
    const missing = checkToolAvailability('Run vitest tests', ['node', 'npx', 'vitest']);
    expect(missing).not.toContain('vitest');
  });

  it('returns empty for tasks without tool references', () => {
    const missing = checkToolAvailability('Think about architecture', []);
    expect(missing).toHaveLength(0);
  });
});

describe('estimateComplexity', () => {
  it('rates simple tasks as low', () => {
    const task = 'Write a single file with the report';
    expect(estimateComplexity(task)).toBe('low');
  });

  it('rates multi-step tasks as medium or high', () => {
    const task = '1. Read the config 2. Edit the imports 3. Write tests 4. Verify output 5. Update docs';
    const complexity = estimateComplexity(task);
    expect(['medium', 'high']).toContain(complexity);
  });

  it('rates very long tasks as higher complexity', () => {
    const task = 'Read ' + 'file '.repeat(50) + 'then create ' + 'output '.repeat(50);
    const complexity = estimateComplexity(task);
    expect(['medium', 'high']).toContain(complexity);
  });
});

describe('checkOutputDirectory', () => {
  it('passes when output directory exists', () => {
    const task = 'Create /app/agents/shared/workflows/new-file.ts';
    const result = checkOutputDirectory(task, '/app');
    expect(result.valid).toBe(true);
  });

  it('warns when output directory is missing', () => {
    const task = 'Create /nonexistent/path/output.md';
    const result = checkOutputDirectory(task, '/app');
    expect(result.valid).toBe(false);
    expect(result.missingDir).toBe('/nonexistent/path');
  });
});

describe('validateTask', () => {
  it('rejects empty tasks', () => {
    const result = validateTask('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('too short');
  });

  it('rejects very short tasks', () => {
    const result = validateTask('do it');
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate tasks', () => {
    const result = validateTask('Write the output validator tests', {
      recentTasks: ['Write the output validator tests'],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('duplicate');
  });

  it('rejects tasks with too many file operations', () => {
    const result = validateTask(
      'Read file A, read file B, check file C, write file D, create file E, generate file F, edit file G, modify file H',
      { maxFileOps: 5 }
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('file operations');
  });

  it('accepts valid simple tasks', () => {
    const result = validateTask('Create a markdown report summarizing the test results');
    expect(result.valid).toBe(true);
  });

  it('provides complexity estimate', () => {
    const result = validateTask('Write a simple one-line fix to the config');
    expect(result.estimatedComplexity).toBeDefined();
  });

  it('includes warnings for missing tools', () => {
    const result = validateTask('Run eslint on all typescript files', {
      availableTools: ['node', 'npx'],
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('eslint'))).toBe(true);
  });

  it('includes warnings for high complexity', () => {
    const task = '1. Read all configs 2. Edit imports 3. Write new module 4. Create tests 5. Update docs 6. Verify everything works';
    const result = validateTask(task);
    if (result.estimatedComplexity === 'high') {
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('complexity'))).toBe(true);
    }
  });
});
