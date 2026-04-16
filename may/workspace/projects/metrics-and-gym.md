# Metrics + Gym Fast Feedback — Project Tracker

**Created:** 2026-04-16  
**Approved by:** Hao  
**Design:** agents/shared/may-agent-docs/design/metric-tension-pairs.md

## Milestones

### M1: Seed Role-Aligned Metrics — tech-lead
- **Status:** ✅ Done (2026-04-16)
- **Result:** 25 role-aligned metrics in may.db

### M2: Scenario Triage — coach  
- **Status:** ✅ Done (2026-04-16)
- **Result:** 323 scenarios → 101 curated (64 discriminating, 29 regression canaries, 8 hard floor). Gaps: scout/optimizer/coach near-zero coverage.
- **Deliverable:** agents/gym/TRIAGE.md

### M3: Coach Fast Loop Pilot — coach
- **Status:** ✅ Done (2026-04-16)
- **Result:** A/B on read-before-edit: 50%→70% (+20pp). C1 failures eliminated. Metric snapshot #258 recorded.
- **Deliverable:** agents/coach/workspace/fast-loop-pilot.md

### M4: Optimizer Pre-deploy Gate — optimizer
- **Status:** ✅ Done (2026-04-16)
- **Result:** 5 scenarios selected, baseline 1/5 (20% pass rate), documented with run commands.
- **Deliverable:** agents/optimizer/workspace/pre-deploy-battery.md

### M5: Scout Scenario Creation — scout + coder
- **Status:** ✅ Done (2026-04-16)
- **Result:** 20 scout-specific scenarios created (2x target). Covers: paper eval, synthesis, hypothesis, dedup, credibility, prioritization, coverage, literature gaps.

### M6: Agent Heartbeat Integration — all
- **Status:** ⏳ Dispatched to tech-lead (s_1776334501697_0)
- **Scope:** Each agent queries their metrics in heartbeat. Fast=every heartbeat, medium=daily, slow=weekly.
