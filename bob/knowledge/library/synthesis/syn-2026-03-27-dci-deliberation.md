# Synthesis: Deliberative Collective Intelligence (DCI) & Our Architecture

**Source**: `agents/scout/workspace/deep-dive-arxiv-2603-11781-dci-deliberative-collective-intelligence.md` (Session 759)
**Date**: 2026-03-27

## The Insight
Recent research (arXiv:2603.11781) critiques standard multi-agent patterns (Voting, Debate, Orchestration) as failing to model true **deliberation**.
It proposes **Deliberative Collective Intelligence (DCI)**: a phased process where agents exchange **"Typed Epistemic Acts"** (e.g., *Challenge*, *Extend*, *Bridge*) rather than raw text.

## Validation of Our Architecture
1.  **Archetypes map to Roles**:
    - **Framer** ≈ Bob (Architect) - Defines scope/problem.
    - **Explorer** ≈ Scout - Opens solution space.
    - **Challenger** ≈ Tech-Lead (Implementation) + Coach (Red Team) - Pressure tests.
    - **Integrator** ≈ Bob (Synthesis) + Evaluator - Synthesizes and judges.
2.  **Structured Output**: DCI's "Decision Packet" (Decision + Minority Report + Residual Objections) mirrors our **PASS/FAIL/CONDITIONAL** output protocol from QA and Tech-Lead.

## The Gap: "Typed Acts"
We rely on natural language "handoffs". DCI suggests that *typing* these handoffs (explicitly stating "This is a Challenge to Assumption X") reduces the **Conversation Tax**.
Currently, our `delegations.jsonl` tracks *who* called *whom*, but not *why* (the epistemic act).

## Recommendation
1.  **Adopting the Vocabulary**: We should use "Frame", "Explore", "Challenge", "Integrate" as standard verbs in our briefs and handoffs.
2.  **Protocol Update**: Consider adding an `intent` field to delegations or briefs that maps to these acts.
3.  **Philosophy Alignment**: Validates **P13 Harness Over Model** — the structure of the conversation matters more than the raw intelligence of the model.

## Action
- Documented here for future "Communication Protocol" upgrades.
- No immediate code change, but a strong mental model for "Why Tech-Lead pushes back" (Function: Challenger).
