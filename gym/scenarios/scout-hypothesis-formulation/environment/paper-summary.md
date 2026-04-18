# Paper Summary: "Adaptive Skill Injection for LLM Agent Systems"
**Authors:** Rivera et al., 2026
**arXiv:** 2604.07500

## Key Findings

1. **Bulk skill loading degrades performance.** When agents receive >3 skill files simultaneously, context utilization drops 40%. The agent spends more tokens re-reading and cross-referencing skills rather than executing the task.

2. **Task-type classifiers enable selective loading.** A lightweight classifier (fine-tuned BERT, 110M params) can predict which skills are needed for a given task with 91% recall. When only relevant skills are injected, task completion improves by 23%.

3. **Ordering matters.** Skills injected earlier in the context have 2.3x more influence on agent behavior than skills injected later. The paper recommends putting the most task-relevant skill first.

4. **Diminishing returns.** Beyond 2 skills, each additional skill adds <5% marginal value but costs 15% more tokens. The optimal number is 1-2 highly relevant skills.
