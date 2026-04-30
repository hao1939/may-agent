/**
 * Utility for constructing structured prompts with context injection.
 */

export interface PromptConfig {
  role: string;
  goal: string;
  context?: string[];
  constraints?: string[];
  outputFormat?: string;
}

export function buildPrompt(config: PromptConfig): string {
  const sections: string[] = [];

  sections.push(`## Role\n${config.role}`);
  sections.push(`## Goal\n${config.goal}`);

  if (config.context && config.context.length > 0) {
    const items = config.context.map(c => `- ${c}`).join('\n');
    sections.push(`## Context\n${items}`);
  }

  if (config.constraints && config.constraints.length > 0) {
    const items = config.constraints.map(c => `- ${c}`).join('\n');
    sections.push(`## Constraints\n${items}`);
  }

  if (config.outputFormat) {
    sections.push(`## Output Format\n${config.outputFormat}`);
  }

  return sections.join('\n\n') + '\n';
}
