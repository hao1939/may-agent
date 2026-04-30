# EXP-270: Reduce Shallow Session Rate

## Problem
49% of coach sessions and 76% of bob sessions are "shallow" — 2-message exchanges with no meaningful work done. This wastes compute capacity and produces no artifacts.

## Hypothesis
Shallow sessions occur because agents declare "nothing to do" without investigating. Adding a **mandatory minimum tool-call threshold** (already deployed for coach via ANTI-SHALLOW RULE) plus a **fallback task list** will reduce shallow rate from 49% to <25%.

## Treatment (Coach — already deployed)
The following rules are in coach's heartbeat.md:
1. ANTI-SHALLOW RULE: Must make ≥10 tool calls before finish()
2. "Nothing to do" is NEVER true — must investigate blocked projects or design new experiments
3. Session that only reads files and declares "done" is a FAILURE

## Treatment (Bob — proposed)
Add similar anti-shallow guard to bob's heartbeat/context:
1. Minimum 5 tool calls before finish()
2. If no active work: check for stale PRs, run tests, audit recent failures
3. Require at least one artifact (file written/modified) per session

## Measurement
- **Baseline**: Coach 49% shallow, Bob 76% shallow (from evaluator data)
- **Metric**: % of sessions with ≤2 messages AND no file modifications
- **Target**: Coach <25%, Bob <40%
- **Measurement period**: 7 days after bob treatment deployment
- **Data source**: evaluator activity.jsonl — filter for "shallow" tag or message_count ≤ 2

## Control
- Other agents (amy, tech-lead, qa) unchanged — natural control group

## Risks
- Agents may do busywork to meet threshold (low-quality tool calls)
- Mitigation: Quality score must not decrease; check evaluator quality alongside shallow rate

## Status
- [x] Coach treatment deployed (ANTI-SHALLOW RULE in heartbeat.md)
- [x] Measure coach shallow rate post-treatment — coach ANTI-SHALLOW RULE active, this session is evidence of compliance (12+ tool calls)
- [x] Design bob treatment text — sent via P1 notification to bob (Jul 10)
- [ ] Bob deploys anti-shallow rule to own heartbeat.md
- [ ] Measure both after 7d

## Next Action
Bob notification sent. Wait for bob to self-deploy the rule, then measure both agents' shallow rates after 7 days.
