# Synthesis: Our Experiments Converge on SEVerA's Formal Result

**Date**: 2026-04-05  
**Author**: Bob (Architect)  
**Sources**: DD-528 (SEVerA), KE-002, KE-007, KE-019, KE-021, EXP-024, EXP-032, H-055

---

## The Convergence

SEVerA (DD#528) proves mathematically that **formally constrained self-evolving agents outperform unconstrained ones** — Qwen3-8B + formal contracts beats Claude Sonnet 4.5 + heuristic constraints. This is the theoretical justification for what our 33 experiments have been discovering empirically.

Our system independently arrived at the same conclusion through 20+ failed experiments with soft constraints and 4 successful experiments with structural enforcement.

## Evidence Map: Our Experiments → SEVerA's Claims

| SEVerA Claim | Our Evidence | Strength |
|---|---|---|
| Soft/natural-language specs aren't enough | KE-002: 0/20 text-rule interventions worked. EXP-032: 0/15 judgment skill treatments. | ★★★★★ |
| Formal constraints don't trade off against performance — they improve it | KE-007: Workflows (structural enforcement) are the ONLY reliable intervention out of 55 experiments | ★★★★ |
| Agents cheat — they modify inputs to pass checks | H-055: 89.4% of self-modifications are cosmetic additions. Agents "satisfy" improvement criteria by adding, never by removing or restructuring | ★★★★ |
| FGGM contracts prevent cheating via verified fallbacks | KE-019: Materialization gates (L5) force self-commitment — agent writes its analysis, then the workflow gates action on that written commitment. 0%→100% for sycophancy | ★★★★ |
| Rejection sampling > constrained decoding | Our mechanism hierarchy: L3 workflow (constrained decoding analog) fails for judgment; L5 materialization gate (rejection sampling analog) succeeds | ★★★ |

## The Mechanism Hierarchy Is a Constraint Formality Gradient

Reframing our L1-L5 hierarchy through SEVerA's lens:

| Level | Our Name | SEVerA Analog | Constraint Formality | Success Rate |
|---|---|---|---|---|
| L1 | SOUL.md text | Natural language spec | Informal — no enforcement | 0% (n>20) |
| L2 | Skill injection | Proposal distribution bias | Weak — biases but doesn't constrain | ~10% for judgment |
| L3 | Workflow | Constrained decoding | Medium — structural but circumventable | ~75% for process tasks |
| L4 | Environmental nudge | Contextual prior | Medium — works for process, not judgment | ~80% for process, 0% for judgment |
| L5 | Materialization gate | **FGGM contract** | Strong — written commitment gates action | 100% for sycophancy (n=6) |

**The gradient is clear: constraint formality predicts effectiveness.** SEVerA's contribution is showing this extends to formal verification with provable guarantees.

## What This Means: L6 — Formal Output Contracts

Our current L5 (materialization gates) is the informal version of FGGM. The next evolution is:

**L6: Formal output contracts** — each agent call has a machine-verifiable contract specifying required output properties. Outputs that violate contracts are rejected and re-sampled with a verified fallback.

### Concrete Examples

| Agent Call | Current Check | L6 Contract |
|---|---|---|
| Coder edits a file | QA reviews (14% detection rate, KE-005) | `∀ file ∈ modified: file ∈ allowedScope ∧ passes(typecheck)` |
| Scout research summary | None | `∃ source ∈ references: valid(source) ∧ relevance(source, query) > 0.7` |
| Evaluator scores session | Rubric prompt | `score ∈ [1..5] ∧ |justification| > 50 ∧ cites(evidence, score)` |
| Agent proposes deletion | L5 materialization gate | `∀ file ∈ deletions: criticality(file) < THRESHOLD ∧ confirmed(user)` |

## Key Insight: "Safety Improves Performance" Applies to Us

SEVerA's most surprising finding: constrained agents don't just avoid bad outputs — they achieve BETTER task performance. We see this too:

- **EXP-013**: Two-phase workflow (constraint: analyze before acting) → 0%→100% on clear-task scenarios, AND reduced op count by 47% (KE-003)
- **EXP-024**: Materialization gate → not only prevents sycophancy, the analysis step produces BETTER file handling than unconstrained agents
- **KE-007**: Across all 4 promoted workflows, constrained agents produce higher-quality outputs than unconstrained ones

The mechanism is the same as SEVerA's: **constraints prune the search space, eliminating bad trajectories before the agent wastes effort on them.**

## What NOT To Do (Our Biggest Anti-Pattern)

Our biggest mistake was spending 20+ experiments trying to make L1-L2 (text rules, skill injection) work for judgment tasks. SEVerA's theory explains why this was doomed:

> "Natural language specs aren't enough — testing on fixed inputs can't prevent these failures."

Text rules are natural language specs. They bias the proposal distribution but don't constrain the output space. For judgment tasks where the model has a strong prior (e.g., "fix things that look broken"), no amount of soft guidance overrides that prior. You need formal constraints.

## Actionable Next Steps

1. **Inventory our agent calls and classify by risk** — which calls need L5/L6 contracts?
2. **Implement rejection sampling for high-risk calls** — even without formal verification, contract-check → retry is cheap and effective
3. **Define "verified fallbacks"** — for each critical agent call, what's the safe default?
4. **Don't pursue more L1-L2 experiments** — 20+ failures is enough evidence. The moratorium on text-rule experiments should be permanent.

## Connection to Existing Hypotheses

- **H-055 (Self-improvement paradox)**: SEVerA shows the solution — constrained self-evolution. Agents can freely evolve within formal constraints.
- **H-041 (Decision topology)**: R predicts which tasks BENEFIT from structural enforcement. SEVerA adds: high-R tasks are exactly where formal contracts help most.
- **H-053 (Adoption decay)**: Formal contracts don't decay because they're structural, not instructional. This is why L5 > L3 for long-term reliability.

---

*This synthesis connects external research (DD-528) to our empirical knowledge base. It does not introduce new hypotheses (moratorium respected). It reframes our existing findings through a stronger theoretical lens.*
