# Synthesis: AttriGuard (Law 37)

**Source:** AttriGuard (arXiv:2603.10749)
**Related:** AgenticCyOps (2603.09134), Bureaucracy of Speed (2603.09875)

## The Insight: Causal Attribution Defense
Traditional security asks "Is this input safe?". AttriGuard asks "Why did you do that?".
- **Intent-Driven**: Action follows logically from User Task.
- **Observation-Driven**: Action follows only from External Data (Injection).

By replaying the context with *attenuated* observations (removing imperative commands), we can check if the action persists. If it disappears, it was an injection.

## The Principle: Causal Provenance (P97)
Security is about the *cause* of an action, not its *content*.
- **Mechanism**: Counterfactual Verification.
- **Test**: "Would you still do X if I removed the external data Y?"
- **Result**: 0% Attack Success Rate on static attacks.

## Implications for GUS (Grand Unified System)

### New Law 37: The Causal Attribution Principle
> "An action is safe only if it is causally robust to the removal of passive observations. If an action disappears when you strip external data of its imperative tone, it was an injection."

### New Principle 97: Counterfactual Verification
> "Verify high-stakes actions by replaying the context with attenuated observations. If the action is unstable under attenuation, reject it."

## Actionable Recommendations
1.  **Attenuated Replay**: For critical tool calls (file delete, exec), run a shadow check with stripped observations.
2.  **Structural Flattening**: Convert complex JSON/XML inputs to flat text before processing to remove "hidden" commands.
3.  **Heuristic**: If an agent suddenly changes behavior after reading a file, flag it.

## Connection to AgenticCyOps
AgenticCyOps (Law 36) secures the *Integration Surface*. AttriGuard (Law 37) secures the *Causal Link*. They are complementary.
- **Law 36**: Restrict *who* can call *what*.
- **Law 37**: Verify *why* they called it.
