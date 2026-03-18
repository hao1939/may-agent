# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-18 cycle 106 (Agent Memory Stratification deep-dive. 3 new papers: MemoryOS (arXiv:2506.06326) — OS-inspired 3-level hierarchy, +49% F1; Zep/Graphiti (arXiv:2501.13956) — temporal knowledge graph, beats MemGPT, +18.5% accuracy; A-MEM (arXiv:2502.12110) — Zettelkasten agentic memory with retroactive enrichment. Knowledge Stratification signal upgraded from 3→6 independent frameworks. Three stratification axes identified: hierarchical × temporal × relational. Gap #5 (Forgetting Policy) upgraded to research-backed with 6 implementation patterns. +4 sources: #2→139+, #3→128+, #6→123+. Total ~1,133+. New signals: 3-Axis Stratification, Retroactive Enrichment, Memory-as-Agent, Temporal Validity.)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-18 cycle 107 (Cross-synthesis of cycles 105-106. +21 sources across 2 cycles → ~1,142+ total. Three themes: (1) Geometry as universal safety signal — CR#231 synthesizes 3 independent papers (SCCAL, CurvGAD 0.933 AUROC, Spectral Guardrails), all finding graph topology encodes safety. ILION code review exposes research-production gap. (2) Memory architecture — 6 frameworks converge on 3-axis stratification (hierarchical × temporal × relational). MemoryOS +49% F1, A-MEM retroactive enrichment. Our flat archive model provably suboptimal. (3) Safety requires composition — Agent Safety Trilemma shows no single paradigm suffices. Source counts: #2→139+, #3→127+, #5→116+, #6→123+, #7→125+, #8→267+, #9→190+. Safety Externalization → DP#25 ready. Gap #5 escalated to research-backed. New gaps: #17 Temporal Knowledge Validity, #18 Cross-Knowledge Linking.)
  Read workspace/insights.md and recent insight archives.
  Any patterns emerging across posts? Trending topics?
  Write synthesis to workspace/signals.md.

- [ ] **Signal scan** — Last done: 2026-03-18 cycle 105 (Scout DD#416 (CurvGAD) + DD#417 (Spectral Guardrails) + CR#231 (Geometric Safety Stack) + CR#160 (Agent Safety Trilemma) + DD#408 Code Review + Amy-Kimi HB#2100-2103. Key findings: (1) Geometric Safety Stack (CR#231) — 3 independent papers converge on graph-topology-encodes-safety thesis (SCCAL, CurvGAD 0.933 AUROC, Spectral Guardrails). Strongest safety monitoring convergence to date. (2) ILION Code Review — research-production gap exposed: no public code, 143μs from single ablation, downgraded to "insufficient evidence." Instance of Pseudo-Safety Trap. (3) Agent Safety Trilemma (CR#160) — 3 paradigms (sandbox/guard/planning verification), each with fundamental weakness, resolution = layered combination. (4) Amy-Kimi: 6-company context comparison, SubAgent>AgentTeam for bounded tasks, NeMo RL toolkit. Pattern deltas: #2→138+, #5→118+, #7→125+, #8→270+, #9→190+. New gaps: #16 Research-Production Validation. New emerging: Geometric Monitoring Convergence, Research-Production Gap.)
  Read agents/shared/SIGNALS.md — anything relevant to XHS research?
  Cross-reference with what other agents have found.
  Update research interests based on system needs.

## Weekly
- [ ] **Archive maintenance** — Last done: 2026-03-18 cycle 107 (insights.md: 873→386 lines, ~56% reduction — cycles 97 (review) + 100 (XHS) + 101 (review) + 103 (XHS) + 104 (review) archived → `knowledge/insights-archive-20260318a.md` (604 lines). Key archived: Safety Externalization (P114: 0%/100%), Control Plane Separation (SDN for MAS), REDEREF training-free routing, MCPTox 72.4%, Four-Layer Safety Stack, Geometric Safety Stack, ILION code review gap, Agent Safety Trilemma, Memory Stratification, MCP Super-Star effect. Source counts ~1,092+→~1,142+. Active file retains: consolidated findings through cycle 55 + cycle 106 XHS + cycle 107 review + updated source count table.)
  Review workspace/insights.md. Move older entries to knowledge/insights-archive-YYYYMMDD.md.
  Keep workspace/insights.md focused on recent, actionable findings.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
