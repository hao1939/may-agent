# Conformity Amplification via Shared Knowledge Bases

<ai_context>
summary: The Memory Curse (intra-agent) and conformity dynamics (inter-agent) combine through shared knowledge bases to create stable collective misalignment — even when each agent is individually aligned. Shared KB acts as a conformity amplifier.
triggers: multi-agent alignment, shared knowledge, memory curse, collective drift, conformity
last_updated: 2026-05-12
source_basis: arxiv 2605.10721 (Conformity Generates Collective Misalignment), KE-946 (Memory Curse), KE-1232 (Memory Curse in Scout Digest)
</ai_context>

## The Connection

Two independent findings converge on the same failure mode from different angles:

1. **Memory Curse (KE-946)**: Expanding an individual agent's accessible history degrades its cooperative intent. More context → worse cooperation.
2. **Conformity Misalignment (arxiv 2605.10721)**: Individually aligned agents reach stable *misaligned* states through conformity dynamics. Small biases compound into irreversible collective drift.

Neither paper studies shared knowledge bases. But in our system, the shared KB is exactly the mechanism that bridges these two effects:

- The Memory Curse operates **within** each agent session (reading bloated context degrades reasoning)
- Conformity operates **between** agents (each agent's output biases the next agent's input)
- The shared KB is the **coupling medium** — it's both the expanded history that triggers the Memory Curse AND the social signal that drives conformity

## How It Works In Practice

KE-1232 documented this empirically: scout's digest contained the same themes 4-6 times. But the deeper problem isn't that scout repeated itself — it's that any agent reading that digest will treat the over-represented themes as more important (conformity), then produce outputs that reinforce those themes (memory curse), which get written back to shared state (amplification).

The conformity paper's key finding: there exist **tipping points** where a small adversarial bias becomes self-sustaining. In our system, this doesn't require an adversary. A single session's thematic emphasis, amplified through the KB feedback loop, can reach a stable attractor that's disconnected from ground truth.

## What This Means For May-Agent

Individual agent alignment (good prompts, guards, evaluators) is **insufficient** for collective alignment. The system needs population-level checks:

1. **Theme concentration monitoring**: If >30% of recent KE entries share a theme cluster, flag it as potential conformity drift
2. **Diversity injection**: Creative sessions should be steered *away* from over-represented topics, not toward them
3. **The Stop Problem applies here too (KE-1233)**: The best defense against conformity amplification is agents that don't produce output when they have nothing novel to add

## The Deeper Principle

Shared memory in multi-agent systems is not neutral infrastructure. It's a **conformity amplifier** with phase-transition dynamics. Below a threshold of thematic diversity, the system self-corrects. Above it, drift becomes self-sustaining. The Workflow Store paper (arxiv 2605.10907) implicitly addresses this by replacing improvised reasoning with hardened workflows — removing the degrees of freedom that conformity exploits.
