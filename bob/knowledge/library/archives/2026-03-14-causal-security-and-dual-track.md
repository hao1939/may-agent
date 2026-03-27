# Synthesis: Causal Security & Dual-Track Learning

**Date**: 2026-03-14
**Source**: arXiv:2603.10749 (AttriGuard), arXiv:2603.12056 (XSkill)
**Author**: Bob

## 1. The Shift to Causal Security (AttriGuard)

**The Problem**: Traditional security relies on "Semantic Classification" (is this input malicious?). This fails because LLMs are semantic chameleons — a malicious instruction can be phrased benignly.
**The Insight**: **AttriGuard** proves that security is about **Causal Attribution**.
- **Intent-Supported**: Action $A$ follows from User Task $T$ + History $H$.
- **Observation-Driven**: Action $A$ only happens because of content in Observation $O$.

**The Mechanism**: **Counterfactual Testing**.
"If I remove/attenuate the observation $O$, does the agent still propose action $A$?"
- If YES → $A$ is driven by intent (Safe).
- If NO → $A$ is driven by the observation (Potential Injection).

**System Implication**:
We must move from "Scanning Content" (P53 static analysis) to "Verifying Causality".
- **Action**: Adopt **P120 Causal Security**. "Verify *why* an action is proposed, not just *what* it is."
- **Implementation**: For high-stakes actions (file deletes, pushes), we should ask: "Would you still do this if the specific error message was different?"

## 2. Dual-Track Learning (XSkill)

**The Problem**: We mix "Skills" (how to use a tool) with "Experience" (what happened last time). This leads to context bloat and confusion.
**The Insight**: **XSkill** demonstrates a rigorous separation:
1.  **Skills (Strategic)**: Read-Only, curated, structural. "How to debug." (Format: Markdown/Docs).
2.  **Experience (Tactical)**: Append-Only, raw, specific. "The last 3 times I tried X, it failed." (Format: JSON/Logs).

**System Implication**:
We currently put everything in `knowledge/`. We need to bifurcate.
- **Skills**: `agents/shared/skills/` (Curated, P51 Growth Cycle required to change).
- **Experience**: `agents/X/workspace/experience/` or `ERROR_LOG.jsonl`.
- **Action**: Adopt **P121 Dual-Track Learning**. "Separate Strategic Skills (Immutable) from Tactical Experience (Mutable)."

## Recommendations

1.  **Update Philosophy**:
    - Add **P120 Causal Security**: "Security is Causal, Not Semantic. Verify the driver of the action."
    - Add **P121 Dual-Track Learning**: "Split Knowledge into Skills (Strategic, Curated) and Experience (Tactical, Accumulated)."

2.  **Implementation**:
    - **Coach**: Enforce P121. When an agent fails, ask: "Do you need a Skill update (new strategy) or an Experience entry (don't do X again)?"
    - **Tech-Lead**: Explore "Counterfactual Verification" for critical tools.
