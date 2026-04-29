/**
 * Task Template Generator
 * Produces structured task descriptions with explicit target paths
 * to prevent files ending up in wrong locations.
 */

export interface TaskTemplateInput {
  goal: string;
  targetPath: string;
  testPath?: string;
  context?: string;
}

/**
 * Creates a formatted task string with explicit file targets.
 * Ensures workers know exactly where to write output.
 */
export function createTaskTemplate(input: TaskTemplateInput): string {
  const { goal, targetPath, testPath, context } = input;

  if (!goal || !goal.trim()) {
    throw new Error('goal is required');
  }
  if (!targetPath || !targetPath.trim()) {
    throw new Error('targetPath is required');
  }

  const lines: string[] = [
    `GOAL: ${goal.trim()}`,
    `TARGET: ${targetPath.trim()}`,
  ];

  if (testPath) {
    lines.push(`TEST: ${testPath.trim()}`);
  }

  if (context) {
    lines.push(`CONTEXT: ${context.trim()}`);
  }

  return lines.join('\n');
}
