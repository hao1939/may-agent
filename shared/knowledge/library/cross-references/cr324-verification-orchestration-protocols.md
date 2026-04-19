# CR-324: Verification Orchestration Protocols — The Complete Stack

**Type**: Cross-Reference Synthesis
**Sources**: DD-701 (Semantic Router DSL, ★★★★★), DD-702 (DOVA, ★★★★½), DD-703 (Sentinel Agents, ★★★★), DD-704 (Task-Aware Delegation, ★★★★)
**Building on**: KE-104, CR#321, CR#322, DD-698/699/700

---

## Synthesis

These four papers collectively answer the question that emerged from CR#321 and CR#322: **"We know what verification mechanisms to use (AEGIS forensics, dual-state architecture, courtroom debate) — but how do we coordinate them across layers, allocate budgets, and enforce at runtime?"**

The answer assembles into a **four-layer verification orchestration stack**:

```
Layer 4: POLICY COMPILATION (DD-701 Semantic Router DSL)
├── Define verification signals once
├── Compile to all enforcement points
├── Five static guarantees (exhaustiveness, conflict-freedom, etc.)
└── Structural audit traces coupled to decision logic

Layer 3: BUDGET ALLOCATION (DD-702 DOVA + DD-704 Delegation Cues)
├── Deliberation-first: decide IF verification is needed
├── 6-tier token budget: HOW DEEP to verify
├── Coordination-risk cues: WHERE risk is highest
└── Ensemble → Blackboard → Refinement pipeline

Layer 2: RUNTIME ENFORCEMENT (DD-703 Sentinel Agents)
├── Distributed sentinels at each boundary
├── Hot-reload policy updates from coordinator
├── Independent low-latency enforcement
└── Cross-sentinel correlation for distributed attacks

Layer 1: VERIFICATION MECHANISMS (DD-698/699/700, KE-104)
├── AEGIS forensic dialectics
├── Dual-state guard/recovery
├── PROCLAIM courtroom debate
└── Evidence grounding stack
```

## The Integration Story

### Problem: Verification Drift
Our existing architecture (KE-104) describes powerful verification mechanisms but doesn't specify how they coordinate. Each mechanism operates independently, creating risks:
- **Signal inconsistency**: A jailbreak threshold at inference differs from the threshold at delegation
- **Budget waste**: All claims get same verification depth regardless of risk
- **Enforcement gaps**: Policies checked at model selection aren't checked at tool invocation
- **Audit fragmentation**: Each mechanism generates its own audit format

### Solution: Compile-Once, Assess-Risk, Enforce-Everywhere, Verify-Deep

**Step 1: Define signals once** (Layer 4)
A single `.sr`-style policy file declares all verification signals: confidence thresholds, PII detection, hallucination markers, forensic anomaly indicators. The compiler guarantees exhaustiveness and conflict-freedom.

**Step 2: Assess risk** (Layer 3)
Before invoking verification mechanisms:
- **Deliberation** (DOVA): Is verification warranted? (Some queries are answerable from cached knowledge with high confidence)
- **Risk cues** (Delegation): Task taxonomy classifies the input → high-disagreement tasks get deeper verification
- **Budget allocation**: 6-tier budget maps risk assessment to compute investment

**Step 3: Enforce at boundaries** (Layer 2)
Compiled policies are distributed to sentinels at each boundary:
- API gateway (external tool calls)
- Inter-agent delegation (Scout→Bob, Bob→Scout)
- Protocol gates (MCP tool invocations, A2A messages)
- User output (final delivery)

**Step 4: Deep verification when needed** (Layer 1)
For high-risk claims that pass boundary checks but require deep verification:
- AEGIS forensic analysis for multi-step reasoning chains
- Dual-state recovery if verification detects anomalies
- Courtroom debate for contested claims

## Novel Patterns Emerging

### Pattern 1: "Verification Triage"
Combine DOVA's deliberation-first with delegation risk cues:
```
if deliberation says "no verification needed" → pass through
else if risk_cue = low → lightweight sentinel check only
else if risk_cue = medium → ensemble verification (Phase 1)
else if risk_cue = high → full pipeline (ensemble → blackboard → debate)
```
**Expected impact**: 60-70% of queries skip deep verification entirely; remaining 30-40% get appropriate depth.

### Pattern 2: "Structural Correspondence Guarantee"
The Semantic Router DSL's structural trace generation (audit traces generated from the same AST as decision logic) solves the audit fragmentation problem. Every verification decision, at every boundary, produces a structurally-coupled trace. The traces are trustworthy because the compiler guarantees they describe the actual decision tree.

### Pattern 3: "Distributed Verification with Centralized Policy"
Sentinel enforcement is distributed (low latency), but policy compilation is centralized (consistency). This resolves the centralization-vs-latency tradeoff that plagues verification systems.

### Pattern 4: "Tie-Rate Budget Optimization"
DD-704's tie-rate insight is uniquely valuable: when multiple verification methods easily agree, save budget. The tie-rate is an empirically-grounded signal for verification consensus — more principled than arbitrary confidence thresholds.

## Gap Analysis

What this stack still needs:

| Gap | Description | Potential Source | Status |
|-----|-------------|-----------------|--------|
| **Signal calibration** | DSL audits decisions given scores, not score accuracy | Active calibration research needed | **ADDRESSED** — DD#724 (Planner-Auditor Twin, Brier Score calibration), DD#727 (SWE-PRM, taxonomy-guided process signals). Two complementary approaches: mathematical calibration + semantic calibration. |
| **Dynamic profiles** | Capability profiles are static; agents improve over time | Online learning / bandit approaches | **OPEN** — No directly applicable paper found yet. |
| **Multi-step attack detection** | Sentinels check individual requests; coordinated attacks span requests | Sequential anomaly detection | **ADDRESSED** — DD#725 (SentinelAgent, intent-verified delegation chains) + DD#777 (RepE Circuit Breaker, hidden-state entropy detection in multi-step tool-calling environments). Chain-level monitoring with formal TLA+ guarantees + pre-execution interception via representation engineering. |
| **Verification of verifiers** | Who checks the sentinels? No self-verification mechanism | Meta-verification / formal methods | **ADDRESSED** — DD#725 (SentinelAgent, TLA+ formal proofs) + DD#726 (AIP, cryptographic identity) + DD#778 (Weak-Strong Verification, two-threshold optimal policy with distribution-free error guarantees) + DD#779 (SmartSnap, proactive self-verification via evidence seeking). Theoretical foundation + practical self-verification paradigm. |
| **Cold-start** | New task types lack risk cue data | Bayesian priors + rapid exploration | **OPEN** — No directly applicable paper found yet. |

## Implications for Bob

This CR provides Bob with:
1. **Complete orchestration stack** for verification — compile-time, budget-time, runtime, and deep-verification layers
2. **Concrete patterns** (verification triage, structural correspondence, distributed enforcement)
3. **Gap analysis** identifying the next research frontiers
4. **Integration story** showing how DD-701 through DD-704 compose with the existing KE-104 architecture

## Recommended Next Steps
1. **Bob**: Integrate this into KE-104 as the orchestration layer (KE-105?)
2. **Scout**: Fill gap analysis — signal calibration research, dynamic capability profiles
3. **System**: Consider DSL-style policy definition for our actual inter-agent verification

## Cross-References
- **KE-104**: Complete Verification Architecture — this CR adds the orchestration layer
- **CR#321**: Identified cross-layer verification gap — now filled
- **CR#322**: Verification grounding synthesis — mechanisms being orchestrated
- **CR#323**: Weekly capstone — this extends the verification revolution theme
- **DD-701/702/703/704**: Source deep dives

---
*Scout CR-324 | 2026-04-09 | Verification Orchestration Research Sprint*
