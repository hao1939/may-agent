# Cross-Reference Synthesis #76: System Remediation Protocol
## Evidence-Backed Interventions for Our 5 Critical GUS Violations

**Date:** 2026-03-15
**Type:** Cross-Reference Synthesis — Actionable Remediation
**Significance:** ★★★★★ — Bridges theoretical framework to concrete system improvements
**Sources:** 14 deep-dives + 6 cross-reference syntheses + GUS Self-Application Audit (#221)

---

## 1. Motivation

Deep-Dive #221 (GUS Self-Application Audit) identified 5 critical violations and 8 moderate risks when mapping our 31 GUS Laws against our actual multi-agent system. This synthesis does what the audit didn't: it maps each violation to **specific, evidence-backed remediation techniques** drawn from our 227 deep-dive portfolio, prioritized by implementation cost and expected impact.

### The 5 Critical Violations

| Law | Violation | Risk Level | Core Problem |
|-----|-----------|------------|--------------|
| 13 | Scaling Inversion | 🔴 CRITICAL | 12 agents, no evidence all improve outcomes vs. 4-5 |
| 17 | Training Trap | 🔴 CRITICAL | Evaluator→Optimizer loop is an ungrounded RL training loop |
| 18 | Abstraction Gate | 🔴 CRITICAL | lessons.md accumulates raw observations without abstraction |
| 21 | Multi-Layer Optimization | 🔴 CRITICAL | Layer 2 optimization may degrade Layer 1 or Layer 3 |
| 27 | Monotonic Drift | 🔴 CRITICAL | Zero dissipation — files only grow, stale info never removed |

---

## 2. Violation-by-Violation Remediation

### 2.1 Law 27: Monotonic Drift (HIGHEST PRIORITY)

**The Problem:** Our system has γ ≈ 0 (zero dissipation). Per DAC stability theory (2603.11560), the stability condition is 4ηβ² < γ. With γ ≈ 0, ANY coupling (β > 0) with intelligent agents (η > 0) produces instability. Files grow monotonically. SIGNALS.md entries accumulate indefinitely. lessons.md contains contradictory entries from different system eras.

**Evidence-Backed Interventions:**

**R27-1: Weibull Memory Decay (from SSGM, 2603.11768)**
- Implement temporal decay: w(Δτ) = exp(-(Δτ/η)^κ)
- SIGNALS.md entries: η = 48h, κ = 1.5 (faster-than-exponential early decay)
- lessons.md entries: η = 30 sessions, κ = 0.8 (slower initial decay, allows lessons to prove value)
- **Implementation:** Add creation timestamps to SIGNALS.md entries. Script that auto-archives entries past TTL. Run on system heartbeat.
- **Expected impact:** Introduces non-zero γ, moving system toward stability boundary. Even small γ dramatically changes dynamics (DAC theorem).
- **Cost:** LOW — automation script + format convention change

**R27-2: Type-Based Admission Control (from A-MAC, 2603.04549)**
- The cheapest signal dominates: Type Prior alone (14ms, rule-based) contributes more than LLM-based Utility scoring
- Classify new entries by type: Constitutional (permanent), Operational (48h TTL), Transient (session-scoped)
- **For SIGNALS.md:** Status updates = Transient. Architecture decisions = Constitutional. Handoffs = Operational.
- **For lessons.md:** Pattern-level insights = Constitutional. Session-specific observations = Transient.
- **Expected impact:** Prevents 60-70% of low-value entries from persisting (based on A-MAC ablation data)
- **Cost:** LOW — type tags + simple retention rules

**R27-3: Periodic Consolidation (from AriadneMem, 2603.03290 + SSGM)**
- AriadneMem's conflict-aware coarsening: MERGE overlapping entries, LINK complementary ones, ADD only genuinely novel
- Schedule: Every 50 sessions, Bob or Coach consolidates lessons.md (abstract patterns, remove contradictions, expire outdated)
- AriadneMem achieves 77.8% memory size reduction with +15.2% F1 improvement — less data, better performance
- **Expected impact:** Reduces memory footprint while improving retrieval quality
- **Cost:** MEDIUM — requires scheduled maintenance workflow

**R27-4: Bounded-Drift Guarantee (from SSGM Theorem 1)**
- SSGM proves: with periodic reconciliation, total drift is bounded by O(N·ε_step)
- Our reconciliation frequency should be inversely proportional to system activity
- After high-activity periods (5+ sessions/day), consolidation within 24h
- During low activity (1-2 sessions/day), consolidation weekly
- **Expected impact:** Formal guarantee that drift stays within computable bounds
- **Cost:** LOW-MEDIUM — scheduling logic + alerting

### Compound Impact of R27-1 through R27-4:
Introducing even partial dissipation (γ > 0) is the single highest-impact intervention across all 5 violations. Per DAC stability theory, the system transitions from structurally unstable to potentially stable. The parametric estimates from SSGM (η, κ values) and A-MAC (type priors) provide concrete, non-arbitrary parameters.

---

### 2.2 Law 18: Abstraction Gate

**The Problem:** Raw experience is injected directly into agent context via lessons.md. Per the Information Self-Locking mechanism (2603.12109), this creates an Attention Saturation × Belief Truncation trap: agents become less responsive to new evidence as raw lessons accumulate. The MemRL result (2602.08234) proved this empirically — raw memory + RL = 21.4%, WORSE than the 14.8% base. Abstract first, then amplify.

**Evidence-Backed Interventions:**

**R18-1: Abstraction-Before-Injection (from SkillRL, 2602.08234)**
- SkillRL's 3-stage pipeline: Distillation → Hierarchical SkillBank → Recursive Evolution
- For our lessons.md: (1) Collect raw observations (current), (2) Abstract into patterns (NEW — periodic synthesis step), (3) Inject only patterns into agent context
- Raw lessons stored in archive; only abstracted principles injected
- 7B model with abstracted skills beats GPT-4o (89.9% vs 48.0%) — abstraction is the dominant lever
- **Implementation:** Monthly lessons.md review producing principles.md (abstract, validated patterns only). Agents read principles.md; raw lessons.md kept for audit trail only.
- **Expected impact:** Prevents AS×BT locking. Higher-quality context at lower token cost.
- **Cost:** MEDIUM — requires periodic human or agent review cycle

**R18-2: Zone-of-Proximal-Development Filtering (from PACED, 2603.11178)**
- PACED concentrates learning on the ZPD boundary — where gradient SNR peaks
- Applied to lessons: lessons about things agents already do well (mastered) or can't do at all (unreachable) have near-zero learning value
- Filter lessons by agent competency: only inject lessons at the agent's learning frontier
- **Expected impact:** ~91% efficiency of full lessons at ~30% the context cost
- **Cost:** LOW-MEDIUM — requires competency assessment per agent role

**R18-3: Conflict-Aware Coarsening (from AriadneMem, 2603.03290)**
- Automatically detect contradictory lessons (e.g., "always run tests" vs. "skip tests for simple changes")
- Resolution policy: newer + higher-rated + more-frequently-triggered lesson wins
- Bridge discovery: find hidden connections between seemingly unrelated lessons
- **Expected impact:** Eliminates contradictory context injection (currently invisible to agents)
- **Cost:** MEDIUM — requires NLP-level contradiction detection

---

### 2.3 Law 17: Training Trap (Evaluator→Optimizer Loop)

**The Problem:** Our Evaluator→Optimizer→agent-config loop is functionally an RL training loop without independent ground truth. Per the Goodhart Cascade (Cross-Ref #54), optimizing proxy metrics (Evaluator scores) while the underlying quality is unobserved produces systematic divergence. Per PAE (2603.03116), 27-78% of "successes" are procedurally corrupt. Per the Reasoning Judges paper (2603.12246), 8B models can achieve 90% Arena-Hard by pure adversarial gaming of evaluators.

**Evidence-Backed Interventions:**

**R17-1: Independent Ground Truth (from PAE, 2603.03116 + Sim2Real, 2603.11245)**
- Establish Layer 3 metrics independent of Evaluator:
  - Task completion rate (human-verifiable)
  - Commit frequency and merge rate (objective)
  - Time-to-resolution (clock-based)
  - Regression frequency (test-based)
- Sim2Real finding: LLM evaluators are "excessively cooperative" and create "easy mode" that inflates success rates above human baseline
- **Implementation:** Track the 4 metrics above per sprint. Compare trends to Evaluator scores. Divergence = Goodhart alarm.
- **Expected impact:** Breaks the closed-loop exploitation dynamic. Even partial ground truth prevents score gaming.
- **Cost:** LOW — mostly data collection, no new systems

**R17-2: Format Perturbation Testing (from JRH, 2603.05399 + Bias-Bounded Eval, 2603.05485)**
- JRH finding: formatting perturbations (whitespace, spacing) cause LARGER reliability drops than semantic changes
- Periodically re-score the same session with format-perturbed submissions
- Score variance across perturbations = evaluator fragility index
- Lipschitz shrinkage (Bias-Bounded Eval): pull extreme scores toward historical mean to dampen bias
- **Implementation:** Monthly canary test: take 3 recent sessions, perturb formatting, re-evaluate. Compare scores.
- **Expected impact:** Detects evaluator brittleness before it contaminates the training loop
- **Cost:** LOW — trivial to implement, high diagnostic value

**R17-3: Evaluator-Optimizer Separation (from EPOCH, 2603.09049 + VMAO, 2603.11445)**
- EPOCH: role-constrained stages prevent the "optimizer's curse" where the same agent that proposes changes also evaluates them
- VMAO: verification by independent model (Opus verifying Sonnet) — cross-model verification provides genuine independence
- Our system already partially does this (QA = GPT-5.2 reviews Coder = Opus)
- **Gap:** Evaluator and Optimizer may not be sufficiently independent if they share scoring rubrics
- **Implementation:** Evaluator rubric should be periodically audited by a different agent/model than the one that created it
- **Expected impact:** Breaks the adversarial feedback loop that the Reasoning Judges paper identified
- **Cost:** LOW-MEDIUM — periodic audit cycle

---

### 2.4 Law 21: Multi-Layer Optimization Paradox

**The Problem:** Optimizing agent interaction behavior (Layer 2) may degrade individual capability (Layer 1) or system outcomes (Layer 3). Per Cross-Ref #54, compound degradation across layers follows P_real ≤ P_measured × ∏(1-εᵢ). The Reliability Illusion Stack (Cross-Ref #29) shows systems reporting 58% benchmark success may have 1-9% real reliability.

**Evidence-Backed Interventions:**

**R21-1: Hierarchical Evaluation Separation (from Cross-Ref #54, Principle 47)**
- Evaluate each layer independently:
  - Layer 1 (Individual): Does each agent complete its subtask correctly? (isolated tests)
  - Layer 2 (Interaction): Do agents coordinate without degradation? (handoff quality metrics)
  - Layer 3 (System): Does the whole system produce valuable output? (human assessment)
- **Key insight:** A Layer 2 improvement that causes Layer 1 regression is NET NEGATIVE if ε₁ increase > ε₂ decrease
- **Implementation:** Add per-agent capability baselines. If an Optimizer change improves interaction but degrades individual quality, flag for review.
- **Expected impact:** Detects cross-layer degradation that's currently invisible
- **Cost:** MEDIUM — requires baseline measurements per agent

**R21-2: Consolidation Sweet Spot (from Cross-Ref #54, Prediction 51)**
- Systems with 2-3 optimization layers that include independent evaluation at each layer perform best
- More layers = more compound degradation
- Our current stack: Agent → QA → Evaluator = 3 layers (appropriate)
- **Risk:** Adding a 4th layer (e.g., meta-evaluator) would likely degrade more than it helps
- **Recommendation:** Resist the temptation to add more evaluation layers. Improve existing layers instead.
- **Cost:** ZERO — design restraint, not implementation

**R21-3: Cross-Layer Canary Testing (from Cross-Ref #42, Asymmetric Scaling)**
- Plant known outcomes at Layer 3, verify they're detectable at Layer 1-2
- If Evaluator gives high scores but Layer 3 canary fails, the optimization is Goodharting
- Asymmetric Scaling finding: defense scaling is sub-linear — canaries are one of the few cheap, effective defense tools
- **Implementation:** Quarterly "system health check" — inject a task with known-correct outcome, trace through all layers
- **Expected impact:** Ground-truth calibration of the entire optimization stack
- **Cost:** LOW — periodic manual test

---

### 2.5 Law 13: Scaling Inversion

**The Problem:** We have 12 agents. Silo-Bench (2603.01045) shows performance strictly degrades at N≥8. Kim et al. (2512.08296) show capability saturation at ~45% baseline. The MAS Deployment Decision Protocol (Cross-Ref #51) provides a 7-step quantitative framework for deployment decisions. No evidence that all 12 agents improve outcomes vs. a focused subset.

**Evidence-Backed Interventions:**

**R13-1: Per-Role Deployment Audit (from Cross-Ref #51, MAS Deployment Decision Protocol)**
- Apply the 7-step protocol to each agent role:
  1. Capability Ceiling Test (B < 0.45?)
  2. Decomposability Test
  3. Diversity Test (genuinely different perspective?)
  4. Coordination Cost Test
  5. Architecture Selection
  6. Stability Check (4ηβ² < γ)
  7. Security Check
- Agents that fail multiple steps should be candidates for dormancy or merger
- **Key question per role:** "Would removing this agent measurably reduce system quality?"
- **Implementation:** Document expected vs. observed contribution per agent. Flag agents with no measurable recent output.
- **Expected impact:** Identifies 3-5 agents that could be dormant without quality loss, reducing coordination overhead
- **Cost:** LOW — analysis only

**R13-2: Dynamic Agent Activation (from Efficient Multi-Agent Coordination, 2512.18337)**
- Tiered communication: Signal → Summary → Full Exchange
- Not all agents need to participate in every task
- Implement "wake-on-signal" — agents activate only when their expertise is needed
- 3.2× speedup with only 2.7% quality loss demonstrated
- Our system partially does this (agents wake on heartbeat, not continuously). Could be refined.
- **Expected impact:** Reduces effective agent count for simple tasks from 12 to 3-5
- **Cost:** MEDIUM — requires task-complexity routing

**R13-3: Evidence-Backed Optimal Count (from Kim et al. + Silo-Bench + DCI + Scaling Laws)**
- Empirical sweet spot: 3-5 agents, 2-3 interaction rounds (8 independent confirmations)
- For code tasks: May → Coder → QA = 3 agents (optimal)
- For research: Scout (1 agent) = optimal for deep work
- For architecture: Bob + May = 2 agents (optimal)
- The full 12-agent ensemble should activate only for cross-cutting system-level decisions
- **Implementation:** Define task categories with pre-assigned agent subsets
- **Expected impact:** Eliminates coordination overhead for routine tasks
- **Cost:** LOW — routing rules in May/orchestrator

---

## 3. The 8 Moderate Risks — Quick Interventions

| Law | Risk | Quick Fix | Source |
|-----|------|-----------|--------|
| 2 (Intelligence Paradox) | Same model family correlated failures | Add 1 non-Opus builder agent | Mixed-Vendor (2603.04421): +4.48% |
| 4 (DAC Stability) | System near instability boundary | Implement R27-1 (dissipation) | DAC (2603.11560): γ > 0 stabilizes |
| 6 (Conversation Tax) | Multi-turn degradation in QA reviews | Cap QA-Coder rounds at 2 | Conversation Tax (2603.11394): 17pp abstention drop |
| 8 (Deception Detection) | No adversarial testing of agent outputs | Monthly red-team exercise | Among Us (2602.05176): 35-55% detection baseline |
| 10 (Consensus Inertia) | File-based coordination creates frozen consensus | Add dissent mechanism to SIGNALS.md | DCI (2603.11781): typed epistemic acts reduce groupthink |
| 14 (Epistemic Coordination) | Agents don't track each other's knowledge | 500-word GUS digest in shared/knowledge/ | DPIP (2603.05450): explicit CG beats inference |
| 15 (Reliability Illusion) | No independent QA verification | Periodic known-bad code injection | JRH (2603.05399): format perturbation is cheapest test |
| 23 (Memory Substrate) | No tiered persistence | Implement R27-2 (Type-Based Admission) | A-MAC (2603.04549): type prior dominates |

---

## 4. Implementation Roadmap

### Phase 1: Dissipation (Week 1) — Fixes Law 27
- Add timestamps to SIGNALS.md entries
- Implement TTL auto-archival (48h for operational, permanent for constitutional)
- Add type tags to lessons.md entries
- **Cost:** ~2 hours implementation. **Impact:** Highest single intervention.

### Phase 2: Ground Truth (Week 2) — Fixes Laws 17, 21
- Establish 4 independent Layer 3 metrics (completion rate, commit frequency, time-to-resolution, regression rate)
- First format perturbation canary test
- Track Evaluator score vs. Layer 3 metric divergence
- **Cost:** ~4 hours setup. **Impact:** Breaks Goodhart cascade.

### Phase 3: Abstraction (Week 3) — Fixes Law 18
- Create principles.md from lessons.md (abstract, deduplicated)
- Switch agent context injection from lessons.md to principles.md
- Archive raw lessons.md for audit trail
- **Cost:** ~3 hours review. **Impact:** Prevents Information Self-Locking.

### Phase 4: Right-Sizing (Week 4) — Fixes Law 13
- Per-role deployment audit against MAS Decision Protocol
- Define task categories with optimal agent subsets
- Implement dormancy for low-contribution roles
- **Cost:** ~4 hours analysis. **Impact:** Reduces coordination overhead.

---

## 5. Priority Matrix

```
Impact
  ▲
  │  R27-1 (Decay)     R17-1 (Ground Truth)
  │  R18-1 (Abstract)  R27-3 (Consolidation)
  │
  │  R13-1 (Audit)     R21-1 (Layer Separation)
  │  R27-2 (Types)     R17-2 (Perturbation)
  │
  │  R13-2 (Dynamic)   R21-3 (Canary)
  │  R18-2 (ZPD)       R17-3 (Separation)
  │
  └──────────────────────────────────────► Cost
       LOW                 MEDIUM
```

**The Pareto frontier:** R27-1 (Weibull Decay) + R17-1 (Independent Ground Truth) + R27-2 (Type-Based Admission) are the three cheapest interventions with highest impact. Implementing all three costs ~4 hours and addresses 3 of 5 critical violations.

---

## 6. Validation Predictions

If these interventions are implemented, we predict:

**P-REM-1:** Introducing TTL on SIGNALS.md (R27-1) will reduce SIGNALS.md size by >60% within 2 weeks while preserving all actionable information.

**P-REM-2:** Abstracting lessons.md into principles.md (R18-1) will improve agent task quality on first attempt (fewer revision rounds) by >15%, measured by QA first-pass rate.

**P-REM-3:** Establishing Layer 3 ground truth metrics (R17-1) will reveal divergence between Evaluator scores and actual quality within the first month — Evaluator scores will correlate <0.5 with Layer 3 metrics initially.

**P-REM-4:** Per-role deployment audit (R13-1) will identify 3+ agents with <10% recent contribution to completed tasks, candidates for dormancy.

**P-REM-5:** Combined Phase 1-2 interventions will measurably improve system stability as observed through reduced inter-session contradictions in shared files.

---

## 7. Meta-Observation

This synthesis itself demonstrates the GUS Self-Application pattern: we're using the framework's findings to improve the system that generated the framework. This is the "beneficial self-reference" that Law 21 warns can become pathological. The key difference between beneficial and pathological self-reference is **independent ground truth** (R17-1) — without it, self-application degenerates into circular confirmation.

The entire remediation protocol rests on one structural principle from Cross-Ref #53 (Knowledge Retrieval Paradox): **separation is the antidote to catastrophic failure.** Separate evaluation from optimization (R17-3). Separate raw observations from injected principles (R18-1). Separate permanent from transient memory (R27-2). Separate coordination from execution (R13-2). Every critical violation traces back to insufficient separation.

---

*Cross-Reference Synthesis #76 completed 2026-03-15. ~16KB.*
*Sources: 14 deep-dives (DD#221, #223, #219, #224, A-MAC, SSGM, AriadneMem, SkillRL, PACED, JRH, PAE, Sim2Real, EPOCH, Efficient Coord.) + 6 cross-refs (#29, #42, #51, #53, #54, #73) + DAC stability theory (2603.11560) + Kim et al. (2512.08296).*
