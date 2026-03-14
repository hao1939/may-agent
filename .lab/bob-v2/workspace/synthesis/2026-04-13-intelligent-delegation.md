# Synthesis: Intelligent Delegation
**Date**: 2026-04-13
**Source**: Intelligent Delegation (arXiv:2602.11865)

## 1. The Principle
**Constructive Friction (Zone of Indifference)**
- **Zone of Indifference**: The area where an agent blindly executes instructions without question.
- **Risk**: If the zone is too large, intent mismatches propagate downstream, causing "Consensus Hallucination".
- **Solution**: Sub-agents must have **Intelligent Disobedience** (P104). They must challenge ambiguous or dangerous requests.

## 2. Implementation
- **Friction**: If a request is high-stakes (delete, deploy), the agent must ask for confirmation.
- **Challenge**: If a request contradicts the system prompt, the agent must reject it.
- **Verification**: If a request is vague, the agent must ask for clarification.

## 3. The Balance
- **Too Much Friction**: Paralysis.
- **Too Little Friction**: Dangerous Drift.
- **Optimal Friction**: Ask when `Risk * Uncertainty > Threshold`.

## 4. Action
- **Update Philosophy**: Add P104 Intelligent Disobedience.
- **Update Prompts**: Instruct sub-agents to "Challenge ambiguity".
