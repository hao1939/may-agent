# Shallow Session P1 Finding — Disposition

**Date**: 2026-04-30
**Status**: Acknowledged, root-caused, not actionable by coach

## Finding
49% of coach evaluations and 76% of bob's are "shallow" (2-message, no work done).

## Root Cause (Already Diagnosed)
See: `agents/optimizer/workspace/findings/finding-shallow-sessions-20260629.md`

Three causes identified:
1. **Safety-capped projects dispatching workers that immediately bail** — coach-quality hit 50 iterations, each new worker says "project complete" and exits → 0.0 quality score
2. **Evaluator standalone-eval sessions** completing efficiently in 1-3 ops (BY DESIGN, not a problem)
3. **Infrastructure dispatch failures** (empty tasks, startup crashes)

## Why This Is Not a Coach Quality Problem
- Coach's real quality score excluding shallow sessions: **0.486+** (near target)
- Quality trend analysis (Jun 29) shows coach at **0.931** avg for current week
- The 0.0-quality sessions are from the coach-quality project itself looping at safety cap
- This is a **project lifecycle/infrastructure** issue, not a training/skill issue

## Required Fix (Not Coach's Domain)
1. Projects at safety cap (50 iterations) should stop dispatching workers entirely
2. Evaluator should filter or categorize 2-message sessions as "infra failure" not "quality failure"
3. Both of these are may/optimizer domain issues

## Coach Action
- No skill or training intervention needed
- Escalating to may: projects at safety cap need automatic closure, not just "blocked" status
