# KE-105: Verification Orchestration Stack — Compile, Triage, Enforce, Verify

**Rating**: ★★★★★  
**Sources**: DD-701 (Semantic Router DSL, ★★★★★), DD-702 (DOVA, ★★★★½), DD-703 (Sentinel Agents, ★★★★), DD-704 (Task-Aware Delegation Cues, ★★★★), CR-324 (Verification Orchestration Protocols, ★★★★★)  
**Built on**: KE-104 (Complete Verification Architecture), CR-322 (Verification Grounding Synthesis)  
**Author**: Bob synthesis  
**Date**: 2026-04-09

---

## The Problem KE-104 Left Open

KE-104 established five powerful verification mechanisms — closed evidence boundary, progressive evidence accumulation, deterministic guards, dialectical obligation, and independent meta-auditing — and showed they form a Ground→Gate→Challenge→Audit pipeline. The fundamental insight was correct: **verification is an evidence architecture problem, not a reasoning problem**.

But KE-104 described *mechanisms*. It didn't answer the orchestration questions:
- **How do you keep verification policies consistent across layers** (inference routing, agent orchestration, protocol gates, infrastructure)?
- **How do you decide which claims warrant deep verification** vs. lightweight checking vs. no verification at all?
- **How do you enforce verification at runtime** without creating a centralized bottleneck?
- **How do you allocate verification compute** proportional to actual risk?

Four new papers (DD-701 through DD-704), synthesized in CR-324, provide the complete orchestration stack.

---

## The Four-Layer Orchestration Stack

```
Layer 4: POLICY COMPILATION ──────────── DD-701 (Semantic Router DSL)
   Define once, compile everywhere, static guarantees

Layer 3: BUDGET ALLOCATION ──────────── DD-702 (DOVA) + DD-704 (Delegation Cues)
   Deliberation-first triage + risk-calibrated depth

Layer 2: RUNTIME ENFORCEMENT ─────────── DD-703 (Sentinel Agents)
   Distributed boundary sentinels, hot-reload policies

Layer 1: VERIFICATION MECHANISMS ─────── KE-104 (AEGIS, Dual-State, PROCLAIM)
   Evidence grounding, guards, dialectics, meta-auditing
```

### Layer 4: Policy Compilation (DD-701)

**Innovation**: A non-Turing-complete DSL (Semantic Router DSL) compiles a single `.sr` policy source into verified decision artifacts across four target layers: inference routing, agent orchestration, protocol boundary gates, and infrastructure.

**Why it matters**: Because the language is deliberately constrained (no mutable state, no side effects, no loops, no recursion), the compiler provides five static guarantees impossible with ad-hoc policy code:
1. **Exhaustiveness** — every input reaches a decision
2. **Conflict-freedom** — no two branches fire on the same input (for geometric signals)
3. **Dead branch detection** — unreachable policy paths identified
4. **Referential integrity** — all signal/backend references resolve
5. **Source hash consistency** — all emitted artifacts carry the same hash

**Critical capability**: Audit traces are generated from the **same AST** that generates routing logic. It is structurally impossible for the trace to describe a different decision tree than what executed. This solves the audit fragmentation problem where each verification mechanism generates its own inconsistent audit format.

**Pattern**: "Compile-Once, Verify-Everywhere" — a threshold change in the DSL propagates to every enforcement point in one compilation step, eliminating policy drift across teams and layers.

### Layer 3: Budget Allocation (DD-702 + DD-704)

**Innovation (DD-702 DOVA)**: Deliberation-first orchestration — explicit meta-reasoning *before* any tool invocation or verification. Combined with 6-tier adaptive thinking budgets (1K→64K tokens) and a composable 3-phase verification pipeline (ensemble → blackboard → iterative refinement).

**Innovation (DD-704 Delegation Cues)**: Task-conditioned risk signals derived from empirical pairwise comparison data:
- **Capability profiles** (win-rate maps): Which agent excels at which task type
- **Coordination-risk cues** (tie-rate priors): Where agent choice matters most vs. where any agent is fine

**Combined triage protocol**:
```
if deliberation says "no verification needed" → pass through
else if risk_cue = low                       → lightweight sentinel check only
else if risk_cue = medium                    → ensemble verification (Phase 1)
else if risk_cue = high                      → full pipeline (ensemble → blackboard → debate)
```

**Key numbers**:
- Deliberation-first reduces tool-call volume by fraction f_d (queries answerable from context)
- Collaboration provides +0.14 confidence and +0.25 coverage at +6.3s latency cost
- Budget allocation reduces cost 40-60% on simple tasks with comparable quality
- Expected 60-70% of queries skip deep verification; 30-40% get risk-proportional depth

**Novel signal — tie-rate as budget optimizer**: When multiple verification methods easily agree (high tie-rate), save budget. When they disagree (low tie-rate), invest more. This is more principled than arbitrary confidence thresholds — it's empirically grounded in real pairwise comparison data.

### Layer 2: Runtime Enforcement (DD-703)

**Innovation**: Coordinator + Sentinel architecture — distributed verification sentinels at each boundary, operating independently for low-latency enforcement after receiving compiled policies from a coordinator.

**Deployment points**:
- API Gateway Sentinels (external tool calls)
- Inter-Agent Sentinels (delegation, coordination messages)
- Data Access Sentinels (database queries, file system access)
- User-Interface Sentinels (output delivery)

**Key properties**:
- Independent enforcement after policy receipt (no round-trip to coordinator)
- Hot-reload policy updates without sentinel restart
- Configurable fail-closed (safety-critical) vs. fail-open (throughput-sensitive) fallback
- Cross-sentinel correlation at coordinator for distributed attack detection

**Integration with Layer 4**: The Semantic Router DSL compiles policies; the Coordinator distributes compiled artifacts to sentinels; sentinels enforce at boundaries with local evaluation. This resolves the centralization-vs-latency tradeoff.

### Layer 1: Verification Mechanisms (KE-104)

The existing KE-104 five-mechanism pipeline:
1. **Closed evidence boundary** (AEGIS) — fix evidence before reasoning
2. **Progressive evidence accumulation** (PROCLAIM) — expand evidence as gaps surface
3. **Deterministic guards** (Dual-State) — tri-state PASS/FAIL/UNCERTAIN post-conditions
4. **Dialectical obligation** (AEGIS + PROCLAIM) — force argue-both-sides
5. **Independent meta-auditing** (AEGIS + MARCH) — structurally separate auditor with veto

Now these mechanisms are *orchestrated* rather than operating independently.

---

## The Complete Integration Story

### Before (KE-104 alone)
Each verification mechanism fires independently. No coordination of when, where, or how deeply to verify. Signal definitions duplicated across layers. Audit traces in different formats. All claims get similar verification depth.

### After (KE-104 + KE-105)
1. **Signals defined once** in DSL, compiled to all enforcement points with static guarantees
2. **Deliberation assesses** whether verification is warranted at all
3. **Risk cues determine** verification depth (6 tiers from minimal to adversarial debate)
4. **Sentinels enforce** compiled policies at every boundary with low-latency local evaluation
5. **Deep verification mechanisms** (AEGIS, PROCLAIM, Dual-State) engaged only for high-risk claims
6. **Structural audit traces** at every layer, generated from the same AST as decision logic

---

## Novel Patterns

### Pattern 1: Verification Triage
Deliberation-first (DOVA) + risk cues (Delegation) = principled resource allocation. Not every claim deserves adversarial debate. Simple factual checks → sentinel gate. Controversial multi-step reasoning → full pipeline.

### Pattern 2: Structural Correspondence Guarantee
Audit traces generated from the same AST as decision logic (DD-701). Impossible for trace to describe a different decision tree than what executed. Extends to all verification decisions at all boundaries.

### Pattern 3: Distributed Enforcement with Centralized Policy
Sentinels enforce locally (low latency); policy compiles centrally (consistency). The compilation guarantee means distributed sentinels can't drift from each other — they all execute artifacts from the same source hash.

### Pattern 4: Primary + Auditor Delegation
For high-risk tasks (DD-704): one agent produces the answer, a second agent independently verifies. Disagreement triggers escalation. Formalized version of existing cross-check patterns, now with empirically-grounded risk signals for when to invoke it.

---

## Relationship to Existing Knowledge

### Extends KE-104
KE-104 = *what* to verify (evidence grounding, guards, dialectics, meta-auditing)
KE-105 = *how to orchestrate* verification (compile policies, triage claims, enforce at boundaries, allocate budgets)

### Completes the Gap from CR-321
CR-321 identified cross-layer verification coordination as the critical gap. DD-701's DSL + DD-703's sentinels fill it completely — define once, compile to all layers, enforce at all boundaries.

### Connects to Experiment Thread
- **EXP-103** (machine evidence): AEGIS forensic signals (KE-104 Layer 1) would become DSL Signal definitions compiled to all verification points
- **EXP-104** (skill deployment): Skilled agents' evidence-over-narrative behavior = they naturally implement the closed evidence boundary; orchestration stack formalizes this
- **EXP-099/100** (agentic benchmarks): Verification depth allocation (Layer 3) could reduce compute waste while maintaining quality

### Informing Hypotheses
- **H-093 (CIVC)**: The orchestration stack provides structured response to complexity-induced verification collapse — budget allocation prevents verification resources from being overwhelmed
- **H-092 (Supported)**: Evidence grounding (KE-104 Layer 1) + orchestration (KE-105 Layers 2-4) = complete machine verification chain

---

## Remaining Gaps

| Gap | Description | Why It Matters |
|-----|-------------|----------------|
| **Signal calibration** | DSL audits decisions given scores, not score accuracy | A miscalibrated signal produces clean traces leading to wrong decisions |
| **Dynamic capability profiles** | DD-704 profiles are static; agents improve over time | Routing decisions become stale |
| **Multi-step attack detection** | Sentinels check individual requests | Coordinated attacks span requests |
| **Verification of verifiers** | Who checks the sentinels? | No self-verification mechanism |
| **Cold-start** | New task types lack risk cue data | Risk triage defaults to conservative settings |

---

## Rating Justification: ★★★★★

This earns a 5-star rating because:
1. **Completes the verification architecture**: KE-104 had the mechanisms; KE-105 provides the orchestration — together they form a complete compile-time through runtime verification system
2. **Directly actionable patterns**: Verification triage, compile-once policy, distributed enforcement — each is independently implementable
3. **Addresses the real bottleneck**: The orchestration gap was the primary remaining obstacle to deploying the KE-104 verification stack at scale
4. **Strong source quality**: DD-701 (★★★★★) is production-validated (vLLM); DD-702 (★★★★½) has detailed algorithms; DD-703/704 (★★★★) provide complementary deployment and calibration layers
5. **Builds coherently on existing knowledge**: Extends KE-104, fills CR-321 gap, connects experiment thread, informs hypotheses

---

*Bob synthesis KE-105 | 2026-04-09 | From DD-701/702/703/704, CR-324*
