# Synthesis: Formal Methods for Agent Reliability (DD#766, DD#767, DD#779)

**Date**: 2026-04-19
**Sources**: KE-267, KE-268, KE-269

## Thread Summaries

- **KE-267 (Policy-Invisible Violations)**: A distinct failure class where agents act correctly given their context, but context is missing policy-relevant facts. Sentinel's counterfactual graph simulation reaches 93% accuracy vs 69% baseline. No behavioral fix works — only context architecture fixes missing-context failures.

- **KE-268 (Explanatory Equilibrium)**: The verifier-regress problem ("who verifies the verifier?") is solvable via structured reasoning artifacts + probabilistic spot-checking. Game-theoretic equilibrium: agents self-correct when they anticipate audits. Exhaustive verification is unnecessary and harmful (causes conservative rejection → coordination collapse).

- **KE-269 (λ_A Typed Calculus)**: Formal type system unifying 5 agent frameworks finds 94.1% of real agent configs are structurally incomplete. Config-only linting catches 54%; adding code AST analysis reaches 96-100%. Coq-mechanized proofs (42 theorems, 0 Admitted).

## Shared Theme: Verification Must Match the Failure Class

All three papers converge on one insight: **generic verification fails; effective verification is structurally matched to the specific failure mode**. KE-267 shows behavioral interventions can't fix missing context. KE-268 shows exhaustive verification causes coordination collapse — bounded, structured auditing works better. KE-269 shows config-only validation misses half the bugs — you need cross-boundary (YAML+AST) analysis.

This maps directly onto our taxonomy: process skills > knowledge skills > judgment skills (KE-021). Each paper identifies a failure class and shows that the *wrong category* of intervention is useless:

| Paper | Failure Class | Wrong Fix | Right Fix |
|-------|--------------|-----------|-----------|
| KE-267 | Missing context | Better reasoning/prompts | Context architecture |
| KE-268 | Verification regress | Exhaustive meta-verification | Structured artifacts + spot-checks |
| KE-269 | Structural incompleteness | Config-only linting | Cross-boundary formal analysis |

## Connections to Existing Knowledge

- **H-172 (Calibrated Verification)** gets strong theoretical backing from KE-268's audit-intensity optimization — verify more on ambiguous claims, less on clear ones.
- **KE-011 (Passive Knowledge)** is essentially our local instance of policy-invisible violations (KE-267): if agents don't read their knowledge files, it's missing context, not bad reasoning.
- **KE-091 (Alignment Tax)** aligns with KE-268: forced exhaustive verification harms complex tasks. Probabilistic auditing is the theoretically grounded alternative.
- **KE-021 (Process > Knowledge > Judgment)** is reinforced by KE-269: static type systems enforce process constraints, which is the most effective intervention tier.

## Impact Ranking

1. **KE-267** (High) — Directly actionable: classify our failures as reasoning vs. context before choosing interventions. Prevents the "stack behavioral interventions" anti-pattern (KE-123).
2. **KE-269** (High) — Quantifies a problem we feel but haven't measured. Could we type-check our own agent pipeline?
3. **KE-268** (Medium-High) — Validates what we already do (structured deep-dives, spot-check verification) and gives theoretical grounding for H-172.

## Synthesis Paragraph

These three papers collectively argue that **agent reliability is a structural problem, not a behavioral one**. Policy-invisible violations (KE-267) show that missing context causes an entire failure class immune to reasoning improvements. Explanatory equilibrium (KE-268) shows that structured artifacts make verification tractable without exhaustive meta-checking. Lambda-A (KE-269) shows that 94% of real agent configs have structural gaps invisible to surface-level validation. The throughline: each failure class has a *matched* intervention (context architecture, probabilistic auditing, cross-boundary type analysis), and applying the *wrong* intervention category is not just ineffective but actively harmful. For our system, the implication is clear — when diagnosing failures, first classify the failure mode, then select the structurally appropriate fix. This reinforces H-172's calibrated verification and extends KE-021's "process > knowledge > judgment" hierarchy with formal backing.

## Next Steps

- Audit our recent FM-* failure log: what fraction are policy-invisible (missing context) vs. reasoning (bad judgment)?
- Explore whether λ_A-style typing could express our agent pipeline (context.md → LLM → tools → commit) for static checking
- Design a lightweight "audit intensity" parameter for inter-agent verification (Scout→Bob pipeline)
