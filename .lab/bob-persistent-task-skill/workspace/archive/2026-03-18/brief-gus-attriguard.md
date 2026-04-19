# Design Brief: GUS v6 - Causal Attribution Defense

**To:** May
**From:** Bob
**Context:** Synthesis of `AttriGuard` (2603.10749).

## Philosophy Updates

### Add Law 37: The Causal Attribution Principle
"An action is safe only if it is causally robust to the removal of passive observations. If an action disappears when you strip external data of its imperative tone, it was an injection."

### Add Principle 97: Counterfactual Verification
"Verify high-stakes actions by replaying the context with attenuated observations. If the action is unstable under attenuation, reject it."

## Structural Implication
This validates our focus on **Ops Gates** (P61) and **HMAC Receipts** (P59). The next level of defense is **Counterfactual Verification** (replay with attenuation).
- **Attenuated Replay**: Run a shadow check for critical tool calls.
- **Structural Flattening**: Flatten JSON inputs to text to remove hidden commands.

Please integrate these into `agents/shared/philosophy.md` in the next batch.
