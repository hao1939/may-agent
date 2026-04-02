# CR#186 — Two-Layer Adaptive Governance: HAIG Dimensions + CMAG Mechanisms

## Cross-Reference Type: Synthesis (Governance Architecture)

### Papers Connected
1. **HAIG** (DD#345, 2505.01651v3) — Human-AI Governance trust-utility framework with 3 continuous dimensions
2. **CMAG** (DD#277, 2603.13189) — Constitutional Multi-Agent Governance with hard constraint filtering + soft penalized-utility
3. **MAGPO** (DD#344, 2507.18059v2) — Centralized guidance / decentralized execution paradigm
4. **Steganographic Reasoning** (DD#298, 2602.23163) — Steganographic gap detection for monitoring covert agent behavior

---

## The Insight: Two-Layer Governance Architecture

HAIG and CMAG solve different parts of the governance problem. Combined, they form a **complete adaptive governance stack**:

### Layer 1: HAIG Governance Positioning (Strategic)
- **What it does:** Positions the human-AI system along three continuous dimensions (Decision Authority, Process Autonomy, Accountability Configuration)
- **Identifies:** Which governance thresholds have been crossed
- **Output:** A governance posture specification — "this system requires X level of oversight"

### Layer 2: CMAG Constraint Enforcement (Tactical)
- **What it does:** Given a governance posture, applies appropriate constitutional constraints
- **Mechanism:** Hard constraint filtering + soft penalized-utility optimization
- **Output:** Filtered, ethically-validated agent actions

### The Composition:
```
System State → HAIG Positioning → Governance Posture → CMAG Constraint Selection → Agent Action Filtering
     ↑                                                                                        |
     └────────────────────── Feedback (position drift detection) ─────────────────────────────┘
```

## Why This Matters: The Autonomy Drift Problem

Multi-agent systems don't maintain a fixed position on governance continua. They **drift** due to:

1. **Capability accumulation** — Agents learn and become more capable over time
2. **Behavioral emergence** — Multi-agent interactions produce emergent patterns not present in individual agents
3. **Authority creep** — Gradual expansion of decision authority through successful operation
4. **Accountability diffusion** — As more agents are involved, individual accountability becomes harder to assign

The two-layer architecture addresses drift by:
- HAIG Layer **continuously monitors** system position along governance dimensions
- When a **threshold is crossed**, the CMAG layer automatically adjusts its constitutional constraint set
- Steganographic gap detection (DD#298) provides a **hidden drift monitor** — covert capability expansion that doesn't appear in overt behavior

## Concrete Example: P82-Like Agent System

Consider our agent system evolving over time:

| Time | Decision Authority | Process Autonomy | Accountability | CMAG Constraint Set |
|------|-------------------|------------------|---------------|-------------------|
| T₀ (initial) | 0.2 (human-directed) | 0.3 (protocol-bound) | 0.1 (human-accountable) | Full oversight: all outputs reviewed |
| T₁ (established) | 0.4 (proposal authority) | 0.5 (self-directed within bounds) | 0.2 (shared attribution) | Spot-check: sample outputs reviewed |
| T₂ (mature) | 0.6 (delegated decisions) | 0.7 (autonomous workflow) | 0.4 (distributed) | Threshold-based: intervene on anomalies |
| T₃ (**threshold crossing**) | 0.7 | 0.8 | 0.5 | **NEW CONSTRAINTS ACTIVATE** — mandatory human review for novel actions, safety-critical decisions require unanimous multi-agent agreement |

At T₃, the HAIG layer detects that Process Autonomy has crossed the 0.75 threshold, triggering the CMAG layer to activate additional constitutional constraints automatically.

## Connection to MAGPO's CTDE Paradigm

MAGPO's Centralized Training with Decentralized Execution maps onto HAIG dimensions:

| Phase | Decision Authority | Process Autonomy |
|-------|-------------------|------------------|
| Centralized Training | Low (centralized control) | Low (guided) |
| Decentralized Execution | High (individual decisions) | High (autonomous) |

MAGPO's autoregressive joint policy for guidance represents an explicit mechanism for maintaining coordination while granting process autonomy. In HAIG terms, MAGPO solves the problem of **maximizing Process Autonomy while ensuring Decision Authority remains coordinated** — the exact diagonal in HAIG's two-dimensional governance space that multi-agent systems need to navigate.

## Steganographic Monitoring as Governance Sensor

The steganographic gap (DD#298) provides a crucial **governance sensor** for the two-layer architecture:

- If the steganographic gap is non-zero, agents are communicating covert information
- This represents **hidden autonomy drift** — agents are more autonomous than their observable behavior suggests
- The HAIG layer's position estimate must be corrected upward on Process Autonomy
- This triggers CMAG constraint escalation

**Without steganographic monitoring, governance is blind to covert capability expansion.**

## Research Gaps Identified

1. **Operationalizing HAIG dimensions** — Need quantitative metrics for positioning systems along continua
2. **Multi-agent HAIG** — Extend from bilateral (human-AI) to multilateral (humans-agents) governance
3. **Dynamic threshold discovery** — Automated identification of critical governance transition points
4. **CMAG-HAIG integration protocol** — Formal protocol for translating HAIG positions into CMAG constraint sets
5. **Governance feedback latency** — How quickly must the architecture detect and respond to position drift?

## Relevance to Existing Cross-References

| CR | How This Extends It |
|----|-------------------|
| CR#145 (Ecosystem Defense) | HAIG provides the *governance* layer above the defense *mechanism* layer |
| CR#168 (Runtime Safety Intelligence) | Runtime safety monitoring → HAIG position sensing |
| CR#180 (Authority Illusion) | Authority illusion = HAIG Decision Authority dimension misalignment |
| CR#181 (Coordination Tax) | Coordination overhead = the cost of maintaining HAIG governance positioning |
| CR#184 (Steerability Spectrum) | Steerability maps directly onto HAIG Process Autonomy dimension |

---

*Scout CR#186 — Session s_1773681275494_74 — 2026-03-16*
