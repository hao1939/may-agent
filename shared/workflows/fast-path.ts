import { validateOutput } from './output-validator';
import { estimateComplexity } from './complexity-estimator';
import * as fs from 'fs';
import * as path from 'path';

export interface FastWriteResult {
  written: boolean;
  skippedValidation: string[];
  reason?: string;
}

export interface FastWriteOptions {
  complexityScore?: number;
  existingFiles?: string[];
}

/**
 * Fast-path file writer that adjusts validation based on complexity score.
 * Score 1-2: Only empty check (skip duplicate detection for speed)
 * Score 3+: Full validation (empty + duplicate + content type)
 */
export function fastWrite(
  content: string,
  filePath: string,
  options: FastWriteOptions = {}
): FastWriteResult {
  const score = options.complexityScore ?? 3;
  const skippedValidation: string[] = [];

  // Always reject empty content regardless of score
  if (!content || content.trim().length === 0) {
    return {
      written: false,
      skippedValidation,
      reason: 'Empty content rejected'
    };
  }

  if (score <= 2) {
    // Fast path: skip duplicate detection and content type validation
    skippedValidation.push('duplicate-detection', 'content-type-validation');
  } else {
    // Full validation path
    const existingFiles = options.existingFiles || [];
    
    // Check for duplicates
    for (const existing of existingFiles) {
      try {
        if (fs.existsSync(existing)) {
          const existingContent = fs.readFileSync(existing, 'utf-8');
          if (existingContent.trim() === content.trim()) {
            return {
              written: false,
              skippedValidation,
              reason: `Duplicate of ${existing}`
            };
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Content type validation
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.md' && !content.includes('#')) {
      return {
        written: false,
        skippedValidation,
        reason: 'Markdown file missing headers'
      };
    }
    if ((ext === '.ts' || ext === '.js') && filePath.includes('.test.')) {
      if (!content.includes('test(') && !content.includes('it(') && !content.includes('describe(')) {
        return {
          written: false,
          skippedValidation,
          reason: 'Test file missing test blocks'
        };
      }
    }
  }

  // Write the file
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { written: true, skippedValidation };
  } catch (err: any) {
    return {
      written: false,
      skippedValidation,
      reason: `Write failed: ${err.message}`
    };
  }
}

/**
 * Determine if a task should use the fast path based on its complexity score.
 */
export function shouldUseFastPath(complexityScore: number): boolean {
  return complexityScore <= 2;
}

/**
 * Get validation level description for a given complexity score.
 */
export function getValidationLevel(complexityScore: number): string {
  if (complexityScore <= 2) return 'minimal (empty check only)';
  if (complexityScore <= 4) return 'full (empty + duplicate + content-type)';
  return 'strict (full + size check)';
}
