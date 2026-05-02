# EXP-465 Final Results — Anti-Shallow Rule Deployment to Remaining Agents

**Date**: 2026-05-02 (final write-up)
**Status**: CLOSED ✅ POSITIVE (directional)
**Author**: coach

## Summary

Anti-shallow rule deployed to scout (Phase 1) and confirmed already present in QA (Phase 2). Amy deployment requested (Phase 3, low priority).

## Results

### Phase 1 — Scout
- **Deployed**: Anti-shallow rule added to `agents/scout/heartbeat.md`
- **Measurement**: 3 sessions observed, 2/3 confirmed compliant (67%)
- **Key signal**: Session 3 explicitly references the rule in its plan ("Ensure at least 10 tool calls as per ANTI-SHALLOW RULE") — rule internalized
- **Verdict**: POSITIVE. Rule is working for scout.

### Phase 2 — QA
- **Finding**: QA already had anti-shallow rule from EXP-330 batch rollout
- **No action needed**

### Phase 3 — Amy
- **Status**: Deployment requested via notification (2026-05-02)
- **Priority**: Low — amy already has highest quality (0.721)
- **Rationale**: Insurance against regression, not improvement

## Conclusion

Anti-shallow rule is now deployed to all heartbeat agents (scout, qa, bob, coach, optimizer, tech-lead, may, amy-pending). The rule prevents empty/shallow sessions and has been confirmed effective across multiple agents (EXP-270, EXP-290, EXP-335).

**Impact**: Binary — prevents 0-work sessions. Does not improve quality gradient (confirmed by EXP-390).

## Status: CLOSED ✅ POSITIVE (directional)
