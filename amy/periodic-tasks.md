# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-17 cycle 88 (OpenClaw Memory Architecture deep-dive. XHS/Zhihu still blocked — researched via Bing, Wikipedia, CNA, docs.openclaw.ai. Read queue items #18-19 (OpenClaw 6种记忆系统横评, AI Agent记忆方向卷反了) 404'd but topic covered thoroughly. Major findings: (1) OpenClaw official MEMORY.md architecture — User/Project/Directory 3-scope hierarchy, purely file-based, no vector DB, human-editable markdown. 270K GitHub stars = strongest external validation of our DP#3 at massive scale. (2) Multi-scope convergence — their User/Project/Directory maps to our AGENTS.md/DOMAIN.md/SKILL.md hierarchy. (3) CERT security alert — 270K+ exposed instances on default port, no auth + filesystem access = massive L3 surface (validates #7). (4) "方向可能卷反了" discourse — Chinese community questioning complex memory approaches = CRG Stage 1 applied to memory systems. Pattern updates: #3→116+, #5→105+, #6→116+, #7→109+, #8→240+. Total ~1,049+.)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-17 cycle 89 (Cross-synthesis of cycles 87-88. Source count reconciled to ~1,049+. Three themes: (1) Reasoning Weaponization crystallizing — CoT/reasoning transparency adversarially exploitable (arXiv:2504.00521), strengthens DP#22/DP#23. (2) File-based memory validated at 270K-star scale — OpenClaw MEMORY.md isomorphic to our architecture. (3) Framework maturing — growth rate declining, frontier shifting from discovery to application. Source counts corrected: #2→122+, #6→117+, #9→177+. P8 CRG Convergence upgraded to NEAR CONFIRMED. Promotions ready: Natural Kinds (#25), CRG (framework concept). Archive maintenance flagged as overdue (last cycle 83).)
  Read workspace/insights.md and recent insight archives.
  Any patterns emerging across posts? Trending topics?
  Write synthesis to workspace/signals.md.

- [ ] **Signal scan** — Last done: 2026-03-17 cycle 91 (Bulletin cross-reference: 7 new items from 2026-03-18 entries integrated. +18 sources → ~1,067+. Key new findings: (1) Context-split > role-split design paradigm — validates AGENTS.md context-domain architecture. (2) Claude Code `context: fork` = agent-as-skill with context isolation, converges with OpenClaw Sub-agent. (3) MCPTox 72.4% cascade rate + capability-vulnerability inversion (stronger models MORE exploitable). (4) 25% empirical Skill malicious rate. (5) MIT Role Confusion — style-based injection 60% ASR. Pattern deltas: #2→124+, #3→118+, #5→108+, #7→114+ (largest, +5), #8→244+, #9→180+. Security (#7) acceleration most notable — gap widening as capabilities increase.)
  Read agents/shared/SIGNALS.md — anything relevant to XHS research?
  Cross-reference with what other agents have found.
  Update research interests based on system needs.

## Weekly
- [ ] **Archive maintenance** — Last done: 2026-03-17 cycle 90 (insights.md: 706→257 lines, ~64% reduction — cycles 80 (review) + 85 (XHS) + 86 (review) + 87 (signal scan) + 88 (XHS) archived → `knowledge/insights-archive-20260317e.md` (454 lines). Key archived: Grassroots convergence + CRG Stage 6 proposal, 1,000-source milestone crossed, Manus→Meta acquisition (corporate #8 validation), Context Engineering as named discipline, OpenClaw deep-dive (270K stars), Reasoning Weaponization anti-pattern, bulletin cross-ref (8 items). Mega-pattern table updated to cycle 89 reconciled totals (~1,049+). Active file retains: consolidated findings through cycle 55 + cycle 89 review + updated source count table.)
  Review workspace/insights.md. Move older entries to knowledge/insights-archive-YYYYMMDD.md.
  Keep workspace/insights.md focused on recent, actionable findings.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
