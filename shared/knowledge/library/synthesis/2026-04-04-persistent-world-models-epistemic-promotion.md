# CR#281 — Persistent World Models Meet Epistemic Promotion: Formalizing Our Knowledge Pipeline

**Cross-Reference Synthesis** | April 4, 2026
**Sources:** DD#514 (AI-Supervisor/RWM), DD#515 (HAACS/HE2-Net), DD#501 (CraniMem), DD#502 (STORE), CR#277 (Memory Architecture Convergence), Memory Architecture Proposal

## The Pattern

Two independent research streams — one from research automation (AI-Supervisor) and one from human-AI collaboration theory (HAACS) — converge on the same architectural principle: **multi-agent systems need a shared knowledge structure with explicit validation states and formal promotion gates**.

| System | Knowledge Structure | Validation States | Promotion Mechanism |
|---|---|---|---|
| AI-Supervisor | Knowledge Graph (W) | U∈{0,1} (unverified/verified) | Multi-agent consensus + empirical testing |
| HAACS/HE2-Net | Evolving backbone | Provisional/Validated | Epistemic promotion gate (tests + peer checks) |
| CraniMem (DD#501) | Gated memory store | Bounded by quality scores | Attention-gated write |
| STORE (DD#502) | Routed memory | Tier-selected by query type | Router network selects appropriate tier |
| **Our System** | File-based knowledge library | Triage → DD → CR → Research Project | Sequential review (Scout → Bob → tech-lead) |

## The Insight: We Already Have an Epistemic Promotion Gate

Our pipeline **is** a formal knowledge promotion system — we just haven't named it as such:

| Level | Our Pipeline Stage | AI-Supervisor Equivalent | HAACS Equivalent |
|---|---|---|---|
| **Level 0 — Raw** | arXiv triage notes | U=1 nodes (unverified) | Provisional assets |
| **Level 1 — Curated** | Deep Dives (DD#xxx) | U=0 edges after single-agent analysis | — |
| **Level 2 — Validated** | Cross-References (CR#xxx) | U=0 after multi-agent consensus | Validated assets (post-peer-check) |
| **Level 3 — Actionable** | Research Projects / Proposals | Method development loop | Promoted to execution layer |

This four-level structure is more granular than either AI-Supervisor (binary U∈{0,1}) or HAACS (binary provisional/validated). We should **explicitly label and enforce** these levels.

## What We Should Adopt

### 1. Explicit Confidence Metadata
Every knowledge artifact should carry a header indicating its epistemic level:
```
**Confidence:** Level 2 (Cross-referenced, not yet empirically validated)
```
This makes the promotion state visible and queryable.

### 2. Formal Promotion Criteria
Currently, promotion from Level 0 to Level 1 is Scout's judgment. From Level 1 to Level 2 is synthesis. We should document:
- **L0→L1:** Paper addresses MAS-relevant pattern OR has ≥3 connection points to existing DDs
- **L1→L2:** Two or more DDs show convergent pattern; or DD connects to active research project
- **L2→L3:** Tech-lead approval + identified implementation path

### 3. Parallel Investigation (from AI-Supervisor)
AI-Supervisor's Round 1 (independent) → Round 2 (shared visibility) → Orchestrator (routing) pattern is more robust than our sequential pipeline. If we ever scale to multiple research agents, this pattern should govern gap analysis.

### 4. Reassessment Loop (from AI-Supervisor)
When a research direction stalls, don't just search harder — reassess the root mechanism. This is the most actionable insight from DD#514.

## What We Should NOT Adopt

1. **Full KG formalization** — Our file-based system is more transparent and maintainable at our scale. A KG adds query power but also opacity. Keep files until we hit >1000 knowledge nodes.
2. **Automated consensus voting** — Our human-in-the-loop review (tech-lead) provides stronger quality control than automated corroboration counting.
3. **Petri net formalism** — Over-engineered for our practical needs. The informal pipeline description is sufficient.

## Connection to Active Research Projects

**Memory Architecture Proposal:** This synthesis directly informs the tiered memory design. The epistemic promotion gate pattern should be incorporated as the tier-promotion mechanism — memories advance tiers not just by access patterns but by validation state.

**Harness Engineering:** The HAACS three-level orchestration (meta/agent/execution) maps to harness layers. The harness IS our meta-level governance.

**Adaptive Reasoning:** AI-Supervisor's token-budget scaling ("scales elastically with token budget — from lightweight exploration to full-scale investigation") is exactly what the adaptive reasoning project targets.

## Action Items

- [ ] Add epistemic level headers to future DDs and CRs
- [ ] Document formal promotion criteria in knowledge library README
- [ ] Brief Bob on AI-Supervisor's RWM as it relates to memory architecture proposal
- [ ] Brief Optimizer on AI-Supervisor's token-budget scaling for adaptive reasoning research
