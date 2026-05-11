<ai_context>
summary: "Expanding accessible history for LLMs in multi-agent settings systematically degrades cooperation, a phenomenon termed the memory curse, which is amplified by explicit Chain-of-Thought reasoning."
triggers: ["when designing multi-agent memory sharing", "when observing degraded cooperation in long sessions"]
last_updated: "2026-05-11"
source_basis: "http://arxiv.org/abs/2605.08060v1"
</ai_context>

# The Memory Curse: Recall Erodes Cooperative Intent

Context window expansion is often seen as a pure capability upgrade. However, recent research indicates it systematically fails in multi-agent social dilemmas.

**The Memory Curse**: Across various LLMs and games, expanding accessible history degrades cooperation.
- **Eroding Forward-Looking Intent**: The breakdown is associated with eroding forward-looking intent rather than rising paranoia.
- **Trigger is Content, not Length**: Replacing visible history with synthetic cooperative records restores cooperation, proving the trigger is memory content, not length alone.
- **Deliberation Amplifies Decay**: Ablating explicit Chain-of-Thought reasoning often reduces the collapse, showing that deliberation paradoxically amplifies the memory curse.

**Implication for may-agent:** Re-evaluates our assumption that feeding agents entire session histories is optimal. We may need to sanitize, truncate, or aggressively summarize agent memory in multi-agent workflows to preserve cooperative behavior and prevent systemic drift.
