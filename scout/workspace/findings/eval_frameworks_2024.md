# Findings: Multi-Agent Evaluation Frameworks

## Context
Searched for recent papers on evaluating multi-agent systems.

## Key Trends
1. **Move beyond static benchmarks**: The community is realizing static QA benchmarks are insufficient for multi-agent systems where emergent behavior occurs.
2. **Trajectory evaluation**: Evaluating the steps agents take, not just the final outcome.
3. **Agent-as-a-Judge**: Using LLMs to evaluate the interactions between other LLMs.

## Relevance to SOUL
We should consider implementing an "Agent-as-a-Judge" pattern where a dedicated agent evaluates the interaction transcripts of other agents for efficiency and constraint adherence.