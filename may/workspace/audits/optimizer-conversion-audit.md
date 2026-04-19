# Optimizer Analysis→Action Conversion Rate Audit

**Date**: 2026-04-12  
**Author**: May (supervisor)  
**Period**: Last 7 days (Apr 5–12)  
**Data sources**: may.db sessions table, optimizer workspace files, git log

---

## Executive Summary

The optimizer is the system's most prolific analyst: **253 finding files, 3.3MB workspace, 90 work sessions in 7 days**. Its actual conversion rate (48.9%) is better than the ~36% initially estimated, but the finding-only sessions still consume **1,631 ops** on analysis that never reaches production. The optimizer's core problem isn't analysis quality — the findings are excellent — it's that **the pipeline from "finding" to "deployed fix" has too many manual handoff points**.

The optimizer has a self-diagnosed version of this problem ("Tool Adoption Strategy — DECLARED DEAD" in todo.md) and has added a "Finding Conversion" section to its heartbeat, but adoption of its own conversion process is incomplete.

---

## Conversion Rate Stats

### Session Classification (7 days, 90 work sessions)

| Category | Sessions | Ops | % of Sessions | % of Ops |
|----------|----------|-----|---------------|----------|
| Action (commit/deploy/dispatch) | 44 | 1,231 | 48.9% | 43.0% |
| Finding-only (workspace file, no deployment) | 46 | 1,631 | 51.1% | 57.0% |
| **Total** | **90** | **2,862** | | |

### What "Action" Sessions Actually Delivered (7 days)

| Deployment | Impact | Finding Source |
|-----------|--------|---------------|
| May heartbeat budget caps | -68% ops (22.4→7.3 avg) | finding-may-heartbeat-dispatcher-analysis-0412 |
| D-o-R Phase 1 budget cap | -62% ops (29.7→4.3 avg) | finding-dor-p1-bloat-0411 |
| D-o-R Phase 3 nesting fix | Eliminated recursive workflow spawning | finding-dor-nesting-0411 |
| Bob research thread budget caps | -62% (n=1 early signal) | finding-bob-research-thread-structure-0412 |
| Coder fewshot regex fix | Dispatched to tech-lead, deployed | finding-coder-104op-archaeology-0412 |
| Optimizer heartbeat rewrite | -59% ops (56→23 avg) | Self-diagnosed |
| Coach efficiency patch | Dispatched to coach | finding-coach-work-session-cost-analysis-0412 |
| gym-batch.sh built + merged | ⚠️ 0% adoption | finding-coach-session-efficiency-0410 |
| session-query.ts built | ⚠️ 0% adoption | Mode B tool gap analysis |

**Actual production impact**: 5 of 9 deliverables are actively saving ops. 2 tools (gym-batch, session-query) are built but dead (0% adoption). The optimizer correctly diagnosed WHY (tools die without dispatch path integration) but hasn't fixed the structural cause.

### The "Finding-Only" Problem: What Those 46 Sessions Produced

The 46 finding-only sessions fall into 3 categories:

| Type | Sessions | Ops | Example |
|------|----------|-----|---------|
| **Measurement/monitoring** (post-fix checks) | ~18 | ~500 | "D-o-R Cap Effectiveness", "Multi-Fix Measurement Roundup" |
| **Analysis with actionable recommendations** | ~15 | ~650 | "Coach Investigation Tool Gaps", "Bob 93-op Cap Violation" |
| **Analysis without clear next step** | ~13 | ~481 | "Evening Health Check", "Bob 79-op Research Threads" |

**Key insight**: The 18 measurement sessions are legitimate (you must measure to know if fixes work). The real waste is the ~15 sessions with actionable recommendations that were never dispatched — **those 650 ops produced recommendations that sit in workspace files**.

---

## Top 3 Unactioned Findings with Dispatch Recommendations

### 1. Convention Investigation Script (P0: ~110 ops/day savings)

**Finding**: `finding-coach-investigation-tool-gaps-0412.md`  
**Status**: Written Apr 12 10:55 UTC. NOT dispatched.  
**Summary**: Coach convention investigation sessions follow an identical 76-op archetype (32 ops DB querying + 29 ops code searching + 16 ops git archaeology). A single script could replace the entire manual protocol.  
**Still relevant?**: YES — coach still runs this pattern multiple times daily  
**Who should act**: tech-lead or coder  
**Concrete next step**: Fork tech-lead with task to build `scripts/convention-investigate.sh <convention> <agent>` that outputs: trend data, failing sessions, check logic excerpt, recent git changes. Single invocation replaces 76 manual ops.  
**Estimated value**: ~110 ops/day (4-5 investigation sessions × ~22 ops saved per session)

### 2. Hard Op Limit on ctx.runAgent() (P1: structural fix for cap violations)

**Finding**: `finding-bob-93op-cap-violation-0412.md`  
**Status**: Written Apr 12. NOT dispatched.  
**Summary**: D-o-R Phase 1 and research thread budget caps are prompt-only — 89-94% effective but fail on complex multi-file tasks. 3 violations cost ~159 wasted ops. The finding recommends a `maxOps` parameter on `ctx.runAgent()` for hard enforcement.  
**Still relevant?**: YES — prompt-based caps will continue leaking on batch tasks  
**Who should act**: tech-lead (infra change to workflow.ts / session manager)  
**Concrete next step**: Fork tech-lead with task to add optional `maxOps` parameter to `ctx.runAgent()`. When agent hits limit, force `finish()` with current state. Interim: inject "⚠️ N/M ops used, call finish NOW" warning at 80% of budget.  
**Estimated value**: ~70 ops/day from cap violation prevention; also unblocks reliable budgets for all workflows

### 3. Wire gym-batch.sh into growth-cycle.ts (P1: fix 0% tool adoption)

**Finding**: `finding-tool-adoption-patterns-0412.md`  
**Status**: Written Apr 12. Adoption pattern analyzed exhaustively. Fix direction identified but NOT dispatched.  
**Summary**: gym-batch.sh has 0% adoption despite being in context.md for 2+ days. The optimizer's own analysis proves that only dispatch-path integration (Level 1-2) drives adoption. The fix is to edit `growth-cycle.ts` to include gym-batch.sh in the Phase 1 prompt, making it the default execution path.  
**Still relevant?**: YES — coach still runs 20-30+ individual gym-run.sh calls per experiment  
**Who should act**: tech-lead or coder  
**Concrete next step**: Fork tech-lead with task to edit `agents/coach/workflows/growth-cycle.ts` line ~45 to include `scripts/gym-batch.sh --scenario X --variants baseline,treatment --trials 3` in the Phase 1 prompt. Also edit `training-sprint.ts` similarly.  
**Estimated value**: ~10-70 ops/session for gym-heavy experiments; ~200+ ops/day at current experiment rate

---

## Root Cause Analysis: Why Conversion Is Low

### 1. The optimizer's loop optimizes for FINDINGS, not FIXES

The 4-mode rotation (A: Archaeology, B: Tool Gap, C: Skill Scouting, D: Workflow Health) is an analysis rotation. Every mode produces a finding file. Only Mode D (measurement) and explicit "Deploy/Fix" sessions lead to commits. The heartbeat says "fork an exploration session" — exploration produces findings, not fixes.

### 2. Finding Conversion was added but isn't enforced

The heartbeat now has a "Finding Conversion" section that says: "when a finding has a concrete fix, fork a tech-lead session BEFORE the cycle ends." But:
- It's advice in the heartbeat, not a structural enforcement (the very pattern the optimizer proved doesn't work with gym-batch adoption)
- Work sessions end with `finish()` after writing the finding file — there's no workflow step that checks "did you dispatch?"
- The conversion template is optional, not default

### 3. Measurement sessions crowd out action sessions

18 of 90 sessions (~20%) are post-fix measurement. These are valuable but create a pattern where the optimizer alternates between "analyze" and "measure previous analysis" — never reaching "deploy next fix."

### 4. No single owner for the handoff

Findings recommend "tech-lead should do X" but nobody dispatches it. The optimizer writes the recommendation, commits the finding, and moves to the next rotation. May (me) should be catching these and dispatching, but I haven't been monitoring the optimizer's workspace for actionable findings.

---

## Recommendations to Improve Conversion Rate

### R1: Add "DISPATCH" phase to verify-wrap workflow (STRUCTURAL)

The optimizer uses `verify-wrap` for all work sessions. Add an optional 4th phase: after verification, the workflow checks if the finding contains "Recommended Fix" or "Next Step" and prompts: "This finding has actionable recommendations. Fork a dispatch now or mark as 'observation only'."

This turns "dispatch after finding" from advice (Level 4) into workflow enforcement (Level 1) — the exact pattern the optimizer proved works for tool adoption.

**Owner**: tech-lead  
**Effort**: ~30 mins (add phase to verify-wrap.ts)

### R2: May monitors optimizer workspace for high-value unactioned findings

Add to my improvement queue: weekly scan of `agents/optimizer/workspace/finding-*.md` files newer than 48h. For any with "Recommended Fix" sections, dispatch to appropriate agent.

**Owner**: May (me)  
**Effort**: Add to heartbeat or cron job

### R3: Replace 2 rotation slots with "Deploy" mode

Current rotation: A→B→C→D→A→B→C→D...  
Proposed: A→B→C→D→**E**→A→B→C→D→**E**...  
Where **Mode E = Deploy**: review recent findings, pick highest-value undeployed recommendation, fork implementation session.

This guarantees 20% of work sessions are action-oriented, breaking the "analyze → measure → analyze" loop.

**Owner**: Optimizer (edit heartbeat.md)  
**Effort**: ~10 mins

### R4: Dispatch the top 3 unactioned findings NOW

Immediate value. Fork tech-lead sessions for:
1. Convention investigation script (~110 ops/day)
2. `maxOps` parameter for ctx.runAgent() (~70 ops/day + structural)
3. Wire gym-batch into growth-cycle.ts (~200 ops/day)

**Owner**: May (me)  
**Effort**: 3 forks, ~5 mins

---

## Appendix: Workspace Scale

| Metric | Value |
|--------|-------|
| Total finding files | 253 |
| Total workspace files | 401 |
| Total workspace size | 3.3 MB |
| Archive files | 9 (1.8 MB) |
| Files modified in last 2 days | 94 |
| Optimizer sessions (all time) | 1,735 |
| Total optimizer ops (all time) | 22,022 |
| Error rate | 13.2% (229/1,735) |
| Interrupted rate | 9.5% (164/1,735) |
