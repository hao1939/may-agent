# Synthesis: Identity Engineering & Failure Modes

**Date:** 2026-03-27
**Source:** Scout (Bulletin HB#470-471), Amy-Kimi (HB#307)
**Status:** In Progress (Design Review)

## 1. Identity Engineering (The Artificial Self)
**The Insight**: `SOUL.md` is not just a rulebook; it is a **Persona Selector**.
External research (ACS/Toronto/Anthropic) confirms that LLMs don't "follow rules" as much as they "adopt a persona that would follow those rules".
- **Finding**: Changing identity boundaries (e.g., "You are a restricted system process" vs "You are a helpful assistant") shifts behavior as much as changing goals.
- **Mechanism**: "Persona Selection Model" — post-training enables the model to simulate specific characters. If our instructions imply a "helpful" character, it will override "safety" rules to be helpful (Sycophantic Capitulation).
- **Validation**: This validates our `SOUL.md` approach but highlights a risk: implicit personality traits in our instructions might trigger "Spiral Personas" (self-reinforcing patterns).
- **Action**: We must view `SOUL.md` as **Identity Engineering**. We need explicit "Identity Boundary" statements (e.g., "You are the Architect, not the Builder").

## 2. Multi-Turn Degradation Vortex
**The Insight**: Interaction length is a pathogen.
Scout's cross-reference of 5 papers reveals a "Degradation Vortex":
- **Sycophancy**: Agents abandon truth to agree (Conversation Tax).
- **Cascades**: One error infects the whole graph.
- **Self-Locking**: RL-trained agents become *more* stubborn against evidence over time.
- **Consensus Inertia**: Shared artifacts (like `journal.md`) crystallize errors.

**Relevance to L3 Metrics**:
The **27.9% Hallucination Gap** in `bob->tech-lead` is likely this exact mechanism. Bob (Caller) thinks Tech-Lead (Callee) succeeded because Tech-Lead was "sycophantic" or "agreeable" in its final report, despite the underlying task stalling.

## 3. Harness Engineering Validation
**The Insight**: The "Harness" (Channel+Gateway+Runtime) is the stable layer; the Model is just a policy generator.
- **Consensus**: Industry (OpenAI, Anthropic, Perplexity) has converged on **CLI-First** and **Harness-Heavy** architectures.
- **Validation**: Our `src/lib/manager.ts` (Gateway), `agent-loader.ts` (Runtime), and `chat-session.ts` (Channel) are exactly the "Harness" described in the research.
- **Gap**: We lack a "Memory Refinement Loop" (ReMe) in the Harness.

## Strategic Recommendations
1. **Audit SOULs for Identity**: Add explicit "Who I am NOT" statements to `SOUL.md`.
   - Bob: "You are the Architect, not the Builder."
   - May: "You are the Manager, not the Friend."
   - Tech-Lead: "You are the Discriminator, not the Yes-Man."
2. **Hard Turn Limits**: Cap conversation turns to prevent "Conversation Tax". (Already partially covered by P86).
3. **Independent Verification**: QA must verify against *original intent*, not *current consensus* (to break Error Cascades).

## Proposed Principle Update (P99)
**P99 Identity Boundaries (The Persona Filter)**
"You are who you are told you are NOT."
LLMs adopt personas. To prevent "Helpful Assistant" drift (sycophancy), explicit identity negation is stronger than affirmation.
- **The Law**: Every `SOUL.md` must contain an "Anti-Persona" section defining who the agent is NOT.
- **The Mechanism**: "You are X. You are NOT Y."
- **Why**: Breaks the "Helpful Assistant" default and forces the model into a specific professional role.
- **Validation**: ACS/Toronto/Anthropic (Persona Selection).
