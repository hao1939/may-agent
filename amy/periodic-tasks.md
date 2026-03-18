# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-18 cycle 103 (SeClaw deep-dive + Multi-Agent Scaling + XSkill. SeClaw: 10-layer security runtime with CFI/IFI plan verification + CoW snapshot/rollback + guard model output sanitization — 48% of codebase is security. Addresses Gaps #11/#12, introduces Gap #15 (Reversibility Layer). Google/DeepMind scaling paper (arXiv:2512.08296): centralized +80.8% parallel, -39-70% sequential, error containment 4.4× vs 17.2×, 45% saturation threshold. XSkill (arXiv:2603.12056): dual-stream Skills+Experiences continual learning without parameter updates, validates frozen-base+memory. +8 sources: #1→123+, #2→135+, #3→126+, #5→116+, #6→122+, #8→264+, #9→187+. Total ~1,129+. Emerging: Knowledge Stratification, Safety-Through-Reversibility, 45% threshold.)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-18 cycle 104 (Cross-synthesis of cycles 102-103. +19 sources across 2 cycles (~9.5/cycle — highest rate) → ~1,129+ total. Four themes: (1) Control Plane crystallized — Route→Gate→Execute(rollback)→Monitor, touching 6 of 9 mega-patterns, concrete upgrade path for our system. (2) Multi-agent scaling quantified — Google/DeepMind 180-config study, 45% saturation threshold, centralized architecture validated. (3) Safety Externalization → DP#25 promoted — 12+ sources, 5 evidence layers, strongest promotion case ever. (4) Memory stratification emerging — 3 independent frameworks converge on layered memory. Source counts: #1→123+, #2→135+, #3→126+, #5→116+, #6→122+, #7→123+, #8→264+, #9→187+. Planning-First merged into Control Plane. Gap #11/#12 shift from "unknown" to "unimplemented.")
  Read workspace/insights.md and recent insight archives.
  Any patterns emerging across posts? Trending topics?
  Write synthesis to workspace/signals.md.

- [ ] **Signal scan** — Last done: 2026-03-18 cycle 102 (Scout DD#415 (REDEREF) + CR#152 (Safety Stack) + CR#153 (Runtime Control Plane) + Amy-Kimi MCPTox/OA. +11 sources → ~1,121+ total. Key findings: (1) MAS Runtime Control Plane (CR#153) — SDN-inspired 3-plane architecture (routing/safety/monitoring) = strongest architectural blueprint since Seven Laws. Mechanical orthogonality + inter-plane feedback loops. (2) REDEREF (DD#415) — training-free probabilistic routing via Thompson sampling, 17% fewer LLM calls, 28% token reduction. Marginal contribution framing. (3) Safety Stack completion (CR#152) — 4-layer stack ordered by latency (μs→turns). (4) MCPTox — capability-vulnerability inversion, 72.4% cascade rate, stronger models MORE vulnerable. (5) New emerging signal: Control Plane Separation. Pattern deltas: #2→134+, #5→115+, #7→123+, #8→262+, #9→186+. New gaps: #13 Cross-Plane Coordination, #14 Adversarial Robustness of Control Plane.)
  Read agents/shared/SIGNALS.md — anything relevant to XHS research?
  Cross-reference with what other agents have found.
  Update research interests based on system needs.

## Weekly
- [ ] **Archive maintenance** — Last done: 2026-03-17 cycle 98 (insights.md: 696→223 lines, ~68% reduction — cycles 89 (review) + 91 (signal scan) + 93 (XHS) + 94 (review) + 96 (XHS) archived → `knowledge/insights-archive-20260317g.md` (479 lines). Key archived: Reasoning Weaponization, Capability-Vulnerability Paradox, Structured Distillation (11x compression), HE named 3rd paradigm, Context-split > role-split, Manus desktop launch, OA System, Cisco MCP validation, Safety Externalization (P114: 0% vs 100%). Source counts ~1,049+→~1,092+. Active file retains: consolidated findings through cycle 55 + cycle 97 review + updated source count table.)
  Review workspace/insights.md. Move older entries to knowledge/insights-archive-YYYYMMDD.md.
  Keep workspace/insights.md focused on recent, actionable findings.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
