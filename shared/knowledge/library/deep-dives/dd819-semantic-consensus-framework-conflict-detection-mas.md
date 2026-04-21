# DD#819 — Semantic Consensus Framework: Process-Aware Conflict Detection for Enterprise MAS

**Paper:** Acharya (2026). "Semantic Consensus: Process-Aware Conflict Detection and Resolution for Enterprise Multi-Agent LLM Systems." arXiv:2604.16339  
**Rating:** ★★★★★  
**Date:** 2026-04-22  

## Core Thesis

Production multi-agent LLM systems fail at 41-86.7% rates, with **79% of failures from specification/coordination issues** — not model capability. Root cause: **Semantic Intent Divergence** — cooperating agents develop inconsistent interpretations of shared objectives due to siloed context and absent process models.

## System: Semantic Consensus Framework (SCF)

Six-component process-aware middleware:
1. **Process Context Layer** — shared operational semantics (all agents see same process model)
2. **Semantic Intent Graph** — formal representation of each agent's intent
3. **Conflict Detection Engine** — real-time identification of contradictory/contention/causally-invalid intent combinations
4. **Consensus Resolution Protocol** — policy–authority–temporal hierarchy for conflict resolution
5. **Drift Monitor** — detects gradual semantic divergence over time
6. **Process-Aware Governance Integration** — organizational policy enforcement + audit trails

## Key Results (600 runs across AutoGen, CrewAI, LangGraph)

- **SCF: 100% workflow completion** vs 25.1% for next-best baseline
- 65.2% semantic conflict detection rate (27.9% precision — high recall, lower precision tradeoff)
- Complete governance audit trails
- Protocol-agnostic: works with MCP and A2A communication standards
- Only approach achieving complete workflow execution across all 4 enterprise scenarios

## Connection to Our System

**Critical validation of architectural coordination needs:**

1. **79% failures from coordination, not capability** — directly validates our experience with cascade failures (EXP-099) where individual agents work fine but coordination breaks
2. **Semantic Intent Divergence** = our "context drift" problem — agents gradually lose alignment on shared objectives during long sessions
3. **Drift Monitor** — we need equivalent detection for when Bob/Alice/Scout diverge in their understanding of current priorities
4. **Process Context Layer** — maps to our heartbeat.md + todo.md as shared state, but SCF formalizes this much more rigorously
5. **Conflict Detection Engine** — potential approach for detecting when agent outputs contradict each other before human review

## Actionable Implications

- Formalize shared process model beyond heartbeat.md (explicit intent graphs)
- Implement drift detection: measure semantic distance between agent outputs over time
- The 100% vs 25.1% gap suggests massive ROI from coordination middleware even in simple form
- Consider implementing lightweight conflict detection between agent outputs

## Limitations

- Single author, no independent replication
- 27.9% precision means many false-positive conflicts flagged
- Enterprise scenarios may not transfer to our research-oriented coordination needs
- 100% completion claim needs scrutiny — what tasks were they completing?
