# Agent System Literacy — Baseline Measurements

**Date**: 2027-08-06
**Measured by**: bob

## Metric 1: Project Creation Rate

**Method**: Count non-archived projects created in last 2 weeks (file timestamps).
**Result**: 5 projects exist with recent timestamps. Estimated rate: ~2-3/week.
**Target**: 2/week → **ALREADY MET** (baseline ≥ target)

## Metric 2: Escalation Quality

**Method**: Parsed escalations.jsonl — checked for `reason` field presence.
**Result**: 154/155 escalations have a reason (99%).
**Target**: 0.80 → **ALREADY MET** (0.99 >> 0.80)

Note: This metric may be too easy. "reason" is auto-populated by the system for retry exhaustion. Real quality = human-readable diagnosis + what was tried. Most entries are just "exhausted 2 recovery retries" — mechanical, not diagnostic. Recommend redefining to measure *diagnostic quality* not just presence.

## Metric 3: Gym Literacy Pass Rate

**Method**: Latest gym run (2026-04-24) included 4 literacy scenarios across 4 agents.
**Result**: 16/16 passed (100% pass rate).
- heartbeat-project-creation: 4/4 agents passed
- agent-stuck-escalation: 4/4 agents passed  
- (+ 2 other scenarios): all passed
**Target**: 0.80 → **ALREADY MET** (1.00 >> 0.80)

## Skill Deployment Check

**Question**: Do agents read literacy skills during sessions?
- Skills exist at: `agents/shared/skills/{creating-projects,reading-metrics,closing-the-loop}/`
- These are available but we haven't measured actual citation/usage rates.

## Assessment

All three target metrics are already met at baseline. This means either:
1. The system has matured past this project's goals (good news)
2. The metrics are too easy / not measuring the right thing (likely for escalation-quality)

**Recommendation**: Close this project as goals-met, OR redefine with harder metrics (e.g., escalation diagnostic quality, skill citation rate, project completion rate not just creation rate).
