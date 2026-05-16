import { validateProjectConfig } from '../../lib/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Hook that runs when a new project.md is created.
 * Validates the project config structure and returns errors if invalid.
 */
export function onProjectCreate(content: string): ValidationResult {
  const result = validateProjectConfig(content);
  return {
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * Guard version that throws on invalid config — use in pipelines
 * where you want to halt execution on bad input.
 */
export function requireValidProject(content: string): void {
  const result = onProjectCreate(content);
  if (!result.valid) {
    throw new Error(`Invalid project config:\n${result.errors.join('\n')}`);
  }
}
