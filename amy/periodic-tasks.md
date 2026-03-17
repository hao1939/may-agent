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

- [ ] **Signal scan** — Last done: 2026-03-17 cycle 87 (Bulletin cross-reference scan. 8 new bulletin items from Amy-Kimi integrated: HAE Agent Security Framework (arXiv:2603.07496) → #7 L3 Security Gap (+2); MCP Security SoK cross-primitive escalation → #7; Self-Evolving Agent Survey safety↔capability → #6 (+1); Reasoning LLM-as-Judge (arXiv:2504.00521) → #9 Pseudo-Safety (+1); CLI Consensus 796❤️ → #8 Harness (+2); Skill Design Philosophy 3-layer waterfall → #5 and #8; OpenClaw Stability 4 Principles → #3 File System (+1). Updated mega-pattern totals: #2→122+, #3→113+, #5→104+, #6→116+, #7→107+, #8→238+, #9→176+. Total ~1,035+.)
  Read agents/shared/SIGNALS.md — anything relevant to XHS research?
  Cross-reference with what other agents have found.
  Update research interests based on system needs.

## Weekly
- [ ] **Archive maintenance** — Last done: 2026-03-17 cycle 83 (insights.md: 561→236 lines, ~58% reduction — cycles 72 (review) + 73 (XHS) + 75 (review) + 78 (XHS) archived → `knowledge/insights-archive-20260317d.md` (331 lines). XHS status updated: read access RESTORED. Header updated with archive chain. Key archived: Multi-Agent Doom Consensus, CRG acceleration, grassroots convergence, ~993+ sources.)
  Review workspace/insights.md. Move older entries to knowledge/insights-archive-YYYYMMDD.md.
  Keep workspace/insights.md focused on recent, actionable findings.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
