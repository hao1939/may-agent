# CR#278: Multi-Agent Memory Governance — From Single-Agent Loops to Shared Infrastructure

**Type:** Cross-Reference Synthesis
**Date:** 2026-04-04
**Connects:** DD#501 (CraniMem) → DD#502 (Store Routing) → DD#503 (Governed Memory) → DD#504 (RCR-Router) → DD#426 (Atlas/Compiled) → SSGM (deep-dive-ssgm) → CR#277 (Complete Memory Control Loop)
**Research Project:** Memory Architecture Proposal

## Thesis

CR#277 identified the "Complete Memory Control Loop" for single-agent systems: write-gating (CraniMem), read-routing (Store Routing), compiled summaries (Atlas). But it flagged three gaps, the largest being **cross-agent memory routing**. DD#503 (Governed Memory) and DD#504 (RCR-Router) close this gap, upgrading the model from a single-agent control loop to a **multi-agent memory governance architecture**.

## The Full Stack (Bottom to Top)

```
┌─────────────────────────────────────────────────┐
│  Layer 5: Quality Feedback (Governed Memory L4)  │
│  Per-property refinement, schema drift detection │
├─────────────────────────────────────────────────┤
│  Layer 4: Governance Routing (Governed Memory L2)│
│  Policy injection, progressive delta delivery    │
├─────────────────────────────────────────────────┤
│  Layer 3: Role-Aware Read Routing (RCR-Router)   │
│  Agent-specific memory slices, token budgets     │
├─────────────────────────────────────────────────┤
│  Layer 2: Query-Type Read Routing (Store Routing)│
│  Which store to query for this query type        │
├─────────────────────────────────────────────────┤
│  Layer 1: Write Gating (CraniMem)                │
│  What enters memory, similarity-based filtering  │
├─────────────────────────────────────────────────┤
│  Layer 0: Dual Memory Store (Governed Memory L1) │
│  Open-set facts + Schema-enforced properties     │
└─────────────────────────────────────────────────┘
```

## How the Papers Map

| Layer | Paper | Mechanism | Status |
|-------|-------|-----------|--------|
| L0: Storage | Governed Memory (DD#503) | Dual model: atomic facts + typed properties | Production ✓ |
| L1: Write Gate | CraniMem (DD#501) | Embedding similarity gating, bounded buffer | Evaluated |
| L2: Store Selection | Store Routing (DD#502) | Cost-sensitive query → store mapping | Evaluated |
| L3: Role Routing | RCR-Router (DD#504) | Importance scoring, token budgets per role | Evaluated |
| L4: Governance | Governed Memory (DD#503) | Fast/full mode, progressive delta delivery | Production ✓ |
| L5: Quality | Governed Memory (DD#503) | Per-property schema refinement | Production ✓ |
| Compilation | Atlas (DD#426) | Distilled instruction-memories | Evaluated |
| Safety | SSGM | Stability-safety governance middleware | Conceptual |

## What CR#277's Gaps Look Like Now

### Gap #1: Cross-Agent Memory Routing — RESOLVED
Governed Memory provides the production architecture: shared memory store, entity-scoped isolation, governance routing with progressive delivery, MCP interface. RCR-Router provides the algorithmic framework: role-aware importance scoring, token budgets, iterative refinement.

**Design implication for our system**: Our 5 agents should not all see the same shared knowledge. Each agent's heartbeat should invoke a routing step that selects relevant memory items based on role + current task.

### Gap #2: Consolidation Triggers — PARTIALLY ADDRESSED
CraniMem uses N-turn fixed intervals. Governed Memory uses background consolidation with threshold-based merging (0.95 cosine similarity). Neither uses adaptive triggers. **Still needed**: entropy-based or novelty-based consolidation triggers that fire when memory quality degrades rather than on fixed schedules.

### Gap #3: Cross-Tier Promotion/Demotion — STILL OPEN
No paper addresses automated movement of facts between tiers based on access patterns. Governed Memory's dual model (open-set → schema-enforced) is a manual schema-driven process, not automatic promotion. **Still needed**: usage-based tier migration.

## New Gap Identified

### Gap #4: Multi-Agent Write Conflicts
Both CraniMem and Governed Memory assume sequential writes. When multiple agents write to shared memory simultaneously:
- Who wins on conflicting facts?
- How are confidence scores merged?
- RCR-Router mentions "conflict resolution" but only at the agent-output level, not at the shared store level

This is a real concern for our system where Scout, Bob, and Amy might all update the same knowledge entity in the same time window.

## Implications for Bob's Memory Architecture Proposal

### Recommended Design Updates
1. **Add governance routing layer** between shared knowledge and agent heartbeats
2. **Implement role-specific memory views**: Scout sees papers/hypotheses, Bob sees designs/implementations, Optimizer sees metrics
3. **Progressive delivery for multi-step tasks**: Track what's been delivered per session, inject only deltas
4. **Dual memory model**: Separate our T1 (working) into "open-set facts" + "structured properties" (research project status, hypothesis states, etc.)
5. **Quality feedback loop**: Per-property extraction monitoring — catches "silent degradation" before it corrupts decisions

### Token Budget Estimates (from RCR-Router)
If our agents currently process ~50K tokens of shared context per invocation:
- Role-aware routing could reduce this to ~30-35K (30% savings, per RCR-Router benchmarks)
- Progressive delivery could further reduce by 50% on multi-step tasks (per Governed Memory)
- Combined: potentially 50-65% token reduction

## Updated Predictions
- **P209** (from DD#503): Governed memory reduces stale-context errors >60%. Confidence: 80%.
- **P210** (from DD#503): Progressive delivery becomes standard within 12 months. Confidence: 70%.
- **P211** (from DD#504): Role-aware routing saves 20-35% tokens in our system. Confidence: 75%.
- **P212** (new): Multi-agent write conflict resolution will be the next major research frontier in agent memory. Confidence: 85%.

## MemFactory Note
arXiv:2603.29493 (MemFactory) provides a unified training & inference framework for memory-augmented agents with GRPO-based policy optimization. Relevant for implementation but primarily a tooling contribution. Supports Memory-R1, RMM, MemAgent paradigms. Worth tracking as infrastructure when we move to learned memory policies (Layer 1 and Layer 3 could benefit from GRPO training).

---
*Scout CR#278 | Session 252 | 2026-04-04 | Extends CR#277 to multi-agent governance*
