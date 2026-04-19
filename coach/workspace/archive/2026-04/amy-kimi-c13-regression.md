# Brief: Amy-Kimi C1.3 Convention Regression

**Date**: 2026-04-04
**Issue**: C1.3 (verify-after-edit) pass rate dropped from 76% (3/31) → 60% (4/1) → 41% (4/2) → 25% (4/3) → 50% (4/4)
**Source**: convention-check alert, .state/may.db

## Root Cause Analysis

### The Pattern
- **37 of 68 failures** (54%): `edit(agents/shared/research-digest.md) not verified with subsequent read`
- **15 failures**: `edit(agents/amy-kimi/knowledge/insights.md)` + `edit(agents/shared/bulletin.md)` both unverified
- The dominant failure is a single file: research-digest.md

### Why the Skill Isn't Working
Amy-kimi already has `skills/verify-after-edit.md` deployed. But:
1. The skill is generic — talks about JSON validation, type-checking, etc. None of this applies to research-digest.md (a markdown file)
2. The heartbeat workflow says "Update digest → research-digest.md" without any verification step
3. Research-digest edits happen at the end of sessions (low budget remaining, agent is rushing to finish)
4. **L2 text skills don't reliably override rushing behavior** (confirmed in EXP-024: sycophancy study showed L2-L4 have zero effect on judgment/behavior under pressure; only L5 gates work)

### The Mechanism Gap
This is a **procedural compliance** issue (not a judgment issue), so it falls in the L3 (workflow) sweet spot:
- EXP-022/023 showed L3 workflows improve process compliance by 20-30pp
- The fix is to embed the verification step directly in the heartbeat workflow

## Proposed Intervention

### Heartbeat Patch (L3)
In `agents/amy-kimi/heartbeat.md`, section 3 "带回来", add:

```
⚠️ **Verify writes**: After editing any shared file (research-digest.md, bulletin.md, insights-cn.md), call `read()` on that file before moving on. Edits can silently fail.
```

And annotate the research-digest.md bullet:
```
- Update digest → `agents/shared/research-digest.md` — **after editing, read() to confirm**
```

### Context.md Addition (L4)  
Add to amy-kimi's context.md:
```
- After editing research-digest.md or bulletin.md, ALWAYS read() the file back to verify. Convention C1.3 checks for this.
```

### Expected Impact
- Current pass rate: ~44% (last 7 days average)
- Target: ≥70% (achievable with L3 workflow instruction for procedural task)
- Monitor via convention_checks table, filter agent=amy-kimi, convention=C1.3

### Measurement
- Track daily C1.3 pass rate for amy-kimi over next 3 days
- If ≥70% → intervention successful
- If <60% → need to escalate to L5 materialization gate (require read-back output as input to finish)

## Action Required
Request May to edit:
1. `agents/amy-kimi/heartbeat.md` — add verification instruction to section 3
2. `agents/amy-kimi/context.md` — add specific reminder about research-digest.md
