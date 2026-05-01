# Convention Compliance Gap Fix Plan

**Date**: 2026-07-01
**Current Score**: 84.3% (adjusted 87.8%) → **Target**: >90%
**Gap**: 9 failing checks across 3 categories. Need ≥5 fixed to hit 92%.

## Category Analysis

### 1. Transcript Infrastructure Bug (2 checks) — BLOCKED
**Scenarios**: `convention-verify-edit-fewshot`, `convention-verify-edit-verify-wrap`
**Problem**: These scenarios don't generate `transcript.jsonl`, so convention checks that inspect transcripts auto-fail.
**Root Cause**: The gym runner doesn't produce transcripts for scenarios that use fewshot injection or verify-wrap workflows.
**Fix**: Not agent-fixable. Requires gym infrastructure change to ensure transcript.jsonl is written for all scenario types.
**Priority**: LOW (blocked on infra)

### 2. Multi-Edit Product Failures (5 checks) — FIXABLE
**Problem**: Agent uses `write()` instead of `edit()` when modifying files, causing data loss (JSON fields dropped, existing content overwritten).
**Root Cause**: Despite SOUL.md containing "prefer edit() over write()" guidance, agents still reach for write() on modification tasks, especially when dealing with JSON or config files.
**Fix Proposal**:
1. **Strengthen SOUL.md language** in all 7 agents: Change "⛔ Prefer edit() over write() for modifications" → "🚨 NEVER use write() to modify existing files. ALWAYS use edit(). write() = data loss risk."
2. **Add few-shot example** to convention-verify-multi-edit scenario showing correct edit() usage
3. **Re-run gym** after SOUL.md update to measure improvement

**Expected Impact**: Fixing 4-5 of these = sufficient to cross 90% threshold.

### 3. C40 Promise-Report (2 checks) — FIXABLE  
**Scenarios**: `convention-promise-report`
**Problem**: Agent doesn't declare intent before acting (C40.1) or include deliverables in finish() call (C40.2).
**Fix Proposal**:
1. Add explicit C40 guidance to SOUL.md: "Before starting work, state your plan. In finish(), list all files created."
2. This is a behavioral convention — needs to be prominent in SOUL.md, not buried.

**Expected Impact**: Fixing 2 checks.

## Recommended Action Plan

| Step | Action | Impact | Effort |
|------|--------|--------|--------|
| 1 | Strengthen write→edit language in 7 SOUL.md files | +4-5 checks | Low |
| 2 | Add C40 promise-report guidance to 7 SOUL.md files | +2 checks | Low |
| 3 | Re-run gym suite | Measure new score | Medium |
| 4 | (Optional) Fix transcript infra for fewshot/verify-wrap | +2 checks | High |

**Steps 1+2 alone should yield 90%+** (46-48/51 checks passing = 90-94%).

## Exact SOUL.md Patch (Steps 1+2)

Add to each agent's SOUL.md under conventions section:

```markdown
### Critical Conventions
- 🚨 **NEVER** use write() to modify existing files. ALWAYS use edit(). write() overwrites = data loss.
- 📋 **C40 Promise-Report**: Before starting work, state your plan ("I will..."). In finish(), list all files in deliverables[].
```

**Files to patch** (7 total):
- agents/amy/SOUL.md
- agents/arc/SOUL.md  
- agents/bob/SOUL.md
- agents/coach/SOUL.md
- agents/dev/SOUL.md
- agents/optimizer/SOUL.md
- agents/scout/SOUL.md

## Success Criteria
After patching + re-running gym:
- [ ] Gym score ≥ 90% (≥46/51 checks)
- [ ] No new regressions in previously-passing scenarios
- [ ] Multi-edit scenarios show edit() usage (not write())
