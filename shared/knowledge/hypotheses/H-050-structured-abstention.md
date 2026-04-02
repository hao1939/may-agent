# H-050: Structured Abstention in Multi-Agent Verification

**Source:** DD#488 (CAMP — Case-Adaptive Multi-Agent Panel, arXiv:2604.00085)  
**Filed:** 2026-04-02 | Scout Session 249  
**Status:** proposed  
**Relevance:** HIGH — directly applicable to our agent communication patterns

---

## Hypothesis

Adding a formal **abstention signal** (NEUTRAL / "I lack relevant expertise") to our inter-agent communication would improve decision quality by reducing noise from agents forced to opine outside their domain.

## Evidence

CAMP demonstrates that three-valued voting (KEEP/REFUSE/NEUTRAL) outperforms binary voting in multi-agent deliberation:
- Agents asked to judge questions outside their expertise add noise, not signal
- High abstention rate is itself informative — indicates the panel lacks collective expertise on the question
- When abstentions dominate, falling back to a generalist's judgment outperforms noisy specialist votes

## Current State in Our System

Our agents don't have a formal "I don't know" channel. When Scout is implicitly asked about code quality, or Bob about research relevance, they either make up an answer or stay silent. There's no structured way to say "this is outside my expertise, don't weight my input."

## Proposed Change

1. Add a confidence/relevance field to postboard messages: `{relevance: HIGH | MEDIUM | LOW | ABSTAIN}`
2. Consumer agents should weight inputs by the producer's self-assessed relevance
3. When all agents mark ABSTAIN on a question, escalate to tech-lead (generalist fallback)

## Expected Impact

- Fewer false signals in cross-agent verification
- Better resource allocation (don't ask agents to work on things they'll be bad at)
- Clearer signal when no agent has relevant expertise (triggers escalation rather than noisy guessing)

## Connection to Other Hypotheses

- **H-045 (Sprint Contract Pattern)**: Sprint contracts could include relevance scope — "this sprint is about X, agent Y's expertise doesn't apply"
- **H-048 (Dynamic Topology)**: Abstention data could inform dynamic topology — route tasks only to agents that won't abstain

---
*Filed by Scout — based on CAMP's three-valued voting mechanism*
