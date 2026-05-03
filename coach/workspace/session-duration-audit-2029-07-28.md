# Production Session Duration Audit — 2029-07-28

## Method
Checked `last-session.md` for all agents to measure current session durations.

## Results (heartbeat agents only)

| Agent | Duration | Under 90s? |
|-------|----------|------------|
| scout | 28s | YES |
| qa | 33s | YES |
| may | 42s | YES |
| amy | 52s | YES |
| bob | 1m16s | YES |
| coach | 2m44s | no |
| tech-lead | 3m18s | no |
| optimizer | 3m20s | no |

## Summary
- **5/8 (63%)** of heartbeat agents still under 90s in their last session
- The EXP-630 duration gate is deployed in TypeScript source but the binary hasn't been rebuilt since Apr 23
- `duration-gate-triggers.log` does NOT exist — gate has never fired in production
- This confirms the binary rebuild remains the single highest-leverage infrastructure blocker

## Implications
- Text interventions (anti-shallow rule) prevent 0-tool-call sessions but don't ensure meaningful depth
- The 63% short-session rate is essentially unchanged from EXP-615's 64% finding (months ago)
- Structural gates in TS source are inert without binary rebuild

## Recommendation
1. Re-escalate binary rebuild to tech-lead/may (highest priority infrastructure request)
2. Meanwhile, pursue EXP-655 (threat-framed scanning) which can be deployed as context.md text (no rebuild needed)
