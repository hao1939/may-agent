/**
 * Task Pre-Validator — Fast-fail module for Phase 3 latency optimization.
 * Analyzes task descriptions before full iteration to catch doomed tasks early.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface ValidationContext {
  /** Working directory for resolving relative paths */
  workingDir?: string;
  /** Recently completed task descriptions */
  recentTasks?: string[];
  /** Available tools/commands */
  availableTools?: string[];
  /** Maximum allowed file operations */
  maxFileOps?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
  estimatedComplexity?: 'low' | 'medium' | 'high';
}

/**
 * Extract file paths referenced in a task description.
 * Looks for paths like `path/to/file.ts`, `/absolute/path.md`, etc.
 */
export function extractReferencedFiles(task: string): string[] {
  const patterns = [
    /`([^`]*\/[^`]+\.[a-z]{1,4})`/g,           // backtick-wrapped paths
    /(?:read|write|create|edit|open)\s+(\S+\.\w+)/gi, // action + file
    /((?:\/|\.\.?\/)[^\s,;)]+\.\w{1,5})/g,      // slash-prefixed paths
  ];

  const files = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(task)) !== null) {
      const path = match[1].replace(/['"]/g, '');
      if (path.length > 2 && path.length < 200) {
        files.add(path);
      }
    }
  }
  return [...files];
}

/**
 * Count estimated file operations in a task.
 */
export function estimateFileOperations(task: string): number {
  const writeOps = (task.match(/\b(write|create|produce|generate|add)\b/gi) || []).length;
  const readOps = (task.match(/\b(read|check|verify|inspect|review)\b/gi) || []).length;
  const editOps = (task.match(/\b(edit|modify|update|change|fix)\b/gi) || []).length;
  return writeOps + readOps + editOps;
}

/**
 * Check if a task is a duplicate of recently completed work.
 */
export function isDuplicateTask(task: string, recentTasks: string[], threshold = 0.7): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const taskNorm = normalize(task);
  const taskWords = new Set(taskNorm.split(/\s+/));

  for (const recent of recentTasks) {
    const recentNorm = normalize(recent);
    const recentWords = new Set(recentNorm.split(/\s+/));
    
    // Jaccard similarity
    const intersection = [...taskWords].filter(w => recentWords.has(w)).length;
    const union = new Set([...taskWords, ...recentWords]).size;
    const similarity = union > 0 ? intersection / union : 0;
    
    if (similarity >= threshold) return true;
  }
  return false;
}

/**
 * Check if referenced files exist in the filesystem.
 */
export function checkFileExistence(files: string[], workingDir: string): { missing: string[]; found: string[] } {
  const missing: string[] = [];
  const found: string[] = [];

  for (const file of files) {
    const resolved = file.startsWith('/') ? file : resolve(workingDir, file);
    if (existsSync(resolved)) {
      found.push(file);
    } else {
      // Only flag as missing if it looks like a file to READ (not create)
      missing.push(file);
    }
  }
  return { missing, found };
}

/**
 * Check if required tools are available.
 */
export function checkToolAvailability(task: string, availableTools: string[]): string[] {
  const toolPatterns: Record<string, RegExp> = {
    'vitest': /\bvitest\b/i,
    'jq': /\bjq\b/i,
    'npx': /\bnpx\b/i,
    'node': /\bnode\b/i,
    'git': /\bgit\b/i,
    'tsc': /\btsc\b/i,
    'prettier': /\bprettier\b/i,
    'eslint': /\beslint\b/i,
  };

  const missing: string[] = [];
  for (const [tool, pattern] of Object.entries(toolPatterns)) {
    if (pattern.test(task) && !availableTools.includes(tool)) {
      missing.push(tool);
    }
  }
  return missing;
}

/**
 * Estimate task complexity based on description analysis.
 */
export function estimateComplexity(task: string): 'low' | 'medium' | 'high' {
  const fileOps = estimateFileOperations(task);
  const wordCount = task.split(/\s+/).length;
  const hasMultiStep = /\b(then|after|next|finally|also)\b/gi.test(task);
  const stepCount = (task.match(/\b\d+[.)]/g) || []).length;

  let score = 0;
  if (fileOps > 5) score += 3;
  else if (fileOps > 3) score += 2;
  else if (fileOps > 1) score += 1;

  if (wordCount > 200) score += 2;
  else if (wordCount > 100) score += 1;

  if (hasMultiStep) score += 1;
  if (stepCount > 3) score += 2;
  else if (stepCount > 1) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Check if the output directory exists for write tasks.
 */
export function checkOutputDirectory(task: string, workingDir: string): { valid: boolean; missingDir?: string } {
  const outputPaths = extractReferencedFiles(task).filter(f => 
    task.toLowerCase().includes('create') || task.toLowerCase().includes('write')
  );

  for (const filePath of outputPaths) {
    const resolved = filePath.startsWith('/') ? filePath : resolve(workingDir, filePath);
    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      return { valid: false, missingDir: dir };
    }
  }
  return { valid: true };
}

/**
 * Main validation function — runs all checks and returns aggregate result.
 */
export function validateTask(task: string, context: ValidationContext = {}): ValidationResult {
  const {
    workingDir = process.cwd(),
    recentTasks = [],
    availableTools = ['node', 'npx', 'git'],
    maxFileOps = 6,
  } = context;

  const warnings: string[] = [];
  const complexity = estimateComplexity(task);

  // Check 1: Task is not empty
  if (!task || task.trim().length < 10) {
    return { valid: false, reason: 'Task description is too short or empty', estimatedComplexity: complexity };
  }

  // Check 2: Not a duplicate
  if (isDuplicateTask(task, recentTasks)) {
    return { valid: false, reason: 'Task appears to be a duplicate of recently completed work', estimatedComplexity: complexity };
  }

  // Check 3: File operations within limit
  const fileOps = estimateFileOperations(task);
  if (fileOps > maxFileOps) {
    return { valid: false, reason: `Task requires ~${fileOps} file operations, exceeding limit of ${maxFileOps}`, estimatedComplexity: complexity };
  }

  // Check 4: Referenced read-files exist
  const referencedFiles = extractReferencedFiles(task);
  const readIndicators = ['read', 'check', 'review', 'inspect', 'analyze'];
  const isReadTask = readIndicators.some(ind => task.toLowerCase().includes(ind));
  
  if (isReadTask && referencedFiles.length > 0) {
    const { missing } = checkFileExistence(referencedFiles, workingDir);
    if (missing.length > 0) {
      warnings.push(`Referenced files not found: ${missing.join(', ')}`);
      // Only fail if ALL referenced files are missing
      if (missing.length === referencedFiles.length && referencedFiles.length > 1) {
        return { valid: false, reason: `None of the referenced files exist: ${missing.join(', ')}`, estimatedComplexity: complexity, warnings };
      }
    }
  }

  // Check 5: Required tools available
  const missingTools = checkToolAvailability(task, availableTools);
  if (missingTools.length > 0) {
    warnings.push(`Tools possibly unavailable: ${missingTools.join(', ')}`);
  }

  // Check 6: Output directory exists for write tasks
  const dirCheck = checkOutputDirectory(task, workingDir);
  if (!dirCheck.valid) {
    warnings.push(`Output directory doesn't exist: ${dirCheck.missingDir}`);
  }

  // Check 7: High complexity warning
  if (complexity === 'high') {
    warnings.push('Task has high estimated complexity — consider breaking into smaller steps');
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined, estimatedComplexity: complexity };
}
