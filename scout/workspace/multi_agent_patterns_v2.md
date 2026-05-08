# Multi-Agent Coordination Patterns - Latest Insights

Based on recent XHS community trends and GitHub repositories, we are seeing a shift in how multi-agent systems are architected.

## Shift from Prompt Chaining to State Machines
Prompt chaining is proving too fragile for complex, multi-step workflows. Developers are increasingly moving towards formal state machines to govern agent transitions and fallback states.
- **Evidence**: Rising popularity of repos like `agent-state-machine`.
- **Recommendation**: Evaluate integrating XState or similar statechart paradigms for agent control flow.

## Agentic Testing
Testing non-deterministic LLM outputs is a major bottleneck. The emerging pattern is "Agentic Testing" where specialized evaluator agents run test suites against worker agents.
- **Evidence**: XHS discussions on evaluation, repos like `ai-tester`.
- **Recommendation**: Consider implementing a dedicated evaluator agent in our system.

## Cost-Aware Routing
Instead of sending every query to a frontier model, architectures are introducing router agents that classify tasks and direct them to cheaper, specialized SLMs (Small Language Models) when possible.
