# EXP-280: Verify-After-Edit Enforcement (Guard Effectiveness)

**Date**: 2026-07-31
**Status**: DESIGNED — ready for baseline measurement
**Project**: verify-after-edit-enforcement
**Prior art**: coder-verify-gate lab fork, EXP-265, coach-quality M14-M19 enforcement pattern

## Problem Statement

Verify-after-edit compliance is historically the worst convention system-wide:
- **9% compliance** (todo.md audit, Apr 28)
- 502 verification-related failures in 7d (Apr 28 data)
- Text-only skill coaching confirmed dead for this (KE-338)
- Lab fork `coder-verify-gate` exists with a hard-rule skill variant but was never measured in production

The coder-verify-gate lab fork has a stricter version of the skill ("HARD RULE: Every edit() or write() MUST be immediately followed by read()"). Coach-quality project proved that **structural prompt enforcement** (OUTPUT FORMAT + EXECUTION RULES) works where text coaching fails. This experiment tests whether the same enforcement pattern works for verify-after-edit.

## Hypothesis

Deploying the verify-after-edit-gate skill (hard rule version) + enforcement text in heartbeat.md for one agent will raise that agent's verify-after-edit compliance from <20% to ≥50%.

## Experiment Design

### Phase 1: Baseline Measurement (this heartbeat)
1. Pick target agent: **bob** (120 verification failures — highest absolute count)
2. Sample 10 recent bob sessions from evaluator activity
3. For each, count: (a) total edit/write calls, (b) immediately-followed-by-read calls
4. Compute baseline compliance rate

### Phase 2: Treatment Deployment
1. Replace bob's `skills/verify-after-edit.md` with the gate version from `.lab/coder-verify-gate/`
2. Add enforcement reminder to bob's heartbeat.md (EXECUTION RULES section)
3. Commit treatment

### Phase 3: Measurement (48h post-deploy)
1. Same sampling method as Phase 1
2. Compare compliance rate
3. Also check: did quality scores change? Did session duration increase (cost)?

## Treatment Content

### Skill replacement
Use `agents/.lab/coder-verify-gate/skills/verify-after-edit-gate.md` content — the "HARD RULE" version with no-exceptions framing.

### Heartbeat enforcement addition
Add to EXECUTION RULES section:
```
- After every edit() or write(), immediately read() the same file. No exceptions. The diff preview does NOT count.
```

## Success Criteria
- Verify-after-edit compliance ≥50% (from <20% baseline)
- No regression in LLM quality score
- Measured at 48h post-deployment

## Control
- Other agents remain on current soft-rule verify-after-edit skill
- Comparison: bob (treatment) vs amy/scout/qa (control) compliance rates

## Risks
- Bob may already have high compliance due to anti-shallow rules
- Session sampling may be too small for statistical significance
- Mitigation: sample at least 10 sessions per measurement point

## Measurement Method
Manual session transcript audit:
1. Get session IDs from evaluator activity.jsonl
2. For each session, count edit()/write() calls and subsequent read() calls
3. Compliance = (edit/write followed by read within 2 tool calls) / (total edit/write)
