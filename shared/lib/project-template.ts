/**
 * Project template generator — produces consistent project.md scaffolds
 * for new satellite projects.
 */

export interface ProjectMetric {
  name: string;
  target: string;
  current?: string;
}

export interface ProjectConfig {
  name: string;
  goal: string;
  metrics: ProjectMetric[];
  owner: string;
  phase?: string;
  planItems?: string[];
}

export interface ProjectOutput {
  projectMd: string;
  planItems: string[];
}

export function generateProject(config: ProjectConfig): ProjectOutput {
  const { name, goal, metrics, owner, phase = '1', planItems } = config;

  const metricsSection = metrics
    .map(m => `| ${m.name} | ${m.current ?? '0'} | ${m.target} |`)
    .join('\n');

  const defaultPlanItems = [
    `Define success criteria for ${name}`,
    `Implement core functionality`,
    `Write tests (≥90% coverage)`,
    `Integration and validation`,
    `Documentation and handoff`,
  ];

  const finalPlanItems = planItems ?? defaultPlanItems;

  const planSection = finalPlanItems
    .map((item, i) => `${i + 1}. [ ] ${item}`)
    .join('\n');

  const projectMd = `---
id: ${name}
owner: ${owner}
status: active
type: milestone
priority: P2
iteration: 0
---

# ${name}

## Goal
${goal}

## Phase
${phase}

## Signals
| Metric | Current | Target |
|--------|---------|--------|
${metricsSection}

## Current State
New project. Establish baseline facts before acting.

## Plan
${planSection}

## Validation
Use later metrics, tests, session evidence, and owner judgment to validate whether the plan worked.

## Journal
- Created project.
`;

  return { projectMd, planItems: finalPlanItems };
}
