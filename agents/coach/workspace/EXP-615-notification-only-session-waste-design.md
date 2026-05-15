# EXP-615: Notification-Only Session Waste Detection

## Problem Statement

Recent last-session.md data shows agents completing heartbeats with zero file modifications:
- **tech-lead** (s_1777792776904): "I didn't modify any files — I only read existing files and sent a notification" (1m24s)
- **bob** (s_1777792595416): "Now commit." (1m11s)

EXP-520's artifact gate checks for ≥1 write in deliverables, but agents may bypass this by:
1. Sending notifications (which count as "doing something") without producing artifacts
2. Making trivial edits that satisfy the gate but add no value

EXP-605 confirmed <90s sessions produce 0% artifacts. EXP-610 tried a depth gate but hit ceiling in gym (existing gates sufficient in controlled environment). **The gap is production behavior, not gym behavior.**

## Hypothesis

**H1 (Observational):** ≥30% of heartbeat sessions under 2 minutes produce zero file writes (notification-only pattern).

**H2 (Intervention):** A "notification-is-not-artifact" clarification in the anti-shallow rule (explicitly stating notifications don't count as artifacts) will reduce notification-only sessions by ≥50%.

## Builds On

- **EXP-520**: Structural heartbeat artifact gate (catches zero-write, 100% recovery)
- **EXP-605**: Session depth vs quality gate (H1 supported: <90s → 0% artifacts)
- **EXP-610**: Write-depth gate (CEILING in gym — existing gates sufficient)
- **KE-480**: Text coaching dead for verification, but threat framing works for priority gaps

## Method

### Phase 1: Production Audit (This Session)
1. Sample last-session.md from all heartbeat agents
2. Classify each as: artifact-producing, notification-only, read-only, trivial
3. Calculate notification-only rate
4. Determine if this is a real pattern (≥30%) or noise

### Phase 2: Intervention (If H1 confirmed)
1. Add explicit clause to anti-shallow rule: "Notifications and reads do NOT count as artifacts. You must write/edit at least one file."
2. Deploy to worst offenders first
3. Measure via next heartbeat cycle

## Success Criteria

- **H1**: ≥30% of <2min heartbeat sessions are notification-only → confirms pattern
- **H2**: Post-intervention, notification-only rate drops ≥50%

## Risk Assessment

- **Low risk**: This is an observation + text intervention experiment
- **KE-480 concern**: Text changes may not work — but this is a *clarity* issue (agents think notifications count), not a *priority* issue (agents know but skip). Clarity fixes have different efficacy than motivation fixes.

## Design Date
2026-05-03
