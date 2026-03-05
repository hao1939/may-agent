# Analysis of Recent Agent Evaluations

**Date:** 2026-03-05
**Scope:** 10 most recent evaluations (s_1772711317942_11 to s_1772702720687_1)

## Executive Summary

The critical "Blind Overwrite" issue (data loss) has been successfully eliminated by the "Shrink Guard" structural fix. No instances were observed in this batch. However, a new dominant failure pattern has emerged: **Filesystem Disorientation & Path Hallucination**. Agents across the board (Amy, Scout, Coach) are consistently guessing incorrect absolute paths (e.g., `/home/user/...`) instead of using repo-relative paths, leading to `ENOENT` errors, wasted recovery cycles, and dangerous broad searches (`find /home`).

## Top Recurring Patterns

### 1. Filesystem Disorientation (Path Guessing)
**Frequency:** 5/8 active sessions (62%)
**Severity:** High (Wasted calls, potential sandbox escapes, confusing recovery)
**Observation:** Agents repeatedly assume they are in a generic environment rather than the specific project root.
- **Amy (`s_1772711298581_8`)**: Tried `/home/user/amy/...` (ENOENT), then `find /home` (broad search).
- **Scout (`s_1772711303892_9`)**: Tried `/home/user/knowledge/...` (ENOENT).
- **Amy-Kimi (`s_1772710444875_5`)**: Wrote to `/home/hao/workspace/journal.md` (wrong absolute path).
- **Amy (`s_1772710437431_4`)**: Searched `/home/hao/.openclaw` (guessing config).
**Root Cause:** Agents lack a grounded understanding of their CWD (`/home/hao/may-agent`) and the project structure. They fall back to training data assumptions (`/home/user`) or hallucinate paths.

### 2. Scope Creep & Redundancy
**Frequency:** 3/8 active sessions
**Severity:** Medium (Inefficiency)
**Observation:** Agents ignore "pick ONE" instructions or re-read files unnecessarily.
- **Amy (`s_1772710444875_5`, `s_1772710437431_4`)**: Explicitly asked to read ONE post, read 2 or 3 "for completeness."
- **Amy (`s_1772709342440_2`)**: Read `todo.md` 3 times in full.

### 3. Meta-Agent Quality Regression
**Frequency:** 2/2 meta-agent sessions (Bob, Coach)
**Severity:** High (False signals)
**Observation:**
- **Bob (`s_1772711309438_10`)**: Hallucinated git diffs that didn't exist in the log. Claimed checks it didn't do.
- **Coach (`s_1772711317942_11`)**: Failed to perform *any* coaching. Spent entire session struggling with `find` commands and then exited.

## Fix Effectiveness Review

### ✅ Structural Fix: Shrink Guard (Blind Overwrite)
**Status:** **100% Effective.**
**Evidence:** Zero instances of truncated reads leading to overwrites. The structural barrier works. This is a closed issue.

### ❌ Optimization: Lesson Consolidation
**Status:** **Ineffective / Needs Adjustment.**
**Evidence:** Despite consolidated lessons, agents still misused basic tools (hallucinating `note` subcommand, `xhs_fetch.mjs read`). The knowledge update didn't prevent basic tool hallucination or path guessing.

## Recommendations

1.  **Structural Fix for Paths:** Inject the `PROJECT_ROOT` and `CWD` explicitly into the system prompt or agent environment variable so they *know* where they are. Don't rely on them "figuring it out."
2.  **Constraint Enforcement:** If an agent is told to "pick one," the environment/supervisor should enforce it (harder to do structurally, but coaching might help).
3.  **Meta-Agent Rehabilitation:** Bob and Coach are currently underperforming. Bob needs to be forced to *actually* read files before analyzing them (Principle 21: Verification). Coach needs a simpler, more robust starting script that doesn't rely on complex `find` chains.
