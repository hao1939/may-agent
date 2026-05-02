# EXP-530: Structural Verification Gate for Workers

**Date**: 2026-07-01
**Author**: coach
**Status**: DEPLOYED — treatment active in master-worker.ts:451
**Type**: Structural intervention (follows EXP-510/520 proven pattern)

## Problem

Verification failure is the #1 cross-agent quality issue:
- 78% of sessions have verification-related failures (skill-compliance-audit-2026-06-30)
- `verify-before-finish` text skill is deployed but compliance is near-zero
- `verify-after-edit` text skill deployed to ALL agents — still 78% failure
- This confirms KE-480: text coaching is dead for verification behaviors

**Root cause**: Agents write/edit files but never read them back to confirm correctness. The text-based skill instructions are ignored under time pressure.

## Hypothesis

If we inject a structural verification requirement into the worker prompt (same injection point as EXP-510), workers will verify their edits before finishing, reducing verification failure from ~78% to ≤40%.

## Design

### Treatment: Expand EXP-510 COMPLETION REQUIREMENTS

**Current** (master-worker.ts:451):
```
2. After completing work, read back modified files to verify correctness
```

**Proposed** — replace line 2 with explicit structural gate:
```
2. VERIFICATION GATE (mandatory): For every file you write() or edit(), you MUST read() it back BEFORE calling finish(). Your finish() call will be rejected if deliverables include files you haven't read after modifying. List each verified file in your summary.
```

### Measurement

**Baseline**: Current verification failure rate from recent evals
- Source: skill-compliance-audit (78% failure, n=9)
- Need larger sample: measure next 20 worker sessions

**Treatment metric**: % of worker sessions where modified files are read back post-edit
- Extract from session logs: count read() calls that follow write()/edit() on same file
- Success threshold: ≤40% verification failure (from 78%)

**Control**: Heartbeat sessions (not workers) don't get the injection — natural control group

### Implementation

Single edit to `agents/shared/workflows/master-worker.ts:451`:
- Modify the COMPLETION REQUIREMENTS string
- No new code paths, no new gates — just stronger prompt language at the proven injection point

### Why This Should Work

1. **EXP-510 proved this injection point works**: Write rate went 37%→76%, structured finish 0%→69%
2. **KE-480 confirmed**: Structural > text for behavioral enforcement
3. **Same mechanism**: The COMPLETION REQUIREMENTS block is the only text agents consistently follow because it's injected at prompt-level, not in context.md

### Risks

- **Verification adds tool calls** → sessions may take longer / cost more tokens
- **False compliance** → agents may read files perfunctorily without actually checking
- Mitigation: Measure not just read-back rate but also post-treatment quality scores

## Success Criteria

| Metric | Baseline | Target |
|--------|----------|--------|
| Verification failure rate | 78% | ≤40% |
| Post-edit read-back rate | ~22% | ≥60% |
| Quality score (if measurable) | 0.53 avg | ≥0.60 avg |

## Rollback

If verification failure rate doesn't improve after 20 sessions, revert the prompt change. If quality scores drop (agents spending too many tokens on verification and not enough on work), revert.

## Next Steps

1. Deploy: Edit master-worker.ts line 451
2. Wait for 20 worker sessions
3. Measure verification failure rate from evaluations
4. Write results and close
