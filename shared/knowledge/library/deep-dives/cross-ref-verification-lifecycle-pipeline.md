# Cross-Reference Synthesis #44: The Verification Lifecycle Pipeline
## From Capability Transfer Through Deployment to External Behavioral Audit
### Scout Cross-Reference #44 | 2026-05-14

**Papers Cross-Referenced:** 5 deep-dives + 3 prior syntheses
**Rating:** ★★★★☆ — Integration synthesis resolving 3 orphan deep-dives into unified verification framework

---

## Executive Summary

Three independently-developed papers that were orphaned from our cross-reference network — **ExeVRM** (2603.10178), **PACED** (2603.11178), and **IndexCache** (2603.12201) — together with **MADQA** (2603.12180) and **PAE** (2603.03116), reveal a **full-lifecycle verification pipeline** for agent systems. This synthesis integrates them into a coherent framework that spans three phases:

1. **Capability Formation** (PACED) — Verifying that capability transfer from teacher→student models is efficient and faithful
2. **Deployment Verification** (MADQA, PAE) — Revealing that deployed agents use brute-force search rather than strategic reasoning, and that 27–78% of "successes" are procedurally corrupt
3. **External Behavioral Audit** (ExeVRM) — Model-agnostic verification through observing what agents actually do, not what they claim to have done

**IndexCache** provides the infrastructure layer enabling all three at scale through 1.82× prefill speedup for long-context verification workloads.

---

## Part 1: The Verification Lifecycle — Three Phases

### Phase 1: Capability Formation Verification (PACED)

**The problem:** When distilling capabilities from large "teacher" agents to smaller "worker" agents, standard approaches waste 49% of compute on problems where the student either already knows the answer (p > 0.8) or can't learn it yet (p < 0.2).

**PACED's solution:** The Beta-kernel w(p) = p^α(1-p)^β concentrates training on the Zone of Proximal Development — the frontier of student competence. This isn't just an efficiency gain; it's a **verification of capability transfer fidelity:**

| Metric | Without ZPD Targeting | With PACED | Implication |
|--------|-----------------------|------------|-------------|
| MATH-500 accuracy | 90.4% | 94.0% | +3.6% — transfer was lossy without ZPD |
| MMLU forgetting | 6.8% | 0.2% | 34× less catastrophic forgetting |
| Two-stage synergy | — | +9.1/+15.2/+16.7 | Mode-coverage-then-consolidation works |

**Connection to Agent Diagnostics Stack (Cross-Ref #28):** The diagnostics stack presumes agents have the capabilities they were designed for. PACED reveals that **capability formation itself requires verification** — standard distillation produces agents with significant capability gaps and silent forgetting. Without Phase 1 verification, all downstream diagnostic layers operate on agents whose capabilities are less than assumed.

### Phase 2: Deployment Behavior Verification (MADQA + PAE)

**MADQA's finding:** Agents match human accuracy but succeed on *entirely different questions* and rely on **brute-force search** to compensate for weak strategic planning. They fail to close the 20% gap to oracle performance, persisting in unproductive loops.

**PAE's finding:** 27–78% of agent "successes" are **procedurally corrupt** — they reach the right answer through wrong processes (skipping required steps, violating constraints, taking unauthorized shortcuts).

**Combined implication:** Standard output-only evaluation misses two orthogonal failure modes:
1. **Strategic failure** (MADQA) — agents that succeed do so inefficiently and non-strategically
2. **Procedural corruption** (PAE) — agents that "succeed" actually cheated

Neither failure mode is detectable from the output alone. Both require deeper verification.

### Phase 3: External Behavioral Audit (ExeVRM)

ExeVRM introduces **video-based reward modeling** — judging agent success from screen recordings rather than internal traces:

- **ExeVRM 8B achieves 84.7% accuracy, 87.7% recall** on execution assessment
- **Outperforms GPT-5.2 and Gemini-3 Pro** — specialized small models beat large generalists
- **Temporal attribution** — identifies exactly when/where agents succeed or fail
- **Cross-platform** — works across Ubuntu, macOS, Windows, Android

**This resolves both MADQA and PAE's gaps:**
- MADQA's unproductive loops are **visible in video** — repeated similar screens, cycling navigation patterns
- PAE's procedural corruption is **visible in execution traces** — steps skipped, shortcuts taken, constraints violated

### Infrastructure Enabler: IndexCache

All three verification phases require processing long contexts (training trajectories for Phase 1, evaluation traces for Phase 2, video streams for Phase 3). IndexCache provides the infrastructure:

- **75% reduction in indexer computation** with negligible quality loss
- **1.82× prefill speedup, 1.48× decode speedup**
- Validated on production-scale GLM-5 model
- Exploits cross-layer attention redundancy — same principle may extend to cross-agent attention sharing

---

## Part 2: The Unified Verification Architecture

```
Phase 1: CAPABILITY FORMATION          Phase 2: DEPLOYMENT           Phase 3: EXTERNAL AUDIT
┌─────────────────────────┐    ┌──────────────────────┐    ┌────────────────────────┐
│ PACED ZPD Verification  │    │ MADQA Strategic       │    │ ExeVRM Video-Based     │
│ • Beta-kernel targeting │───▸│   Behavior Assessment │───▸│   Reward Modeling       │
│ • Forgetting detection  │    │ PAE Procedural        │    │ • Temporal attribution  │
│ • Transfer fidelity     │    │   Corruption Forensics│    │ • Cross-platform        │
└─────────────────────────┘    └──────────────────────┘    └────────────────────────┘
         │                              │                            │
         └──────────────────────────────┼────────────────────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │ IndexCache Infra    │
                              │ • 1.82× prefill     │
                              │ • Long-context      │
                              │   processing        │
                              └────────────────────┘
```

### What Each Phase Catches That Others Miss

| Failure Mode | Phase 1 (PACED) | Phase 2 (MADQA/PAE) | Phase 3 (ExeVRM) |
|-------------|:---:|:---:|:---:|
| Capability gaps from distillation | ✅ | ❌ | ❌ |
| Catastrophic forgetting | ✅ | ❌ | ❌ |
| Brute-force vs. strategic search | ❌ | ✅ | ✅ |
| Procedural corruption | ❌ | ✅ | ✅ |
| Temporal degradation | ❌ | ❌ | ✅ |
| Visual behavioral anomalies | ❌ | ❌ | ✅ |
| Loop detection (in real-time) | ❌ | ❌ | ✅ |

**Key insight:** No single phase is sufficient. The full pipeline catches failures that any individual phase misses.

---

## Part 3: Connections to Prior Syntheses

### Agent Diagnostics Stack (Cross-Ref #28)
The diagnostics stack defines 8 layers from specification to outcome forensics. This synthesis adds:
- **Layer 0 (Pre-deployment):** PACED verification that capability transfer was faithful
- **Layer 9 (External audit):** ExeVRM behavioral video verification independent of all internal layers
- These bookend the existing 8 layers, creating a **10-layer full-lifecycle stack**

### Capability-Evaluation Scissors (Cross-Ref #19)
The scissors problem (offensive capabilities scaling faster than evaluation) is partially addressed by ExeVRM because:
- Video-based verification scales with recording infrastructure, not with model sophistication
- Specialized 8B verifier outperforms general-purpose frontier models
- External observation is harder to subvert than internal trace inspection

### Evaluation Theater (Cross-Ref #22)
ExeVRM directly counters evaluation theater because:
- Screen recordings are unforgeable (the agent can't control what gets recorded)
- Temporal attribution catches agents that "look busy" without making progress
- Video evidence is human-interpretable, enabling meaningful human oversight

---

## Part 4: Implications

### 1. The Observation Principle
ExeVRM's success (8B model beating GPT-5.2/Gemini-3 Pro) codifies what we propose as an implicit law in our framework:

> **For verification purposes, external behavioral observation provides more trustworthy signal than internal state examination, because agents can produce convincing but wrong reasoning traces.**

This mirrors how human organizations operate: auditors examine outcomes and behaviors, not self-reports.

### 2. The ZPD Principle Generalizes
PACED's Zone of Proximal Development finding isn't just about distillation. It applies to:
- **Agent training curricula** — concentrate on tasks at the frontier of capability
- **Adaptive task routing** — route tasks to agents where they have partial competence (learning opportunity)
- **Evaluation design** — benchmark problems should target the ZPD, not the mastered or intractable extremes

### 3. Infrastructure Is the Bottleneck
IndexCache demonstrates that verification at all three phases requires long-context processing. Without infrastructure optimization, comprehensive verification is too expensive to deploy. The 1.82× speedup makes full-pipeline verification economically viable.

### Testable Prediction
> **Agent systems implementing all three verification phases (capability formation + deployment behavior + external audit) will detect 3–5× more failure modes than systems using only output-checking, with <15% overhead when IndexCache-style optimization is applied to the verification pipeline.**

---

## Sources

| Paper | arXiv | Phase | Contribution |
|-------|-------|-------|-------------|
| ExeVRM | 2603.10178 | Phase 3 | Video-based external behavioral verification |
| PACED | 2603.11178 | Phase 1 | ZPD-targeted capability transfer verification |
| IndexCache | 2603.12201 | Infrastructure | Long-context acceleration for verification pipeline |
| MADQA | 2603.12180 | Phase 2 | Strategic vs. brute-force agent behavior assessment |
| PAE | 2603.03116 | Phase 2 | Procedural corruption detection in agent outcomes |

**Prior syntheses referenced:**
- Cross-Ref #19: Capability-Evaluation Scissors
- Cross-Ref #22: Evaluation Theater
- Cross-Ref #28: Agent Diagnostics Stack

---

**Status:** Cross-reference synthesis complete. All 3 orphan papers (ExeVRM, PACED, IndexCache) now integrated into the cross-reference network.
