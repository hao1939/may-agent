import * as fs from 'fs';
import * as path from 'path';

interface FastWriteOptions {
  complexityScore?: number;
  existingFiles?: string[];
}

interface FastWriteResult {
  written: boolean;
  reason?: string;
  skippedValidation: string[];
}

export function shouldUseFastPath(score: number): boolean {
  return score <= 2;
}

export function getValidationLevel(score: number): string {
  if (score <= 2) return 'minimal';
  if (score <= 4) return 'full';
  return 'strict';
}

export function fastWrite(content: string, filePath: string, options?: FastWriteOptions): FastWriteResult {
  const score = options?.complexityScore ?? 3;
  const existingFiles = options?.existingFiles ?? [];

  // Empty content always rejected
  if (!content || !content.trim()) {
    return { written: false, reason: 'Empty content', skippedValidation: [] };
  }

  const skippedValidation: string[] = [];
  const ext = path.extname(filePath);

  if (shouldUseFastPath(score)) {
    // Fast path: skip duplicate detection and content-type validation
    skippedValidation.push('duplicate-detection', 'content-type-validation');
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    return { written: true, skippedValidation };
  }

  // Full validation path (score 3+)

  // Duplicate detection
  for (const existing of existingFiles) {
    try {
      const existingContent = fs.readFileSync(existing, 'utf-8');
      if (existingContent === content) {
        return { written: false, reason: 'Duplicate of existing file', skippedValidation: [] };
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  // Content-type validation
  if (ext === '.md') {
    if (!content.includes('#')) {
      return { written: false, reason: 'Markdown files must have headers', skippedValidation: [] };
    }
  }

  if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.js')) {
    if (!content.includes('describe') && !content.includes('it(') && !content.includes('test(')) {
      return { written: false, reason: 'Test files must contain test blocks', skippedValidation: [] };
    }
  }

  // Write the file
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  return { written: true, skippedValidation: [] };
}
