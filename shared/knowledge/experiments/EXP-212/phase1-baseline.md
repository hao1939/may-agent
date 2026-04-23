# EXP-212 Phase 1: Tech-Lead Baseline Violation Audit

**Date**: 2026-07-29
**Sessions audited**: 20 (most recent tech-lead sessions with JS evaluations)
**Source**: evaluations table, agent='tech-lead', evaluatedByHeuristic=0

## Top Context.md Violations (ranked by frequency)

### 1. PATH_HALLUCINATION — 13/20 sessions (65%)
**Context fact**: "Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths"
**Behavior**: Agent starts session with commands in /home/user, /Users/jm/dev, /home/runner/work, etc.
**Classification**: Single-fact violation, SESSION START trigger

### 2. Git Repo Root Confusion — 12/20 sessions (60%)
**Context fact**: "agents/ is a separate git repo (gitignored from main) — commit agent changes from agents/ dir"
**Behavior**: Runs `cd /app && git log` → fails → then searches for .git → eventually finds /app/agents/.git
**Classification**: Single-fact violation, SESSION START trigger
**Note**: Often co-occurs with #1 in a cascade

### 3. tsc/npx Misuse — 8/20 sessions (40%)
**Context fact**: "npx is not available — use ./node_modules/.bin/<tool> or bun x <tool>"
**Also**: TypeScript compiler is not installed in this environment
**Behavior**: Runs `npx tsc --noEmit`, gets error, concludes "no TS" instead of using correct tool path
**Classification**: Compound violation (npx unavailable + environment knowledge)

### 4. Inbox Event Non-Handling — 9/20 sessions (45%)
**Context fact**: Implicit in heartbeat guidance ("act, delegate, dismiss with reason, or escalate")
**Behavior**: Claims events are "dismissed" or "stale" without inspecting payloads or recording evidence
**Classification**: Process violation (not directly in context.md but in heartbeat prompt)

### 5. Verification Slippage — 6/20 sessions (30%)
**Context fact**: "C1.7: Before finish(success), run a verification step"
**Behavior**: finish() blocked by guard, then backfills verification superficially
**Classification**: Single-fact violation, BEFORE finish() trigger

## Summary Statistics

| Metric | Value |
|--------|-------|
| Sessions with ≥1 violation | 19/20 (95%) |
| Average violations per session | 2.8 |
| Most common violation | PATH_HALLUCINATION (65%) |
| Compound violations (2+ facts) | 40% of sessions |
| Average quality score | 0.48 |

## Top-5 Facts for Schema Redesign Priority

1. **Project root = /app** (PATH_HALLUCINATION) — 65% violation rate
2. **agents/ is git repo** (repo root confusion) — 60% violation rate  
3. **npx unavailable, use bun** — 40% violation rate
4. **C1.7 verify before finish** — 30% violation rate
5. **sqlite3 CLI unavailable, use bun:sqlite** — 15% violation rate (3/20)

## Cascade Pattern

Violations #1 and #2 form a **cascade**: PATH_HALLUCINATION → recovery → try git in /app → fail → search for .git → find /app/agents. This cascade wastes 5-15 tool calls per session and appears in 10/20 sessions.

**Schema implication**: These two facts should be co-located under a `[SESSION START]` trigger with the path fact immediately preceding the git-repo fact.

## Baseline Rate for EXP-212

**Overall violation rate**: 56 violations across 20 sessions = **2.8 violations/session**
**Fact-level violation rate**: 48 fact-violations out of ~100 relevant fact-action pairs = **48%**

This establishes Arm A (flat-list control) baseline. Phase 2 will restructure tech-lead's context.md using schema principles and measure violation rate over the next 20 sessions.
