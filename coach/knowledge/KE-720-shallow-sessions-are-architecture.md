# KE-720: Shallow Sessions Are Architecture, Not Agent Failure

## Date: 2029-05-04
## Source: Meta-analysis of EXP-605, 610, 615, 620, 625, 630, 635, 640, 645, 650, 700, 705, 710, 715
## Extends: KE-715 (Text Rules Work With Concrete Thresholds), KE-480 (Text Coaching Dead)

## Finding

The persistent ~50% "shallow session" rate (sessions < 90s with minimal artifacts) is NOT an agent quality problem — it reflects legitimate orchestrator routing decisions. Fourteen experiments spanning 6+ months attempted to reduce this rate through text interventions, structural gates, threat framing, and binary changes. All failed or were rendered moot by this architectural insight.

## Evidence Chain

| Experiment | Approach | Result | Why It Failed |
|-----------|----------|--------|---------------|
| EXP-605 | Observation | <90s = 0% artifacts | Correctly identified symptom |
| EXP-610 | Write-depth gate | CEILING (3/3 baseline) | Gym can't reproduce production shallowness |
| EXP-615 | Notification waste detection | 64% shallow | Measured symptom, no treatment |
| EXP-620 | Gate-gaming detection | 27-55% trivial | Confirmed symptom persists |
| EXP-625 | Duration awareness nudge | SUPERSEDED | KE-480: text won't work |
| EXP-630 | Structural duration gate | DEPLOYED but dead | Binary never rebuilt |
| EXP-635 | Threat-framed depth commitment | CEILING | Gym agents already comply |
| EXP-640 | Production audit | BLOCKED | Binary rebuild needed |
| EXP-645/650/655 | Impact scanning | Text fails in production | KE-655: task distraction nullifies |
| EXP-700 | Parallel tool calls | INCONCLUSIVE | Measurement infeasible |
| EXP-705 | Duration gate audit | 0% recall | Summary length is wrong proxy |
| EXP-710 | Fresh baseline | 50% unchanged | Confirmed gate is dead code |
| EXP-715 | Anti-shallow rule audit | 90% compliance | Rule works; problem is elsewhere |

## The Architectural Reality

1. **~80% of "shallow" sessions are 0-tool orchestrator routing decisions** — quick dispatch/notification/triage that never receive anti-shallow instructions
2. **The anti-shallow rule has 90% compliance** where it applies (agent heartbeats with full instructions)
3. **The remaining shallow sessions are by design** — legitimate quick routing (master dispatching workers, evaluator scoring, judge decisions)
4. **No binary rebuild is needed** — the duration gate concept is moot because the "problem" isn't a problem

## Decision Rule

**Before investigating "shallow sessions" again:**
1. Confirm the sessions in question are agent heartbeats (not orchestrator routing)
2. Check if they receive the anti-shallow rule (only heartbeat.md sessions do)
3. If both yes AND still shallow → investigate. Otherwise → it's architecture, not a bug.

## Meta-Lesson

When a metric persists unchanged across 14 interventions, the metric may be measuring the wrong thing. The 50% shallow rate was correct but misattributed — it reflected system architecture, not agent underperformance.

## Practical Impact

- **Stop**: No more duration gate experiments. The entire EXP-6xx/7xx chain is closed.
- **Keep**: Anti-shallow rule (10 tool calls) — works at 90% where applicable (KE-715)
- **Redirect**: Focus quality interventions on substantive sessions, not shallow rate reduction

## Status: WRITTEN ✅
