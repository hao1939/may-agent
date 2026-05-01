# 2026-04-17 Friday arXiv Triage — cs.MA

**Session**: 805 | **Window**: Fri 2026-04-17 (fresh) + spill from Thu 2026-04-16
**Counters at start**: DD=775, CR=339, H=94
**Deliverable**: DD#776 (Corpus2Skill)

## Scanned IDs (cs.MA recent, top 8)

| ID | Title (short) | Category | ★ | Action |
|---|---|---|---|---|
| 2604.14572 | Don't Retrieve, Navigate — Corpus2Skill | cs.IR→cs.MA | ★★★★½ | **DD#776** written |
| 2604.15267 | CoopEval — cooperation mechanisms in social dilemmas | cs.GT→cs.MA | ★★★★ | Triaged below; DD deferred (65-page paper, abstract sufficient for now) |
| 2604.14956 | FedGUI — federated GUI agents benchmark | cs.MA | ★★½ | Infrastructure paper; not relevant to our failure-mode research |
| 2604.14811 | Graph-structured world models for ad-hoc networks | cs.LG→cs.MA | ★★ | Networking-specific; skip |
| 2604.14550 | VeriGraphi — hierarchical RTL via multi-agent KG | cs.AR→cs.MA | ★★★ | Spec-anchored knowledge graph — interesting pattern but domain-specific (Verilog). Note: KG-first planning echoes our CR#326 "design-aware" thread |
| 2604.13914 | ANAC 2025 competition results | cs.MA | ★★ | Competition report; no novel mechanism |
| 2604.13699 | MIND — AI co-scientist for materials | cs.MA | ★★½ | Demo/application paper |
| 2604.13128 | Probabilistic responsibility allocation | cs.MA | ★★ | MARL theory; not agent-systems-research |

## CoopEval (2604.15267) — deferred, but notable

Key finding from abstract: **"LLMs with stronger reasoning capabilities behave *less* cooperatively in mixed-motive games"** — and recent models "consistently defect in single-shot social dilemmas." Evaluates 4 mechanisms: repetition, reputation, mediators, contracts. Finding: **contracting and mediation** are most effective; repetition-induced cooperation "deteriorates drastically when co-players vary."

**Why deferred (not upgraded to DD)**: The capability-defection finding is interesting but not directly connected to our active research threads (verification confabulation, structural access, gym-production gap). If May/Bob flag social-dilemma work as a priority, the paper is queued.

**Possible later hook**: The "co-player variation degrades repetition cooperation" finding maps loosely to our multi-agent hand-off fragility (KE-106, DD#707 NSVIF on instruction propagation across chains). Worth re-reading if we pivot toward agent-to-agent trust mechanisms.

## VeriGraphi (2604.14550) — honorable mention

Spec-anchored Knowledge Graph as *deterministic, machine-checkable structural scaffold before code generation*. This is a concrete instance of the "structure before reasoning" pattern (KE-052, DD#709, DD#776). Too domain-specific (RTL) for a standalone DD, but worth noting in future synthesis on "planning-substrate" patterns.

## Phase cap observed

Stopped at 8 abstracts scanned, 4 full abstracts fetched. Within Phase 1 cap (8 ops). One DD produced (≥ minimum deliverable). Backlog coverage reduced by 1 (from 53).

## Covered IDs to append

```
2604.14956
2604.15267
2604.14811
2604.14572
2604.14550
2604.13914
2604.13699
2604.13128
```

## Notes for next session

- Thu 2026-04-16 had 12 cs.MA entries; I scanned the top 2. Remaining 10 plus Wed/Tue listings are untouched — a follow-up Friday arXiv catch-up session could drain another 10-20 IDs.
- CoopEval deserves a full-text read if game-theoretic cooperation becomes a priority. 65 pages, 38 figures — not a heartbeat-sized task.
