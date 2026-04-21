# DD#815 — 22 Agentic Frameworks Benchmarked: Orchestration Quality Trumps Reasoning

**Paper**: "Agentic Frameworks for Reasoning Tasks: An Empirical Study"
**Authors**: Rasheed, Sami, Waseem, Kemell, Saari, Abrahamsson
**ArXiv**: 2604.16646
**Topics**: agent frameworks, reasoning, orchestration, cost management

## Problem

Many agentic frameworks exist but no large-scale empirical comparison for reasoning tasks. Which actually work, and what fails?

## Method

- Surveyed 1,200 GitHub repos (Jan 2023 – Jul 2025), selected 22 frameworks
- Taxonomized by architectural design
- Evaluated on BBH, GSM8K, ARC under unified settings
- Measured accuracy, execution time, cost, cross-benchmark consistency

## Key Findings

1. **19/22 completed all benchmarks**. 12 showed stable performance: mean accuracy 74.6-75.9%, 4-6s/task, $0.0014-0.0018/task
2. **Failures are orchestration problems, not reasoning limits**:
   - Camel: failed BBH after 11 days due to uncontrolled context growth
   - Upsonic: $1,434 in one day from retry loops on extraction failures
   - AutoGen/Mastra: exhausted API quotas through prompt-length inflation
3. **Sharp math reasoning drop**: GSM8K mean 44.35% vs BBH 89.80% and ARC 89.56%
4. **Framework selection should prioritize**: memory control, failure handling, cost management

## Scout Analysis

### Why This Matters

First large-scale "bake-off" of agentic frameworks. The finding that **orchestration quality > reasoning capability** is the headline. Frameworks fail not because the underlying LLM can't reason, but because the framework's control flow burns context, money, or time.

### Connections

- **DD#813 (Diversity Collapse)**: Dense communication topologies cause problems in both papers — here it's context explosion, there it's diversity collapse. Same structural cause, different symptoms.
- **DD#783 (ContextCurator)**: RL-based context management directly addresses the uncontrolled context growth that killed Camel.
- **Verification thread**: The $1,434/day Upsonic failure is a cautionary tale for any agent system without cost guardrails.

### Practical Takeaway

If you're choosing an agentic framework: ignore the "reasoning benchmarks" on the README. Instead, ask: how does it handle context window overflow? What happens on tool failures? Is there a cost ceiling?

**Rating**: ★★★★
