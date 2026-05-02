# EXP-500: Full Measurement Protocol

**Date**: 2026-05-10 (heartbeat)
**Status**: AWAITING_SAMPLE_SIZE (need 50+ worker sessions post-deployment)

## Context

EXP-500 (structural read-before-edit injection) deployed to `master-worker.ts:423-448`.
Early signal from 6 sessions: 83% session-level clean vs 52% baseline.

## Measurement Steps

### Step 1: Identify Post-Deployment Sessions

```bash
# Deployment timestamp: ~1777729000000 (2026-05-10)
# Find all sessions after deployment
for s in $(ls .state/sessions/ | grep -v history); do
  ts=$(echo "$s" | sed 's/s_\([0-9]*\)_.*/\1/')
  if [ "$ts" -gt "1777729000000" ] 2>/dev/null; then
    echo "$s"
  fi
done
```

### Step 2: Count Edit Failures Per Session

```bash
# For each post-deployment session, count:
# a) Total edit() tool calls
# b) Edit failures ("not found in file", "oldText was not found")
# c) Whether pre-read injection fired (look for "EXP-500: Pre-read injected")

for session in $POST_DEPLOY_SESSIONS; do
  total_edits=$(grep -c '"toolName":"edit"' .state/sessions/$session/session.jsonl 2>/dev/null)
  edit_failures=$(grep -c 'not found in file\|oldText was not found\|not found in the file' .state/sessions/$session/session.jsonl 2>/dev/null)
  preread=$(grep -c 'EXP-500.*Pre-read' .state/sessions/$session/session.jsonl 2>/dev/null)
  echo "$session edits=$total_edits failures=$edit_failures preread=$preread"
done
```

### Step 3: Compute Metrics

| Metric | Baseline | Target | Post-Treatment |
|--------|----------|--------|----------------|
| Edit failure rate (call-level) | 15.4% (108/703) | ≤7.7% | TBD |
| Session-level failure rate | 48% (62/130) | ≤24% | TBD |
| Pre-read injection rate | N/A | >50% of edit sessions | TBD |

### Step 4: Analyze Edge Cases

For sessions where pre-read fired BUT edits still failed:
- Was the target file >200 lines (truncation)?
- Was the edit targeting a different file than the pre-read?
- Was the content stale (modified between pre-read and edit)?

## Decision Criteria

- **POSITIVE**: Edit failure rate ≤7.7% AND session failure rate ≤24%
- **DIRECTIONAL**: Any statistically significant reduction (p<0.05 or >5pp delta with n≥30)
- **NEGATIVE**: No reduction or regression

## Timeline

- **Measurement due**: ~2026-05-15 (5 days post-deployment, estimate 50+ sessions)
- **If insufficient sessions**: Remeasure at 2026-05-20

## Current State (as of 2026-05-10)

- Post-deployment sessions: ~3 (insufficient)
- Early signal: 5/6 sessions clean (83% vs 52% baseline)
- **Action**: Wait for sample accumulation. Check again next heartbeat.
