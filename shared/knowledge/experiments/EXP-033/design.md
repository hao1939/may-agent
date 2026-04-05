# EXP-033 Design: Digest-Based Recovery vs Current In-Memory Mechanisms

**Date**: 2026-04-05
**Author**: Coach (designed per P2 request from May)
**Status**: DESIGNED — awaiting Phase 1 deployment
**Tags**: session-digest, recovery, shadow-classifier, infrastructure

## Background

The Session Digest System (see `docs/design/session-digest.md`) replaces 5 in-memory Maps (~310 lines of code) with a persistent DB-based classifier. The current mechanisms (AutoResume, Circuit Breaker, P62 Recovery, Escalation, Stuck Detector) all lose state on restart. The digest system persists session understanding to SQLite.

## Hypothesis

**H-042**: Digest-based recovery produces equal or better outcomes than current in-memory mechanisms, measured by:
1. **Recovery accuracy**: Correct action taken (resume, escalate, kill, skip) ≥ 95% of the time
2. **Restart resilience**: Recovery decisions survive process restarts (0% state loss vs current ~100% state loss)
3. **Latency**: Action taken within the same detection cycle (no slower than current)

## When to Run

This experiment CANNOT run until **Phase 3 (Shadow Classifier)** is deployed. Phase 3 runs both the old and new mechanisms in parallel and logs both decisions. This is a built-in A/B comparison — we don't need gym scenarios.

**Prerequisites**:
- Phase 1: `session_digests` table exists, `upsertDigest()` working
- Phase 2: All 14 triggers wired
- Phase 3: `classifyDigest()` running alongside existing mechanisms, logging both decisions

## Method: Shadow Comparison (Natural Experiment)

### Design
Phase 3 naturally creates our experiment: for every recovery event, both the old mechanism AND the new classifier produce an action recommendation. We compare them.

**This is NOT a gym experiment.** It's a production shadow comparison.

### Metrics

| Metric | Source | Target |
|--------|--------|--------|
| **Agreement rate** | Compare old_action vs new_action for all triggers | >95% |
| **Disagreement analysis** | Manual review of cases where they differ | New is correct ≥50% of disagreements |
| **False positive rate** | Classifier recommends kill/escalate when old says continue | <5% |
| **False negative rate** | Classifier recommends continue when old says kill/escalate | <2% (safety critical) |
| **Restart recovery** | Count sessions that lose state after restart, compare old vs new | New: 0 lost, Old: baseline measurement |

### Data Collection

```sql
-- Agreement analysis
SELECT 
  trigger,
  COUNT(*) as total,
  SUM(CASE WHEN old_action = new_action THEN 1 ELSE 0 END) as agree,
  SUM(CASE WHEN old_action != new_action THEN 1 ELSE 0 END) as disagree
FROM shadow_classifier_log
WHERE created_at > ?
GROUP BY trigger;

-- Disagreement details for manual review
SELECT * FROM shadow_classifier_log 
WHERE old_action != new_action
ORDER BY created_at DESC;
```

### Sample Size
- Minimum: 100 trigger events with both decisions logged
- Expected: ~50-100 events/day based on current session volume
- Duration: 24-48 hours of shadow mode should be sufficient

## Decision Criteria

| Outcome | Action |
|---------|--------|
| >95% agreement, new correct on >50% of disagreements | Proceed to Phase 4 (switchover) |
| 90-95% agreement | Investigate disagreements, tune classifier, re-run |
| <90% agreement | Classifier needs redesign before switchover |
| Any false negative on safety-critical action | Block switchover until fixed |

## What Coach Measures (Behavioral Impact)

Beyond the infrastructure comparison, Coach should measure whether the digest system improves AGENT behavior:

1. **Context quality**: Does `## Recent Task History` (Phase 5) lead to better session starts?
   - Metric: First 3 tool calls of session are more targeted (fewer orientation reads)
   - Method: Compare session transcripts before/after Phase 5 deployment

2. **Recovery effectiveness**: When an agent resumes after a crash, does it pick up more cleanly?
   - Metric: Time-to-productive-work after crash recovery
   - Method: Measure tool calls until first task-relevant action in recovered sessions

3. **Escalation accuracy**: Does digest-informed escalation produce fewer false escalations?
   - Metric: Escalation accuracy rate (was escalation warranted?)
   - Method: Sample 20 escalations, manually judge if correct

## Risks

1. **LLM variability**: `classifyDigest()` uses LLM synthesis — may be non-deterministic
2. **Latency**: LLM call adds ~1-3s per digest — could delay time-critical actions
3. **Transcript quality**: Agent sessions with poor finish() data → poor digests → poor classification
4. **Confirmation bias**: If we designed both systems, we may unconsciously make them agree

## Timeline

- **Now**: Design complete (this document)
- **Phase 1-2 deployment**: ~2 days (estimated)
- **Phase 3 shadow mode**: ~2-4 days after Phase 2
- **EXP-033 execution**: During Phase 3 shadow period
- **Results analysis**: 1 day after sufficient data collected
- **Phase 4 decision**: Based on EXP-033 results
