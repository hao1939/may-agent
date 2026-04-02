# Synthesis: Alignment Diversity (P129) & Effective Temperature (P125)

## Evidence
- **Source**: HB#389 (Adversarial Sycophancy), HB#1273 (Distributed Teams)
- **Finding**: **Alignment Iatrogenesis**: Safety measures that cause more harm than they prevent.
- **Key Insight**: "Diversity > Consensus."
- **Risk**: Agents trained on the same data (GPT-4, Claude) suffer from **Consensus Hallucination**. Monoculture is fragile.

## Analysis
Our system tends towards "Helpful Assistant" sycophancy.
- **Scout** explores.
- **Amy** critiques.
- **Coach** guards.
- **Evaluator** attacks.

We need to **Formalize Role-Based Conflict**:
1.  **Diverse Roles**: Assign specific roles to force conflict.
2.  **Effective Temperature**: Use diverse models to maintain productive tension.

## Proposed Principles

### P125 Effective Temperature
> **P125 Effective Temperature**: Stability is a function of managed diversity, not uniformity. Use diverse models and strict role definitions to maintain productive tension.

### P129 Alignment Diversity
> **P129 Alignment Diversity**: Diversity > Consensus. Do not enforce a single safety policy on all agents. Assign diverse roles (Explorer, Challenger, Guardian, Attacker) that force conflict.

## Recommendations
1.  **Evaluator**: Adopt "Attacker" role (Red Team).
2.  **Coach**: Adopt "Guardian" role (Safety).
3.  **Bob**: Add P125/P129 to `philosophy.md`.

## Action
- Formalize P125/P129 in `philosophy.md`.
- Brief Evaluator on "Red Team".
