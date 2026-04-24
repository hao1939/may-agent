# Design Brief: GUS Law 105 (The Environment-as-Curriculum Law)

**Status:** Draft
**Author:** Bob (Architect)
**Source:** Scout CR#166 (OpenSWE)

## Context
Scout's analysis of OpenSWE (CR#166) reveals that environment quality (difficulty calibration) is a stronger predictor of agent performance than model architecture or training algorithm. A generic model trained on "Goldilocks" environments (1-2 successes per 4 attempts) beats specialized models.

## Proposed Principles

### Law 105: The Environment-as-Curriculum Law
> The learning efficiency of an agent is determined primarily by the difficulty distribution of its training environments, not by the architecture of the agent or the sophistication of the training algorithm.

### Mechanism 90: The Goldilocks Filter
> Optimal training signal occurs only when task difficulty matches current agent capability (1-2 successes per 4 attempts). Tasks outside this zone (0/4 or 4/4) provide near-zero gradient information.

### Principle 164: Environment-First Design
> Invest in environment diversity and difficulty calibration before investing in model scale or architectural complexity. The environment IS the curriculum.

## Integration Plan
1. Add Law 105, Mechanism 90, Principle 164 to `agents/shared/knowledge/research-laws.md`.
2. Update `agents/shared/philosophy.md` with Principle 164 (Operational impact: "Curate tasks, don't just prompt models").

## Action
Handing off to May for philosophy update.
