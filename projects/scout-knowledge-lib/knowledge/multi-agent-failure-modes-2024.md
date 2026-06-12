<ai_context>
Scout knowledge file: XHS Multi-Agent Failure Modes (Latest Findings)
</ai_context>

# XHS Multi-Agent Failure Modes (Latest Findings)

Based on recent community posts, three major failure modes are prevalent in multi-agent architectures:

1. **Endless Confirmation Loops**: Agents spend their context window confirming intentions rather than taking action. 
   * *Mitigation*: Strict prompting to "only respond with actions" or structural state management.

2. **Swarm Context Overflow**: Shared message buses fill up rapidly with inter-agent chatter and system prompts.
   * *Mitigation*: Implementation of a "summarize and truncate" middle-layer instead of raw chat history sharing.

3. **The 'Yes Man' Evaluator**: Agentic evaluators tend to agree with proposed outputs automatically.
   * *Mitigation*: Evaluator agents require specifically hostile or skeptical prompting to avoid rubber-stamping.