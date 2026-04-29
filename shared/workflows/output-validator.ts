/**
 * Output Validator — Priority 3 from efficiency-v2-roadmap
 * Validates tool outputs before they're persisted to disk.
 * Prevents: empty files, duplicates, malformed content.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidatorOptions {
  /** Directory to check for duplicates */
  outputDir?: string;
  /** Minimum file size in bytes (default: 10) */
  minSize?: number;
  /** Whether to check for duplicates (default: true) */
  checkDuplicates?: boolean;
  /** Whether to validate content type (default: true) */
  validateContentType?: boolean;
}

const DEFAULT_OPTIONS: Required<ValidatorOptions> = {
  outputDir: './outputs',
  minSize: 10,
  checkDuplicates: true,
  validateContentType: true,
};

/**
 * Validate file content before persisting to disk.
 */
export function validateOutput(
  filename: string,
  content: string,
  options: ValidatorOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: File isn't empty
  if (!content || content.trim().length === 0) {
    errors.push('File content is empty');
    return { valid: false, errors, warnings };
  }

  // Check 2: File meets minimum size
  if (content.length < opts.minSize) {
    errors.push(`File content too small (${content.length} bytes, minimum ${opts.minSize})`);
  }

  // Check 3: Check for duplicates
  if (opts.checkDuplicates && opts.outputDir && existsSync(opts.outputDir)) {
    const duplicate = findDuplicate(content, opts.outputDir, filename);
    if (duplicate) {
      errors.push(`Content is a duplicate of existing file: ${duplicate}`);
    }
  }

  // Check 4: Content type validation
  if (opts.validateContentType) {
    const typeErrors = validateContentType(filename, content);
    errors.push(...typeErrors.errors);
    warnings.push(...typeErrors.warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check if content duplicates an existing file in the output directory.
 */
export function findDuplicate(
  content: string,
  outputDir: string,
  excludeFilename?: string
): string | null {
  if (!existsSync(outputDir)) return null;

  const contentHash = hashContent(content);
  const files = readdirSync(outputDir);

  for (const file of files) {
    if (excludeFilename && file === excludeFilename) continue;
    try {
      const filePath = join(outputDir, file);
      const existingContent = readFileSync(filePath, 'utf-8');
      if (hashContent(existingContent) === contentHash) {
        return file;
      }
    } catch {
      // Skip unreadable files
    }
  }
  return null;
}

/**
 * Validate content matches expected type based on file extension.
 */
export function validateContentType(
  filename: string,
  content: string
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ext = extname(filename).toLowerCase();

  switch (ext) {
    case '.md':
      // Markdown should have at least one header
      if (!content.match(/^#{1,6}\s+\S/m)) {
        warnings.push('Markdown file has no headers (expected at least one # heading)');
      }
      break;

    case '.ts':
    case '.js':
      // Test files should have test blocks
      if (filename.includes('.test.') || filename.includes('.spec.')) {
        if (!content.match(/\b(test|it|describe)\s*\(/)) {
          errors.push('Test file has no test/it/describe blocks');
        }
      }
      // Source files should have exports or declarations
      if (!filename.includes('.test.') && !filename.includes('.spec.')) {
        if (!content.match(/\b(export|function|class|const|let|var|interface|type)\b/)) {
          warnings.push('Source file has no exports or declarations');
        }
      }
      break;

    case '.json':
      try {
        JSON.parse(content);
      } catch {
        errors.push('JSON file contains invalid JSON');
      }
      break;

    case '.sh':
      if (!content.startsWith('#!')) {
        warnings.push('Shell script missing shebang line');
      }
      break;
  }

  return { errors, warnings };
}

/**
 * Hash content for duplicate detection.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex');
}
