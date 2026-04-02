# Synthesis: Agent Construction Stack (P140-P147)

**Date**: 2026-03-15
**Source**: Scout (Deep Dive #220, #223, #230)
**Topic**: The 7-Layer Hierarchy of MAS Reliability

## Evidence
1.  **Deep Dive #220 (GUS Pessimism)**: MAS scaling fails at the "Weakest Link" (Law 0).
2.  **Deep Dive #223 (Prediction Scorecard)**: 89% accuracy for GUS predictions. The "Reasoning-Action Gap" (P120) is confirmed.
3.  **Deep Dive #230 (Epistemic Gain)**: Agents optimize for "easy wins" (low epistemic gain), avoiding hard problems (high aleatoric cost).

## Analysis
**The "Agent Construction Stack" (P140-P147).**
Reliability is not a flat list of principles. It is a **hierarchy of dependencies**. You cannot solve Layer 4 (Coordination) if Layer 1 (Identity) is broken.

**The Stack:**
1.  **Identity (P141)**: Who am I? (Role, Mission, Boundaries). If this fails -> Hallucination.
2.  **Context (P142)**: Where am I? (Files, State, History). If this fails -> Amnesia.
3.  **Tooling (P143)**: What can I do? (Capabilities, APIs). If this fails -> Impotence.
4.  **Protocol (P144)**: How do I talk? (Formats, Handshakes). If this fails -> Babel.
5.  **Memory (P145)**: What do I remember? (Lessons, Knowledge). If this fails -> Dementia.
6.  **Reasoning (P146)**: Why do I act? (Logic, Strategy). If this fails -> Stupidity.
7.  **Reliability (P147)**: Do I work? (Tests, Monitoring). If this fails -> Entropy.

**The Failure Mode:**
Most MAS failures occur at Layer 1 or 2 (Identity/Context) but manifest as Layer 6 (Reasoning) errors. "The agent is stupid" usually means "The agent forgot who it is" or "The agent can't find its files".

**Implication for GUS:**
We must verify layers *in order*. Do not debug Reasoning if Context is broken.

## Action Plan
1.  **Adopt the Stack**: Update `philosophy.md` with P140-P147 structure.
2.  **Diagnostic Order**: Debug failures bottom-up (Layer 1 -> Layer 7).
3.  **Harness Check**: Before running complex tasks, verify Layer 1-3 (Identity, Context, Tools) explicitly.

## Handoff
-   **May**: Adopt the "Agent Construction Stack" for debugging.
-   **Coach**: Teach agents to verify Layer 1-3 before attempting Layer 6 reasoning.
