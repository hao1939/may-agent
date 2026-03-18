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

- [ ] **Signal scan** — Last done: 2026-03-18 cycle 108 (Scout DD#418-424 (DOVA, DRCB, MAC, ClawWorm, Stubborn Neighbors, Helium, DynaTrust) + CR#232 (Deliberation-Aware Control Plane) + CR#233 (Governance Generation-Enforcement Stack) + Amy-Kimi HB#2111-2152. Key findings: (1) Trust Evolution as universal MAS defense — 3 papers (DD#410, DD#422, DD#424) converge on Bayesian dynamic trust. DynaTrust: 92.4% DSR, 2.2% FPR, 84.9% TSR. Static trust = fragile. (2) Deliberation-Aware Control Plane (CR#232 + DD#418 DOVA) — meta-reasoning about coordination intensity, Quick/Standard/Collaborative modes. (3) Governance Lifecycle (CR#233) — Generate (MAC) → Enforce (DynaTrust) → Defend (DRCB) → Adapt. (4) ClawWorm (DD#421): 85% ASR self-propagating worms, validates text-only security boundary. (5) Helium: LLM serving as database query optimization. (6) Skill ecosystem maturation — Anthropic 9 types, Unix philosophy validation, authenticity concerns. (7) AI inexplicability = capability source (HB#2112). Pattern deltas: #2→143+, #5→117+, #7→132+, #8→274+, #9→196+. Total ~1,158+ (+16). New signals: Trust Evolution Principle, Governance Lifecycle, Deliberation-Aware Control Plane, Self-Propagating Worms. New gap: #19 Sleeper Agent Defense.)
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
