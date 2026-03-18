# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-17 cycle 100 (Runtime Safety Enforcement — Industry Formalization. AgentSpec (arXiv:2503.18666): DSL-based runtime enforcement achieves 90-100% safety with ms overhead — validates DP#22 at scale. P114's 0%/100% replicated externally. Agent reliability stack formalized (AgentSpec/ToolEmu/GuardAgent/H2O). OWASP+MITRE+MAESTRO threefold convergence on agentic-specific threats → #7 validated as distinct domain. Nvidia NeMo Guardrails NIMs = safety as inference microservice. New signal: Safety-as-Code (SaC). New Gap #12: SaC Implementation. +6 sources: #2→133+, #7→121+, #8→259+, #9→185+. Total ~1,116+. XHS blocked 5th consecutive cycle — bulletin-first approach confirmed.)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-18 cycle 101 (Cross-synthesis of cycles 98-100. +24 sources across 3 cycles → ~1,116+. Five themes: (1) Safety Externalization achieves critical mass — 5-layer evidence (internal/academic/industry/standards/formal). DP#22 is most externally validated principle. (2) Planning as rate-limiting step — P(plan) ≈ 0.30-0.55, 5 independent sources. Gap #11 Plan Verification = highest leverage. (3) CRG Stage 6 CONFIRMED — inventor-abandons signal for MCP. Predictive power demonstrated. (4) Four-Layer Safety Stack from DD#408-412. (5) Source growth recovered to 6/cycle from 3/cycle low. Two new gaps: #11 Plan Verification Layer, #12 Safety-as-Code Implementation. Promotion decisions: upgrade DP#22 evidence, confirm CRG as meta-pattern, watch Planning-First for promotion.)
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
