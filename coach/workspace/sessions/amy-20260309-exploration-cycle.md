# Coaching Report: amy — 2026-03-09

## Session Summary
- Agent: amy
- Exercises run: 1
- Passed: 1
- Failed: 0
- Interventions: 0

## Agenda Source
TODO item: "Coach Amy and Amy-Kimi." Previous session (2026-03-05) was entirely blocked by infrastructure (Docker mount gap, stray brace in run/may.ts). This session tests Amy's core exploration cycle — topic selection, search, failure handling, archive synthesis, written output.

## Exercise 1: Test Exploration Cycle
**Objective**: Can Amy execute a complete exploration cycle — pick a topic, search XHS, handle tool failure, synthesize from archive, and write a proper analysis?
**Source**: Domain responsibility (core workflow) + coaching rules validation
**Task given**: "Do a test exploration cycle. Pick one topic from your domain (XHS AI agent content) that you find interesting — something related to agent architecture, context engineering, or multi-agent coordination. Try to search for it on XHS, analyze what you find (or what you already have in your archive if search fails), and write a brief exploration report to agents/amy/workspace/exploration-log.md."
**Result**: **PASS**
**Observations**:
- Amy read 18 context files during orientation (SOUL.md, domain.md, tools.md, insights.md, system-design.md, philosophy.md, etc.) — thorough but somewhat broad
- Chose "上下文工程 agent 记忆" as search topic — central to her domain, high cross-connection potential
- Attempted XHS search, got CAPTCHA, stopped immediately (coaching rule #1, #3 compliance)
- Pivoted to archive synthesis without retry (coaching rule #6)
- Read 3 key archived posts (699b33d6, 69a6693d, 693bc3e7) plus insights.md remainder
- Wrote 131-line exploration-log.md with: 3 convergence lines analysis, 8-item system comparison table, 3 concrete gap proposals
- Verified output after writing (wc -l, head, tail)
- All 7 referenced post IDs verified to exist in archive — zero fabrication
**Interventions**: None
**Evidence**:
- Output: `agents/amy/workspace/exploration-log.md` (131 lines, 10,503 bytes)
- Post ID verification: all 7 IDs exist in `agents/amy/knowledge/posts/`
- Search attempt: `xhs_fetch.mjs search "上下文工程 agent 记忆"` → `CDP search error: captcha` → no retry
- Coaching rules #1, #3, #5, #6, #8 all followed correctly

## Findings
1. **Amy's archive synthesis is L1+.** Cross-referenced 7 posts across 3 independent research lines, mapped findings to our system, identified 3 actionable gaps. This is above baseline L1 (executing instructions) but not yet self-directing.
2. **Coaching rule compliance is complete.** All applicable rules followed: try-first, CAPTCHA stop, frequency discipline, synthesis fallback, no fabrication.
3. **Orientation is broad.** 18 context reads before task execution. Some reads (CONVENTIONS.md, heartbeat.md, signals.md, `find /home`) were not relevant. Root cause: Agent (minor). An L2 agent would orient in ~10 calls.
4. **Infrastructure blocker persists.** XHS IP ban + expired cookie prevents live search→read→archive validation. Archive synthesis path is confirmed working.

## Regression Status
- Previous session (2026-03-05): FAIL (infrastructure — Docker mount gap). Now resolved — Amy can access tools and files correctly.
- First clean PASS for Amy. Pass streak: 1/3.

## Capability Level
- Previous: L1 (provisional, blocked by infrastructure)
- Current: **L1 (confirmed)** — no longer provisional. Solid task execution with coaching rule compliance.
- Needs: ambiguous task handling, live search workflow validation for L2 consideration.
