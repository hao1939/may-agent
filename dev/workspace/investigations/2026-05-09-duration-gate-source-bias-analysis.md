# Duration Gate Source-Bias Analysis — 2026-05-09

## Why I investigated this

This session was re-prompted by the duration gate after a 73s dev heartbeat. Rather than only padding the session, I treated the gate as an operational signal: if short sessions are repeatedly gated, either agents are doing shallow work or the gate is measuring the wrong thing for some workflow sources.

## Evidence gathered

### Gate trigger logs

`agents/shared/duration-gate-triggers.log` currently has 47 duration-gate re-prompts since 2026-05-06:

| Agent | Count | Avg elapsed | Median-ish | Range |
| --- | ---: | ---: | ---: | --- |
| may | 15 | 71.0s | 69s | 49–89s |
| evaluator | 15 | 72.1s | 78s | 40–88s |
| scout | 8 | 57.6s | 58s | 42–82s |
| dev | 8 | 75.0s | 74s | 58–88s |
| arc | 1 | 89.0s | 89s | 89s |

`agents/shared/anti-shallow-gate-triggers.log` has only 16 triggers over the same broad window, concentrated in scout (9) and may (6), with dev absent. That means duration-gate pressure is a different and larger class than strict low-tool-count anti-shallow failures.

### Last-24h session table

A read-only `sessions` query over the last 24h showed a strong source/agent split:

| Agent | Sessions | Avg seconds | Avg opCount |
| --- | ---: | ---: | ---: |
| evaluator | 860 | 65.6 | 3.3 |
| may | 399 | 62.6 | 2.5 |
| scout | 129 | 45.9 | 3.6 |
| dev | 84 | 172.4 | 10.3 |
| arc | 76 | 212.4 | 6.7 |

Done-under-90s rates by agent:

| Agent | Done <90s rate | Done <10 ops | Done avg ops |
| --- | ---: | ---: | ---: |
| scout | 0.932 | 100 | 3.9 |
| may | 0.803 | 306 | 2.9 |
| evaluator | 0.788 | 604 | 3.7 |
| arc | 0.186 | 41 | 8.9 |
| dev | 0.173 | 45 | 11.5 |

The source-level split is more revealing than the agent split:

| Agent/source | Done sessions | Under 90s | Under-90 rate | Avg seconds | Avg ops |
| --- | ---: | ---: | ---: | ---: | ---: |
| scout / workflow:goal-driver | 10 | 10 | 1.000 | 25.4 | 1.9 |
| evaluator / workflow:metric-alert-triage | 71 | 70 | 0.986 | 33.2 | 0.3 |
| scout / workflow:scout-heartbeat | 98 | 92 | 0.939 | 46.4 | 3.5 |
| may / closed-loop-steward | 147 | 137 | 0.932 | 47.7 | 0.8 |
| may / workflow:orchestrator | 27 | 24 | 0.889 | 34.9 | 2.5 |
| evaluator / workflow:evaluator-aftermath | 492 | 386 | 0.785 | 71.5 | 4.9 |
| may / workflow:may-heartbeat | 88 | 68 | 0.773 | 74.4 | 5.2 |
| evaluator / workflow:project | 101 | 78 | 0.772 | 63.9 | 0.0 |
| dev / workflow:dev-heartbeat | 65 | 11 | 0.169 | 163.5 | 10.4 |

## Non-obvious finding

The duration gate is probably source-biased. It fires on sessions under 90s, but many high-volume workflow sources are designed to be short, narrow, and deterministic:

- `closed-loop-steward` often performs a bounded audit and can legitimately complete in 12–50s with 1–8 ops.
- `workflow:metric-alert-triage` for evaluator averages 33s with near-zero opCount, likely because many triage sessions are templated/routing-heavy.
- `workflow:evaluator-aftermath` has 386 under-90s done sessions in 24h, but those are single-session reviews rather than broad investigative heartbeats.

This means a flat 90s minimum can conflate three distinct cases:

1. **True shallow session**: little context, few tools, no artifact or decision.
2. **Expected fast micro-workflow**: bounded, deterministic, evidence can be compact.
3. **Instrumentation mismatch**: opCount or artifact capture does not represent actual work, especially for workflow-generated review tasks.

The current re-prompt text tells the agent to dig deeper and produce an artifact. That is useful for open-ended heartbeats, but it may be counterproductive for deterministic micro-workflows because it converts efficient bounded work into after-the-fact documentation just to satisfy a time threshold.

## Improvement opportunities

1. **Replace flat duration with source-adjusted gate policy.**
   - Keep strict duration/artifact pressure for open-ended heartbeat sources (`workflow:*heartbeat`) where shallow closure is risky.
   - Use lower or different thresholds for deterministic sources such as `closed-loop-steward`, `workflow:evaluator-aftermath`, and `workflow:metric-alert-triage`.

2. **Add a metric for gate pressure by source.**
   Proposed metric: `gate.duration-trigger-count-24h-by-source` or a dashboard query grouped by `agent/source/gate`.
   - Current logs do not include source, only agent. Joining to `sessions` is possible only indirectly by timestamp/agent; adding source to the gate log would make the metric actionable.

3. **Measure post-gate value, not just gate compliance.**
   A good follow-up metric would ask: after a duration-gate re-prompt, did the session produce a new durable artifact, commit, resolved alert, or changed decision? If not, the gate is mostly creating compliance work.

4. **Dev-specific takeaway.**
   Dev had 8 duration triggers but no anti-shallow triggers in the read logs. Dev's 24h heartbeat average is 163.5s with 10.4 ops, so the 73s trigger is not part of a broad dev shallow pattern. For dev, duration-gate incidents look like occasional low-signal heartbeat closure rather than a systemic anti-shallow problem.

## Recommended next action

Patch the duration-gate logging path to include `source` and `sessionId` if those are available at gate time. Without those fields, we can only infer whether gate pressure is healthy or wasteful from coarse agent-level counts. The smallest safe first step is a code read of the finish/duration gate implementation and a proposal or patch adding source/sessionId to `shared/duration-gate-triggers.log` lines.

## Verification notes

- Metrics table inspection found no metrics owned by `dev`; this itself is a metrics-ownership gap for a metrics engineer role.
- The analysis used read-only DB queries only; no production DB writes were attempted.
- Ambient worktree dirt was present before this artifact and should not be staged with the deliverable.
