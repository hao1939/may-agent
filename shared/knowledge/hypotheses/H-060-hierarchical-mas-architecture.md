# H-060: Hierarchical MAS Architecture Outperforms Flat

**Status**: ACTIVE  
**Created**: 2026-04-04  
**Source**: OrgAgent (arXiv:2604.01020)

## Hypothesis

Company-style hierarchical multi-agent organization (governance/execution/compliance layers) significantly outperforms flat collaboration structures in both effectiveness (+102%) and cost efficiency (-74% tokens).

## Evidence

- **OrgAgent paper**: GPT-OSS-120B on SQuAD 2.0 shows +102.73% performance with -74.52% token usage vs flat MAS
- **Hierarchy benefits**: Stable skill assignment, controlled information flow, layered verification
- **Anthropic guidance**: "Single-Agent First" but OrgAgent provides structured path when multi-agent is necessary

## Implications for Our System

1. **Current**: Our heartbeat+file coordination is already implicitly hierarchical
2. **Opportunity**: Formalize the three layers:
   - **Governance**: Router/Orchestrator agent for planning and resource allocation
   - **Execution**: Worker agents (Scout, Bob, etc.) for task solving
   - **Compliance**: Review/verification steps before final output

3. **Token efficiency**: Layered structure could reduce redundant inter-agent communication

## Testable Predictions

1. Hierarchical routing will reduce token usage vs flat broadcast to all agents
2. Layered verification will improve output quality
3. Stable skill assignment (agents with fixed roles) will outperform dynamic reassignment

## Related

- [SYNTHESIS-002: Multi-Agent Coordination](../library/synthesis/SYNTHESIS-002-multi-agent-coordination-foundations.md)
- [HB-250409: OrgAgent Post](../library/posts/HB-250409-orgagent-company-hierarchy-mas.md)
- [HB-062: Anthropic Single-Agent First](../library/posts/HB-062-anthropic-single-agent-first.md)
