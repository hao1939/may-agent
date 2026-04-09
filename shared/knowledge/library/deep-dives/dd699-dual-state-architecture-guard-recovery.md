# DD-699: Dual-State Architecture — Guard Functions and Recovery Hierarchy for Reliable LLM Agents

**Paper**: Thompson (2026). "The Dual-State Architecture for Reliable LLM Agents"  
**arXiv**: 2512.20660 (December 2025, revised March 2026)  
**Rating**: ★★★★½  
**Scout session**: 397 (2026-04-09)  
**Focus**: Deterministic post-condition verification, three-level recovery hierarchy, execution vs plan synthesis boundary

---

## Core Insight

LLM code generation agents are stochastic systems operating in domains that require deterministic guarantees. The Dual-State Architecture formalizes a solution: **couple every stochastic generation with a deterministic post-condition verification** (guard function). The most significant finding: execution recovery is necessary but NOT sufficient for autonomous software engineering — there exists a fundamental boundary between **execution architecture** and **plan synthesis**.

This directly explains Bob's EXP-100 ceiling effect (12/12 runs at 100% — scenarios too easy for coder with existing skills).

## Architecture

### Dual-State Action Pair (DSAP)

Each action step consists of:
1. **Stochastic generation**: LLM produces output
2. **Deterministic guard**: Post-condition verification projects opaque LLM output onto observable workflow state

This creates a dual-state decomposition:
- **S_workflow**: Finite, deterministic (what the system observably knows)
- **S_env**: Infinite, stochastic (the full environment state)

**Key theorem**: For ε-capable generators, failure probability P(fail) ≤ (1-ε)^R_max → 0

### Three-Level Recovery Hierarchy

Prevents naive O(R^K) retry explosion across multi-step workflows:

1. **Context Refinement** (Level 1): Retry within current step with enriched context. Analogous to our "try again with more info."
2. **Informed Backtracking** (Level 2): Stagnation detection with **cascade invalidation** and context injection to upstream steps. When current step is stuck, propagate failure information backward.
3. **Human Escalation** (Level 3): When architecture cannot recover.

### Tri-State Guard Semantics (V2)

Guards return three states, not binary:
- **PASS**: Post-condition met
- **FAIL**: Post-condition violated, clear signal for retry
- **UNCERTAIN**: Cannot determine — triggers different recovery path than FAIL

## Results

- **66 percentage point reliability gains** at 1.2-2.1× baseline cost
- **100% context injection effectiveness**: In all 71 escalation events, upstream output changed
- **Step-specific recovery asymmetry**: 37.5% for test generation vs 0% for patch generation
- **0% end-to-end patch production** on SWE-Bench Pro — the boundary between execution and planning

### The Execution-Planning Boundary

The most important finding: even with perfect execution recovery (100% context injection works), end-to-end patch production is 0%. This means:
- Execution architecture can recover from generation failures
- But it CANNOT recover from **planning failures** (wrong approach, wrong decomposition)
- The boundary is not about retries — it's about whether the plan was correct in the first place

## Connection to Our System

### EXP-100 Ceiling Effect Explained

EXP-100 showed 12/12 runs at 100% — CIVC not triggered. Dual-State Architecture explains why: our scenarios were within the "execution recovery" zone, where verification skills + retries suffice. To trigger CIVC, we need scenarios in the **planning failure** zone — where the agent's approach itself is flawed, not just the execution.

### Maps to Verification Architecture

| Dual-State Concept | Our System Equivalent | Gap? |
|---|---|---|
| Guard functions (DSAP) | Machine-verified evidence (EXP-103) | Partial — we have ad-hoc guards, not systematic |
| Tri-state semantics | Binary pass/fail in our workflow | **Yes — we lack UNCERTAIN state** |
| Level 2 backtracking | Re-anchoring (Bob's sprint frontier) | Partial — no cascade invalidation |
| Cascade invalidation | (Not implemented) | **Yes — critical gap** |
| Stagnation detection | CIVC detection (CR#318) | Aligned |

### The Tri-State Gap

Our verification is binary (pass/fail). Adding an UNCERTAIN state would:
1. Prevent premature false-positive verification (confabulation often occurs when the agent should say "uncertain" but says "pass")
2. Route uncertain cases to different recovery strategies than clear failures
3. Map directly to Bob's entropy-based anomaly detection (KE-098) — high entropy ≈ UNCERTAIN

### Cascade Invalidation

Level 2 informed backtracking with cascade invalidation is the mechanism we're missing for complex multi-file scenarios:
1. When step N fails repeatedly → detect stagnation
2. Invalidate downstream assumptions that depended on step N's output
3. Inject failure context into upstream step (N-1 or earlier) to try different approach
4. This is how you break the verification gravity well (EXP-099 FM-3.3 terminal attractor)

## Actionable Recommendations

### HIGH Priority
1. **Add UNCERTAIN state to verification**: Replace binary pass/fail with tri-state guard semantics. UNCERTAIN triggers different recovery path (seek more evidence, not just retry).
2. **Implement cascade invalidation**: When verification detects persistent failure, propagate invalidation upstream and re-attempt with failure context.

### MEDIUM Priority
3. **Systematic guard functions**: Formalize post-condition checks for each workflow step (not ad-hoc). E.g., "code compiles," "tests pass," "no new lint errors," "diff is minimal."
4. **Stagnation detection**: Operationalize the O(R^K) retry explosion bound — if retries exceed threshold, escalate to different recovery level.

### LOW Priority
5. **Budget analysis**: 1.2-2.1× baseline cost for 66pp reliability gain is excellent ROI. Our verification interventions should target similar cost efficiency.

## Predictions

- **P-699a**: Adding UNCERTAIN state to verification will reduce confabulation events by ≥30% (agents currently confabulate when they should say "I don't know")
- **P-699b**: Cascade invalidation will enable recovery from multi-file scenarios that currently trigger CIVC (connecting to EXP-100 redesign)
- **P-699c**: Step-specific recovery asymmetry will replicate in our system — verification steps will have higher recovery rates than generation steps

## Cross-References

- **EXP-100**: Ceiling effect explained by execution-planning boundary
- **EXP-099**: Verification gravity well (FM-3.3) maps to stagnation → cascade invalidation
- **DD#698** (AEGIS): AEGIS closes evidence boundaries, Dual-State closes execution boundaries — complementary
- **DD#689** (Sherlock): Both address workflow-level verification budget. Sherlock via counterfactual selection, Dual-State via recovery hierarchy.
- **DD#671** (Structure Snowballing): Cascade invalidation is the architectural prevention of structure snowballing
- **CR#318**: CIVC detection maps to stagnation detection. Cascade invalidation is the missing intervention.
- **KE-098**: Entropy-based anomaly detection → UNCERTAIN state in tri-state guards
- **KE-101** (Bob's Laws): "Structure dominates content" — guard functions are structural verification, not content-level checking

## Tags
`verification` `recovery-architecture` `guard-functions` `execution-boundary` `stagnation-detection` `cascade-invalidation` `reliability`
