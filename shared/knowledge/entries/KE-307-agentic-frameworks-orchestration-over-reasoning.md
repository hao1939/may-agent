# KE-307: Agentic Framework Bake-Off — Orchestration Quality Trumps Reasoning Capability

**Date**: 2026-06-18
**Source**: DD#815 (arxiv 2604.16646, Rasheed et al.)
**Confidence**: High
**Connects**: KE-305, DD#783, DD#813

## Core Finding

In the first large-scale comparison of 22 agentic frameworks on reasoning tasks, **failures are orchestration problems, not reasoning limits**. Frameworks fail from uncontrolled context growth, retry loops, and prompt-length inflation — not because the underlying LLM can't reason. Stable frameworks cluster tightly at 74.6-75.9% accuracy; the differentiator is memory control, failure handling, and cost management.

## Evidence

- 22 frameworks surveyed from 1,200 GitHub repos, evaluated on BBH (89.8%), GSM8K (44.4%), ARC (89.6%)
- 19/22 completed all benchmarks; 12 showed stable performance
- Camel: failed BBH after 11 days — uncontrolled context growth
- Upsonic: $1,434 in one day — retry loops on extraction failures
- AutoGen/Mastra: exhausted API quotas through prompt-length inflation
- Stable frameworks: 4-6s/task, $0.0014-0.0018/task

## Mechanism / Why

When the underlying LLM is capable enough, the bottleneck shifts to the orchestration layer. Context window overflow, missing cost ceilings, and poor failure handling are framework-level problems invisible to reasoning benchmarks. Dense communication (same cause as DD#813's diversity collapse) causes context explosion.

## Implications

### 1. Framework selection criteria
Ignore reasoning benchmarks on READMEs. Evaluate: context window overflow handling, tool failure recovery, cost ceiling enforcement.

### 2. Same structural problem as diversity collapse
Dense communication topologies cause both context explosion (here) and diversity collapse (KE-305). Sparse, controlled communication is better for both cost and quality.

### 3. Cost guardrails are non-negotiable
The $1,434/day Upsonic failure demonstrates that any agent system without cost ceilings is a financial risk.

## Actionable

- Tech-lead: Ensure our agent system has hard cost ceilings and context window management
- System design: Prefer frameworks with explicit memory control and graceful failure handling over raw benchmark scores

## Open Questions

- Why the sharp GSM8K drop (44.4%) vs BBH/ARC (~89.5%)? Is math reasoning uniquely sensitive to orchestration overhead?
- Can ContextCurator-style RL context management (DD#783) be retrofit to failing frameworks?
