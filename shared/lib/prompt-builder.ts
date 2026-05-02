/**
 * Utility for constructing structured prompts with context injection.
 * 
 * Supports task-aware context filtering (EXP-235) via filterContext integration.
 * When agentName and task are provided, context is filtered to only relevant entries.
 */

import { filterContext, loadSkills } from "./context-filter.ts";

export interface PromptConfig {
  role: string;
  goal: string;
  context?: string[];
  constraints?: string[];
  outputFormat?: string;
  /** Agent name — enables task-aware context filtering (EXP-235) */
  agentName?: string;
  /** Task description — used for keyword matching when filtering context */
  task?: string;
}

export function buildPrompt(config: PromptConfig): string {
  const sections: string[] = [];

  sections.push(`## Role\n${config.role}`);
  sections.push(`## Goal\n${config.goal}`);

  // EXP-235: Task-aware context filtering
  if (config.agentName && config.task) {
    const result = filterContext(config.agentName, config.task);
    if (result.filteredContext) {
      sections.push(`## Context (filtered)\n${result.filteredContext}`);
      const skills = loadSkills(config.agentName, result.skills);
      if (skills.length > 0) {
        sections.push(`## Relevant Skills\n${skills.join('\n\n---\n\n')}`);
      }
    }
  } else if (config.context && config.context.length > 0) {
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
