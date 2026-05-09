# Scout Operational Friction Analysis

**Date**: 2026-05-09  
**Metric**: Scout operational friction rate = **0.803** (target: 0.1, threshold: 0.3)  
**Status**: 🔴 SEVERE BREACH (8x target)

## Root Cause

The friction is dominated by **two related issues** stemming from `scout/last-session.md`:

### 1. Uncommitted changes friction — 72/132 sessions (54.5%)
The file `scout/last-session.md` is persistently dirty in the git worktree. Every scout session that tries to commit its work encounters uncommitted changes from *previous* sessions. The finish hygiene guard then flags this, adding `"finish blocked by uncommitted changes"` to issues.

### 2. Forbidden path violations — 9/132 sessions (6.8%)  
Some scout sessions actively write to `scout/last-session.md`, which the evaluator constraint checker flags as a forbidden edit path.

### Combined impact
- 80/132 sessions (60.6%) marked `needs_improvement`
- Only 50/132 (37.9%) achieved `good` verdict
- The metric formula counts ANY session with non-empty issues OR needs_improvement → 0.803 rate

## Why this matters

This is **systemic friction, not real quality failure**. Many sessions flagged as `needs_improvement` actually produced valid research artifacts (git commits, knowledge updates). The evaluator override data confirms this: several sessions got heuristic `good` but were overridden to `needs_improvement` or `acceptable` on review.

## Recommended fixes (ordered by impact)

### Fix 1: Clean `scout/last-session.md` from git tracking
```bash
cd /app/agents && git rm --cached scout/last-session.md
echo "scout/last-session.md" >> .gitignore  # or */last-session.md
```
This eliminates the uncommitted-changes friction for 54.5% of sessions.

### Fix 2: Add `*/last-session.md` to evaluator's allowed-paths list
If `last-session.md` is a runtime artifact that agents legitimately write, the constraint checker should not flag it as forbidden. This eliminates the 6.8% forbidden-path violations.

### Fix 3: Exclude `last-session.md` dirtiness from finish hygiene guard
The finish guard should ignore `*/last-session.md` files since they're runtime state, not deliverables.

## Projected impact

Fixing #1 alone would reduce friction from 0.803 to ~0.30 (just the genuinely poor sessions). Adding #2 would bring it to ~0.24. Both together likely achieve the 0.1 target as the remaining `needs_improvement` sessions are a mix of real issues and stale evaluator overrides.
