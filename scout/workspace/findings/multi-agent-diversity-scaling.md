# Finding: The Shift from Quantity to Diversity in Multi-Agent Scaling

**Date**: 2026-05-02
**Source**: Chinese AI Community (XHS)
**Tags**: #MultiAgent #Scaling #Diversity #Architecture #Harness

## The Multi-Agent Scaling Paradox
A growing consensus in the AI agent community, supported by recent research from top institutions (SJTU, Caltech, JHU, UC Berkeley) [arXiv:2602.03794], addresses the "Multi-Agent Scaling Paradox": **simply stacking more LLM agents (scaling N) quickly hits a performance ceiling, whereas increasing agent diversity (scaling K) yields sustained benefits.**

The community is realizing that the API cost of adding redundant, homogeneous agents (e.g., 16 GPT-4 agents with the same prompt/model) scales linearly, but performance plateaus almost immediately (typically around N≈4 for reasoning tasks). 

### Information-Theoretic Explanation
The theoretical explanation treats agent systems as information channels. The performance upper bound of a Multi-Agent System (MAS) is determined by the inherent uncertainty of the task ($H(Y|X)$), not the number of agent invocations. 
- **Homogeneous Agents**: Produce highly correlated outputs. They act as redundant information channels, quickly depleting the "information budget."
- **Heterogeneous Agents**: Provide complementary reasoning paths (e.g., algebraic vs. geometric deduction). They act as independent information channels. 

**The Key Metric is $K^*$ (Effective Channels)**: Two agents with identical reasoning paths count as 1 effective channel. The community is learning that **2 diverse agents can match the performance of 16 homogeneous agents**, cutting costs by 87.5%.

## Natural Language Agent Harnesses (NLAHs)
A related architectural shift focuses on the "harness"—the high-level control logic (tool calling, failure recovery, state persistence). A recent paper highlights that **the ceiling of agent capability is increasingly determined by the harness, not the underlying model.**

Historically, the harness has been embedded in private, hard-to-modify "glue code." The emerging trend is **Natural Language Agent Harnesses (NLAHs)**:
- Externalizing control logic into editable natural language specifications (conceptually similar to Claude Code's `CLAUDE.md` or OpenClaw's layered system prompts).
- This "Configuration as Code" approach for agents allows the control layer itself to become a first-class object of study, optimization, and self-evolution.

## Implications for System Design
1. **Match Diversity to the Task**: Complex reasoning tasks (like GSM8K) benefit greatly from diversity scaling, while simple common-sense tasks do not.
2. **Path Diversity over Prompt Tweaks**: Merely changing the wording of a prompt is insufficient. True diversity requires fundamentally different reasoning frameworks (e.g., "step-by-step derivation" vs. "reverse verification" vs. "special value substitution").
3. **Harness as a Modifiable Component**: We should consider moving agent orchestrations and recovery strategies out of typescript/python loops and into structured natural language configurations that agents can potentially optimize themselves.