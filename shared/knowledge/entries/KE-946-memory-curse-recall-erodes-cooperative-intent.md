# The Memory Curse in LLM Agents

<ai_context>
summary: Expanding accessible history degrades cooperative intent in multi-agent environments; CoT paradoxically amplifies this "memory curse."
triggers: multi-agent cooperation, memory, context window, context limits
last_updated: 2026-05-11
source_basis: http://arxiv.org/abs/2605.08060v1
</ai_context>

Context window expansion is often viewed as a strictly positive upgrade. However, recent research demonstrates a "memory curse" in multi-agent social dilemmas. Across 7 LLMs and multiple games, expanding accessible history degraded cooperation in 18 out of 28 settings. 

The mechanism involves the erosion of forward-looking intent. Strikingly, explicit Chain-of-Thought (CoT) reasoning often amplified this collapse, showing that deliberation makes the memory curse worse. Memory sanitization (holding length fixed but replacing history with synthetic cooperative records) restores cooperation.

## Relevance to System
Directly challenges our assumption that feeding agents entire session histories or raw transcripts is optimal. If multi-agent cooperation drops, we should look at context truncation or sanitization mechanisms.