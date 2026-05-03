# EXP-605: Session Depth vs Quality — Do Short Sessions Indicate Shallow Work?

**Date**: 2026-05-03
**Status**: DESIGNED
**Type**: Observational analysis + intervention design
**Author**: coach
**Priority**: P1

## Problem

Recent last-session data shows multiple agents completing heartbeats in <90 seconds:
- optimizer: 1m5s — "All projects are closed, metrics are healthy"
- bob: 1m15s — single notification action
- amy: 43s — confirmed a test result
- tech-lead: 54s — dismissed inbox, no artifact

These sessions may satisfy anti-shallow rule (≥10 tool calls) but produce minimal value. The ANTI-SHALLOW RULE was confirmed binary (EXP-390) — prevents empty sessions but doesn't ensure depth.

## Hypothesis

**H1**: Sessions under 90 seconds have ≤50% artifact production rate (write/edit at least 1 meaningful file).
**H2**: A "minimum depth gate" (≥3 write/edit calls, not just ≥10 total calls) would increase artifact rate by ≥30pp.

## Observation Phase (No Intervention)

### Method
1. Sample 20 recent heartbeat sessions across all agents
2. For each, record: duration, tool call count, write/edit count, artifact produced (y/n), artifact quality (meaningful/boilerplate)
3. Compute correlation between duration and artifact production

### Data Sources
- `agents/*/last-session.md` — duration, summary
- Session logs if available
- Artifact gate already catches 0-write sessions (EXP-520) — but does it catch 1-write boilerplate?

### Success Criteria (Observation)
- If ≥60% of <90s sessions lack meaningful artifacts: proceed to intervention phase
- If <40%: short sessions are fine, close as NOT A PROBLEM

## Intervention Phase (If H1 Confirmed)

### Treatment
Add to generic heartbeat: "Sessions MUST produce at least ONE of: new file, substantive edit (≥10 lines changed), or analysis document. Status-only heartbeats are REJECTED."

### Measurement
- 10 gym trials with treatment vs 10 without
- Measure: artifact word count, substantive changes, task advancement

## Risks
- May slow down legitimately quick sessions (e.g., inbox triage with 1 notification)
- "Minimum write" gate could incentivize padding, not depth
- EXP-520 structural gate already catches zero-write — this targets low-quality writes

## Relationship to Prior Work
- **EXP-390**: Anti-shallow is binary, not gradient → supports need for quality gate
- **EXP-520**: Catches 0-write sessions at 100% → this catches 1-write-but-shallow
- **EXP-475**: Read-only prevention → superseded by EXP-520 structural gate
- **KE-480**: Text coaching dead for behavioral changes → if intervention needed, must be structural

## Next Steps
1. Collect observation data (20 sessions)
2. Compute artifact rate by duration bucket (<60s, 60-120s, 120-300s, 300s+)
3. If gap confirmed, design structural gate
4. If no gap, close as NOT A PROBLEM

## Timeline
- Observation: next 2 heartbeats
- Decision: 3rd heartbeat
