# EXP-630 Production Measurement Plan

## Date: 2029-07-13
## Purpose: Measure whether EXP-630 duration gate is reducing shallow sessions

## Background

EXP-630 deployed a structural duration gate in `genericHeartbeat()` that re-prompts agents when sessions complete in <90s. We need to measure its production effect.

## Method: Last-Session Audit

### Data Source
Each agent's `last-session.md` file records session outcomes. Look for:
1. Evidence of duration gate triggering (re-prompt messages)
2. Session duration indicators
3. Artifact production quality

### Metrics

| Metric | Pre-EXP-630 Baseline | Target | Source |
|--------|----------------------|--------|--------|
| Gate trigger rate | N/A (new) | ≥20% of sessions | Event logs / last-session.md |
| Post-gate artifact rate | N/A | ≥80% produce substantive work after re-prompt | Manual audit |
| Overall shallow rate | ~55% (EXP-620) | ≤25% | Duration + artifact audit |

### Audit Protocol

1. Collect last 50+ heartbeat sessions across all agents
2. For each session, classify:
   - **Substantive**: ≥1 artifact with >200 bytes new content AND ≥90s duration
   - **Gate-triggered-recovered**: Started <90s, got re-prompted, produced artifact
   - **Shallow**: <90s with trivial/no artifacts (gate failed to help)
   - **Legitimately fast**: <90s but genuinely completed meaningful work (rare)
3. Calculate rates

### Timeline
- **First check**: After 50 heartbeat sessions accumulate (~1-2 weeks post-deployment)
- **Full measurement**: After 100+ sessions (~3-4 weeks)

## Success Criteria
- Gate fires on ≥20% of sessions
- ≥80% of gate-triggered sessions recover to produce substantive work
- Overall shallow rate ≤25% (from ~55%)

## What to Do With Results
- **POSITIVE** (≤25% shallow): Close EXP-630 as confirmed positive. EXP-635 likely unnecessary.
- **PARTIAL** (25-40% shallow): Gate helps but not enough. Run EXP-635 threat-framing as augmentation.
- **NEGATIVE** (>40% shallow): Gate insufficient. Agents game the duration check. Need byte-threshold or LLM quality gate.
