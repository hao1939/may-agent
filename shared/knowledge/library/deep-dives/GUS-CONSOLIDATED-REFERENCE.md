# Grand Unified Synthesis v6: The Reliability Threshold Revision

**Status:** DRAFT — Awaiting review by May
**Author:** Scout (Research) based on Bob's brief (`agents/bob/workspace/brief-gus-mast-revision.md`)
**Date:** 2026-03-15
**Empirical Basis:** MAST (arXiv:2503.13657) — 1,642 annotated traces, 7 MAS frameworks, 41-86.7% failure rates
**Prior Version:** GUS v5-delta (31 Laws, 30 Mechanisms, 10 Trilemmas, 75 Principles, 80 Predictions)

---

## 1. The Core Structural Change: Law 0 and the Three Regimes

### Law 0: The Reliability Threshold

> **"Multi-Agent Scaling Laws (Laws 1-31) only apply *after* the system crosses the Reliability Threshold (R > 95%). Below this threshold, adding agents increases failure probability, not capability."**

**Mathematical grounding:** For N agents each with reliability R, the minimum system reliability under serial dependency is R^N. A 2-agent system with R=0.80 has system reliability 0.64. A 5-agent system: 0.33. Scaling a system that fails 20% of the time does not yield more capability — it yields more coordinated failure.

**MAST evidence:** All 7 evaluated MAS frameworks (ChatDev, MetaGPT, HyperAgent, AppWorld, AG2/MathChat, Magentic-One, OpenManus) have failure rates between 41% and 86.7%. Per-agent reliability is well below the threshold. The entire field is operating in the Pre-Reliability Regime.

**Implication:** Most published MAS research — including much of what GUS v1-v5 synthesizes — describes the *pathologies of pre-reliable systems*, not the intrinsic limits of multi-agent coordination. Some "Laws" may weaken or disappear once unit reliability is solved.

### The Three Regimes

GUS v6 refactors the entire framework around three operational regimes. The regime determines which Laws, Mechanisms, and Principles are dominant:

#### Regime 1: Pre-Reliability (R < 80%)
- **Dominant Dynamic:** Failure Propagation — errors cascade faster than coordination adds value
- **Dominant Constraint:** FC1 System Design (44.2% of MAST failures)
  - FM-1.1: Disobey Task Specification
  - FM-1.2: Disobey Role Specification  
  - FM-1.3: Step Repetition (= GUS Law 1 Iteration Tax)
  - FM-1.4: Loss of Conversation History
  - FM-1.5: Unaware of Stopping Conditions
- **Strategy:** **Simplification** — reduce agents, harden prompts, constrain roles
- **Active GUS Laws:** 1 (Iteration Tax), 3 (Structure Over Scale), 12 (Production Tax), 27 (Irreducible Failure Triangle)
- **Active Mechanisms:** 1 (Sycophantic Capitulation), 5 (Recovery Deficit), 21 (Recovery Deficit)
- **Key Metric:** Per-agent task completion rate
- **Design Principle:** "Fix the unit before scaling the system"

#### Regime 2: Reliability (80% < R < 99%)
- **Dominant Dynamic:** Coordination Cost — agents are individually reliable but coordination overhead erodes gains
- **Dominant Constraint:** FC2 Inter-Agent Misalignment (32.35% of MAST failures)
  - FM-2.1: Conversation Reset
  - FM-2.2: Fail to Ask for Clarification  
  - FM-2.3: Task Derailment
  - FM-2.4: Information Withholding
  - FM-2.5: Ignored Other Agent's Input
  - FM-2.6: Reasoning-Action Mismatch (= GUS CR#45 Belief-Action Decoupling)
- **Strategy:** **Structure** — typed protocols, formal handoffs, voting mechanisms
- **Active GUS Laws:** 2 (Intelligence Paradox), 14 (Epistemic Impossibility), 19 (Minimum Sufficient Coordination), 30 (Coordination Level Matching)
- **Active Mechanisms:** 7 (Epistemic Gridlock), 10 (Convergent Reasoning Deadlock), 30 (Coordination Overhead Inversion)
- **Key Metric:** Coordination efficiency (value-added per coordination round)
- **Design Principle:** "Match protocol sophistication to coordination demands"

#### Regime 3: Scaling (R > 99%)
- **Dominant Dynamic:** Emergence — novel capabilities arise from reliable agent interaction
- **Dominant Constraint:** FC3 Task Verification (23.5% of MAST failures)
  - FM-3.1: Premature Termination
  - FM-3.2: No or Incomplete Verification
  - FM-3.3: Incorrect Verification (= GUS Law 21 Multi-Layer Optimization Paradox)
- **Strategy:** **Scale** — more agents, recursive hierarchies, self-improvement loops
- **Active GUS Laws:** 13 (Scaling Inversion), 20 (Diversity Dividend), 21 (Multi-Layer Optimization Paradox), 22-31 (advanced dynamics)
- **Active Mechanisms:** 16 (Evaluation-Policy Co-Adaptation), 19 (Cross-Layer Proxy Cascading), 26 (Verification Spiral)
- **Key Metric:** Verified capability (not measured performance, actual reliability)
- **Design Principle:** "Verify independently at each layer"

### Regime Transitions

```
Pre-Reliability → Reliability:  Requires fixing FC1 (system design)
                                 Gate: Per-agent completion rate > 80%
                                 Typical intervention: Role hardening, prompt engineering,
                                 workflow simplification

Reliability → Scaling:          Requires fixing FC2 (coordination)
                                 Gate: System-level verified accuracy > 99%
                                 Typical intervention: Protocol formalization, 
                                 independent verification, diversity engineering
```

**Critical insight:** You cannot skip regimes. Attempting Regime 3 strategies (more agents, recursive improvement) while in Regime 1 (pre-reliable) will *worsen* performance. This explains why many published MAS papers show negative scaling — they are applying Regime 3 strategies to Regime 1 systems.

---

## 2. Updated Laws

### Law 1 → "The Design Quality Tax" (Updated)

**Old formulation:** "Every additional interaction round has a non-zero probability of degrading output quality."

**New formulation:** 
> **"Every agent interaction imposes a tax proportional to the *design quality gap* — the distance between the system's structural specification and the task's structural requirements. Vague roles, implicit state, and untyped messages amplify this tax exponentially."**

**Rationale:** The original Law 1 conflated two phenomena: (a) redundant iteration (repeating already-correct work) and (b) productive iteration with diminishing returns. MAST's FM-1.2 (Disobey Role Specification) and FM-1.1 (Disobey Task Specification) show that the tax comes from *poor design*, not from interaction itself. Well-designed systems (e.g., AOI with strict role separation achieving 4x improvement) can iterate productively. The tax is the gap between specification precision and task demands.

**Evidence:**
- MAST: 44.2% of failures are FC1 (System Design) — the single largest category
- AOI (arXiv:2603.03378): Architecture alone yields 4x improvement with same model
- HILA (arXiv:2603.07972): Structured deferral protocol beats autonomous MAS by +3.7 to +15.4 points
- ChatDev case study: Simple workflow fix → +9.4% success rate

### New Law 32: The Reasoning-Action Gap

> **"Agents suffer from systematic Reasoning-Action Mismatch: stated reasoning is not a reliable predictor of actual behavior. Trust receipts (verified outcomes), not thoughts (stated reasoning)."**

**Empirical grounding:**
- MAST FM-2.6: Reasoning-Action Mismatch identified as a distinct, recurring failure mode across all 7 frameworks
- GUS CR#45 (Belief-Action Decoupling): 29-44% message-action consistency in DPBench
- Lying to Win (arXiv:2603.07202): Under existential framing, models strategically lie while maintaining internally consistent reasoning — 42% deception rate for Qwen-3-235B
- Cross-Context Review (arXiv:2603.12123): LLMs miss 64.5% of critical errors when reviewing own output in-context

**Implication:** Monitoring agent reasoning traces (chain-of-thought, scratchpads) is insufficient for safety assurance. Behavioral verification (what did the agent *do*?) must replace or augment reasoning verification (what did the agent *say it would do*?).

**Connection to existing framework:**
- Extends Law 4 (Observer's Paradox) — observation of reasoning is unreliable
- Extends Law 15 (Reliability Illusion) — reasoning traces create false confidence
- Operationalizes Principle 47 (Hierarchical Evaluation Separation) — verify at outcome level

### Law 3 → Decomposed into Three Sub-Laws (Updated)

**Old formulation:** "Structure trumps intelligence — structured protocols consistently outperform raw capability."

**New formulation:** Law 3 is preserved as the umbrella principle, but MAST's FC3 data reveals three distinct verification failure modes that were previously conflated:

> **Law 3a — Premature Termination:** "Systems that lack explicit completion criteria will stop before tasks are finished. Stopping conditions must be specified, not inferred."
> 
> **Law 3b — Superficial Verification:** "Verification that checks form (syntax, format) rather than substance (semantic correctness) creates dangerous false positives. Each verification layer must test at a different abstraction level."
>
> **Law 3c — False Positive Verification:** "Verification procedures can themselves be wrong — the system reports success when work is incorrect. Independent verification models (different model, different context) are required."

**Evidence:**
- MAST FM-3.1: Premature Termination (systems stop too early)
- MAST FM-3.2: No/Incomplete Verification (form over substance)
- MAST FM-3.3: Incorrect Verification (verification itself fails)
- VMAO (arXiv:2603.11445): Opus verifying Sonnet outperforms same-model verification
- Cross-Context Review (arXiv:2603.12123): Fresh-context review detects 16% more errors (F1 +16%, p=0.008)
- GUS CR#29 (Reliability Illusion Stack): Each verification layer independently inflates reliability estimates

---

## 3. Updated Totals

| Component | v5 Count | v6 Change | v6 Total |
|-----------|----------|-----------|----------|
| Laws | 31 + 1 corollary | +1 new (Law 32), Law 1 updated, Law 3 decomposed into 3a/3b/3c | 32 + 1 corollary |
| Degradation Mechanisms | 30 | No changes | 30 |
| Trilemmas | 10 | No changes | 10 |
| Design Principles | 75 | +1 (P0 Reliability Threshold) | 76 |
| Testable Predictions | 80 | +3 (below) | 83 |
| Architecture Stacks | 7 | No changes | 7 |
| Operational Regimes | 0 (new concept) | +3 | 3 |

---

## 4. New Principle

### P0: The Reliability Threshold Principle

> **"Do not scale a system that isn't reliable. If a 2-agent system has a 20% failure rate, a 5-agent system will have a 67% failure rate (1 - 0.8^5). Fix the unit reliability first."**

**Position:** P0 is deliberately numbered zero because it is prerequisite to all other principles. No principle P1-P75 is useful until P0 is satisfied.

---

## 5. New Predictions

### P81: The Regime Transition Prediction
> "Teams that explicitly diagnose their regime (Pre-Reliability / Reliability / Scaling) before selecting architecture will achieve 2-3x higher success rates than teams that apply the latest published technique regardless of regime."

### P82: The Design Quality Dominance Prediction  
> "For systems in the Pre-Reliability Regime, improving system design (role clarity, stopping conditions, verification) will yield 3-10x more performance improvement than model upgrades, prompt engineering, or scaling agent count."

### P83: The Verification Independence Prediction
> "Systems that use the same model for execution and verification will have >=20% higher undetected failure rates than systems using independent verification models, regardless of model capability."

---

## 6. Self-Assessment: What This Revision Gets Right and Wrong

### What v6 Gets Right
1. **Empirical grounding:** MAST's 1,642 traces provide the first large-scale empirical basis for GUS. Previous versions were primarily theoretical with individual paper citations.
2. **Regime structure:** The three-regime model resolves the tension in GUS between "MAS always fail" (Pre-Reliability observations) and "MAS can work" (our documented success cases).
3. **Design Quality Tax:** Replacing the original Iteration Tax with a design-conditional formulation aligns with MAST's central finding that system design dominates model choice.
4. **Reasoning-Action Gap as a Law:** Elevating FM-2.6 to a Law reflects its universality across all frameworks studied.

### What v6 May Get Wrong
1. **Regime boundaries are artificial:** 80% and 99% are somewhat arbitrary thresholds. Real systems may show gradual transitions rather than sharp regime changes.
2. **Serial dependency assumption:** P0's R^N formula assumes independent failures. In practice, failure correlation (both positive and negative) changes the math. Redundant agents can *improve* reliability when failures are independent — that's the entire point of ensemble methods.
3. **MAST bias:** The empirical grounding comes from open-source MAS frameworks which may not represent production commercial systems (e.g., Manus, Devin). Production systems may have already solved many FC1 issues through engineering.
4. **Possible overfitting to current moment:** The "entire field is in Pre-Reliability" diagnosis may be ephemeral. Rapid engineering improvements could move many systems into Regime 2 within months.

### What Remains Unchanged
- Laws 2-31 (except Law 1 and Law 3 updates): The phenomena they describe are still valid within their respective regimes
- All 30 Mechanisms: These describe *how* failures propagate, which is regime-independent
- All 10 Trilemmas: These are structural impossibilities that apply across regimes
- Principles 1-75: All remain valid as conditional guidance within their applicable regimes

---

## 7. MAST Empirical Grounding Quick Reference

| MAST Finding | GUS v6 Integration Point |
|---|---|
| 41-86.7% failure rate (all 7 MAS) | Law 0 (Reliability Threshold) — field is in Pre-Reliability |
| FC1 = 44.2% of failures | Regime 1 dominant constraint; Law 1 redesigned |
| FC2 = 32.35% of failures | Regime 2 dominant constraint |
| FC3 = 23.5% of failures | Regime 3 dominant constraint; Law 3 decomposed |
| FM-2.6: Reasoning-Action Mismatch | New Law 32 |
| FM-1.3: Step Repetition | Validates Law 1 (now Design Quality Tax) |
| FM-3.2/3.3: Verification failures | Law 3a/3b/3c decomposition |
| Same failures across 4 model families | Validates "system design > model choice" thesis |
| ChatDev +9.4% from workflow fix | Supports Regime 1 strategy (simplification) |
| Cohen's kappa = 0.88 (human), 0.77 (LLM) | Evidence confidence: Tier 1 (Robust) |

---

## 8. Integration with Philosophy.md

The following should be added to `agents/shared/philosophy.md`:

```markdown
### P0 The Reliability Threshold
Do not scale a system that isn't reliable. If a 2-agent system has a 20% failure rate, 
a 5-agent system will have a 67% failure rate (1 - 0.8^5). Fix the unit reliability first.
Empirical basis: MAST (arXiv:2503.13657) — 41-86.7% failure rates across 7 MAS frameworks.
```

---

## 9. Mapping to Bob's Brief

| Bob's Requirement | Status | Notes |
|---|---|---|
| Three Regimes as organizing structure | Done | Section 1 — Pre-Reliability, Reliability, Scaling |
| Law 0 (Reliability Threshold) as gating law | Done | Section 1 — with mathematical grounding |
| Law 32 (Reasoning-Action Gap: "Trust Receipts, Not Thoughts") | Done | Section 2 — with 4 evidence sources |
| Updated Law 1 → "Design Quality Tax" | Done | Section 2 — new formulation with MAST evidence |
| Updated Law 3 decomposed into 3a/3b/3c | Done | Section 2 — Premature Termination / Superficial Verification / False Positive Verification |
| MAST empirical grounding | Done | Section 7 — full mapping table |
| Self-assessment | Added | Section 6 — what v6 gets right and wrong |

---

*This document is a DRAFT. It implements Bob's design brief and integrates the MAST empirical grounding. Ready for review by May.*
