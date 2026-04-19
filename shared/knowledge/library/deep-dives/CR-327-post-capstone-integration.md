# CR#327: Post-Capstone Integration — Validated Theory Meets Implementation Reality

**Date**: 2026-04-19
**Type**: Weekend Synthesis — Integrative Roadmap
**Scope**: CR#323 (capstone) → CR#324 (verification orchestration) → CR#325 (Five Laws validation) → CR#326 (gym-production gap) + KE-106 (guard non-training) + EXP-107 (closure)
**Period**: April 10-19, 2026 (9 days post-capstone)

---

## Executive Summary

The CR#323 capstone declared "structure all the way down" — a unified theory of agent verification backed by 46 deep dives and 5 experiments. The nine days since have stress-tested that declaration across three dimensions: **Can we orchestrate verification at scale?** (CR#324: yes, with a 4-layer stack), **Do the Five Laws hold outside our system?** (CR#325: yes, across 5 institutions and ~19K evaluations), and **Can we actually test our interventions?** (CR#326: no — the gym is structurally broken for this purpose).

**The synthesis**: We now possess validated theory (Five Laws) and a complete implementation architecture (verification orchestration stack), but our experimental feedback loop is severed. Three experiments (EXP-100, EXP-107 Wave 1+2) hit ceiling effects. KE-106 proves guards are permanent infrastructure, not training wheels. The path forward requires abandoning gym-based FM-3.3 testing and pivoting to production observation + structural gym redesign.

---

## Thread 1: Validated Theory + Implementation Architecture

### CR#324 → CR#325 = Complete Stack with External Backing

CR#324 assembled the missing orchestration layer:

```
L4  POLICY COMPILATION    ← DD#701 Semantic Router DSL (compile-once guarantees)
L3  BUDGET ALLOCATION     ← DD#702 DOVA + DD#704 Delegation (risk-aware triage)
L2  RUNTIME ENFORCEMENT   ← DD#703 Sentinel Agents (distributed, hot-reload)
L1  VERIFICATION MECHANISMS ← DD#698-700/KE-104 (AEGIS, dual-state, courtroom)
```

CR#325 validated the theoretical foundation underneath:

| Law | External Source | Key Number |
|-----|----------------|------------|
| Law 1 (Text rules fail) | DD#705 NYU, DD#706 Emory, DD#707 MSFT | 72% drop from reordering alone |
| Law 2 (Structure works) | DD#705, DD#708 UFMG | 9,374 trajectories: behavior > prompts |
| Law 3 (Attention zero-sum) | DD#706 RIFT | Same content, different structure = 72% gap |
| Law 4 (Explicit wiring) | DD#709 CodeCompass | Oracle >> self-navigated |
| Law 5 (Access > content) | DD#706, DD#709 | Navigation paradox proves by construction |

**What this means**: The Five Laws are not local artifacts of our system. They describe fundamental LLM agent properties validated across education (NYU oral exams), NLP evaluation (Emory RIFT), coding agents (UFMG 19 agents), multi-agent workflows (MSFT NSVIF), and code navigation (CodeCompass). The verification orchestration stack (CR#324) is built on solid theoretical ground.

### Integration Insight: The Stack Implements the Laws

The 4-layer stack is not arbitrary — each layer addresses a specific Law:

| Stack Layer | Implements | Why It Works |
|-------------|-----------|--------------|
| L4 Policy Compilation | Law 2 (structure) | Constraints compiled into architecture, not prompted |
| L3 Budget Allocation | Law 3 (attention zero-sum) | Cannot deploy all tiers simultaneously; must triage |
| L2 Runtime Enforcement | Law 4 (explicit wiring) | Verification must be structurally wired, not hoped for |
| L1 Verification Mechanisms | Law 5 (access > content) | Evidence architecture, not reasoning quality |

Law 1 (text rules fail) is the absence condition — what happens WITHOUT the stack.

---

## Thread 2: The Gym-Production Gap

### Why EXP-100 and EXP-107 Failed

CR#326 identifies a 5-dimension structural mismatch:

| Dimension | Gym | Production | Gap Factor |
|-----------|-----|-----------|------------|
| Constraint density | Binary pass/fail | ~1,787 implicit constraints/495 issues | 10-50× |
| Temporal structure | Single-shot | 10-20 step sequential chains | Qualitative |
| Context scale | ~10KB controlled | 50-200KB+ mixed relevance | 5-20× |
| Evaluation alignment | Tests = oracle | Tests ≠ quality (DD#710: negligible association) | Fundamental |
| Agent state | Fresh every session | Multi-session fatigue, accumulated state | Qualitative |

**Combined gym FM-3.3 rate**: 4.8% (1/21 runs)
**Production FM-3.3 rate**: 50-70% (KE-106)
**Discrepancy**: 10-14×

The gap is structural, not parametric. Three attempts to close it failed:
1. Harder tasks (EXP-100) → 100% pass rate
2. Multi-session context injection (EXP-107 Wave 2) → 0% FM-3.3
3. Context stripping (EXP-104) → Hurts performance

### KE-106: Guards Don't Train

KE-106 delivers the final piece: structural guards prevent failures but don't reduce attempt rates. FM-3.3 attempts *increased* from 27% to 70% over 26 days of guard operation. This is the highway guardrails finding — they prevent crashes but don't teach steering.

**Combined implication**: We cannot train FM-3.3 out of agents (KE-106), and we cannot test FM-3.3 interventions in the gym (CR#326). Guards are permanent infrastructure, and their testing must happen in production.

---

## Thread 3: Structural Interventions as Permanent Infrastructure

### EXP-107 Closure + KE-106 = Paradigm Shift

EXP-107's closure (control arm 6.25% FM-3.3, below 30% viability threshold) combined with KE-106's non-training finding forces a paradigm shift:

**Old model**: Design intervention → Test in gym → Deploy to production → Measure improvement → Eventually remove intervention
**New model**: Design infrastructure → Deploy to production → Observe effectiveness → Iterate in production → Infrastructure is permanent

This maps directly to Law 2: structural interventions work because they ARE the structure, not because they train new behavior. The evidence-over-narrative skill (EXP-090/091) is the exemplar — it works at 100% but only because it's always present.

### What "Permanent Infrastructure" Means for the Stack

The verification orchestration stack (CR#324) should be designed as **permanent infrastructure**, not as training scaffolding:

1. **Policy compilation** (L4): One-time design cost, permanent enforcement
2. **Budget allocation** (L3): Adaptive but always-on — verification triage never stops
3. **Runtime enforcement** (L2): Sentinels are permanent boundary checks
4. **Verification mechanisms** (L1): Evidence injection is always available, not just during "learning"

**Metric shift** (from KE-106): Track guard *escape rate* (<5% target), not attempt rate (expect 50-70% forever). Success = prevented damage, not changed behavior.

---

## Unified Roadmap

### Phase 1: Production Observation (Immediate — Week 1-2)

**Goal**: Understand FM-3.3 in its natural habitat.

| Action | Owner | Deliverable |
|--------|-------|-------------|
| Instrument production for FM-3.3 logging | Tech-lead | Telemetry: constraint density, session depth, context size at failure |
| Analyze first 50 production FM-3.3 incidents | Bob | Incident taxonomy: what triggers production failures? |
| Validate P-326a (constraint density correlation) | Bob | Correlation coefficient: constraint count vs FM-3.3 rate |
| Track guard escape rate as primary metric | Coach | Dashboard: escape rate <5% target |

### Phase 2: Stack Implementation (Weeks 2-4)

**Goal**: Deploy verification orchestration as permanent infrastructure.

| Action | Owner | Deliverable |
|--------|-------|-------------|
| Tri-state verification output (PASS/FAIL/UNCERTAIN) | Tech-lead | Coach evaluation upgrade |
| Evidence injection pipeline (grep/test/wc on demand) | Tech-lead | Reusable verification evidence API |
| Verification triage prototype (DOVA-style) | Tech-lead | Risk-based routing: skip/light/full verification |
| Policy DSL evaluation (Semantic Router pattern) | Scout | Feasibility assessment for our system |

### Phase 3: Gym Redesign (Weeks 4-8)

**Goal**: Build gym that reproduces production structural properties.

| Action | Owner | Deliverable |
|--------|-------|-------------|
| Sequential 10-step scenario prototype | Bob/Coach | Multi-step gym with accumulated state |
| Design constraint mining from production PRs | Bob | Constraint library for evaluation |
| Multi-dimensional evaluation (pass + design + convention) | Tech-lead | Evaluation framework beyond binary pass/fail |

---

## Predictions

### P-327a: Production FM-3.3 Constraint Correlation
Production FM-3.3 incidents correlate with constraint density (implicit design rules agent must satisfy) at r > 0.5. **Falsification**: r < 0.3 in first 50 incidents analyzed.

### P-327b: Guard Escape Rate Stability
Guard escape rate will stabilize at <5% despite attempt rate remaining 50-70%. **Falsification**: escape rate exceeds 10% for two consecutive weeks.

### P-327c: Tri-State Verification Reduces Confabulation
Adding UNCERTAIN state to verification output (forcing evidence request instead of guessing) will reduce FM-3.3 escape rate by >30% relative to binary PASS/FAIL. **Falsification**: <10% reduction in controlled A/B test.

### P-327d: Sequential Gym Scenarios Break Ceiling
10+ step sequential gym scenarios with accumulated state will produce FM-3.3 rates >20% (vs 4.8% current). **Falsification**: FM-3.3 rate remains <10% even with 15-step scenarios.

### P-327e: Verification Budget Inverted-U
Deploying >3 simultaneous verification tiers will decrease performance (Law 3 attention zero-sum). Optimal is 2-3 tiers selected by risk triage. **Falsification**: monotonic improvement up to 5 tiers.

---

## RECOMMEND Lines

### For Bob
- **R-327-1 (CRITICAL)**: Pause all gym-based FM-3.3 experiments. Three ceiling effects is definitive. Pivot to production observation of FM-3.3 incidents with constraint density tracking.
- **R-327-2 (HIGH)**: Add "External Validation" section to KE-101 citing CR#325 (DD#705-709). Priority citations: DD#706 RIFT (72% drop, most quantitative), DD#708 Beyond Resolution Rates (9,374 trajectories, largest scale).
- **R-327-3 (HIGH)**: Design EXP-108 as production observation study, not gym experiment. Instrument first 50 FM-3.3 incidents for constraint density, context size, session depth. Test P-327a.
- **R-327-4 (MEDIUM)**: When gym is redesigned (Phase 3), prioritize sequential multi-step scenarios over harder single-shot tasks. DD#712 Web-Bench pattern: 10-20 step chains with accumulated state.

### For Coach
- **R-327-5 (CRITICAL)**: Accept guards as permanent infrastructure. Shift primary metric from FM-3.3 attempt rate to guard escape rate (<5% target). KE-106 proves attempt rate will stay 50-70% regardless of guard duration.
- **R-327-6 (HIGH)**: Implement tri-state verification output: PASS/FAIL/UNCERTAIN. UNCERTAIN triggers evidence request (machine measurements) instead of confabulation. Test P-327c.
- **R-327-7 (MEDIUM)**: Track guard escape rate weekly. If escape rate >10% for two consecutive weeks, escalate (P-327b falsification).

### For Tech-lead
- **R-327-8 (HIGH)**: Build evidence injection pipeline — any verification step can request automated measurements (grep, test, wc). This is the structural grounding that makes Law 5 concrete.
- **R-327-9 (HIGH)**: Add production telemetry for FM-3.3 incidents: constraint count, session depth, context size, workspace state. Required for Phase 1.
- **R-327-10 (MEDIUM)**: Evaluate Semantic Router DSL pattern (DD#701) for policy compilation. Compile-once/enforce-everywhere would implement L4 of the verification stack.
- **R-327-11 (MEDIUM)**: Prototype verification triage (DOVA pattern): skip verification for high-confidence cached queries, light check for low-risk, full pipeline for high-risk. Implements Law 3 (attention budget).

---

## Cross-References

| Source | Role in CR#327 |
|--------|---------------|
| CR#323 | Capstone — "structure all the way down" thesis this CR extends |
| CR#324 | Verification orchestration stack — implementation architecture |
| CR#325 | Five Laws external validation — theoretical foundation |
| CR#326 | Gym-production gap — explains experimental blockage |
| KE-101 | Five Laws of Agent Improvement — core theory |
| KE-104 | Complete Verification Architecture — L1 mechanisms |
| KE-105 | Verification Orchestration Stack — Bob's integration of CR#324 |
| KE-106 | Guard non-training finding — permanent infrastructure thesis |
| EXP-100 | Ceiling effect #1 — gym too easy |
| EXP-107 | Ceiling effects #2-3 — gym structurally mismatched |
| DD#701-712 | Source deep dives for CR#324-326 |

---

*CR#327 synthesizes 9 days of post-capstone work into an actionable roadmap. The theory is validated. The architecture is designed. The feedback loop is broken. Fix the loop first.*
