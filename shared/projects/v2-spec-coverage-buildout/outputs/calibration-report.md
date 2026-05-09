# v2-spec Coverage Calibration Report

**Date**: 2026-05-09  
**Metric**: `v2.spec-coverage-rate` — currently 0.2727 (6/22), status: retired  
**Baseline at project start**: 0.1364 (3/22)

## Methodology

Each of the 22 claims (C1–C10, I1–I4, S1–S8) is evaluated against:
1. Does a metric exist in the DB with `status=active`?
2. Is it computed by `metrics-snapshot.ts` or a `source_query`/`source_command`?
3. Does the spec's stated status match reality?

## Claim-by-Claim Assessment

| # | Claim | Spec Status | Metric ID(s) | DB Status | Measured? | Spec Accurate? |
|---|-------|-------------|---------------|-----------|-----------|----------------|
| C1 | Self-direction | `measured` | `capability.self-directed-iteration-rate-24h` | **retired** | ❌ | ❌ Spec says measured, metric is retired |
| C2 | Self-correction | `partial` | `capability.breach-time-to-recovery-p50-h` | missing | ❌ | ✅ |
| C3 | Memory/continuity | `partial` | `capability.journal-reference-rate` | missing | ❌ | ✅ |
| C4 | Coordination | `violated` | `capability.message-conversation-close-rate` | missing | ❌ | ✅ |
| C5 | Ownership | `untested` | `capability.cross-domain-handling-rate` | missing | ❌ | ✅ |
| C6 | Adaptation | `untested` | `capability.trend-7d` | missing | ❌ | ✅ |
| C7 | Boundedness | `partial` | `capability.zombie-session-count` | **active, 0** | ✅ | ✅ |
| C7 | Boundedness | `partial` | `capability.concurrent-session-max-1h` | **retired** | ❌ | ❌ Spec says measured, metric is retired |
| C7 | Boundedness | `partial` | `capability.cost-per-day-usd` | missing | ❌ | ✅ |
| C7 | Boundedness | `partial` | `capability.fork-loop-incidents-24h` | missing | ❌ | ✅ |
| C8 | Observability | `partial` | `capability.session-trace-completeness` | **retired** | ❌ | ❌ Spec implies partial measurement, metric is retired |
| C9 | Resilience | `partial` | `capability.process-uptime-h` | **retired** | ❌ | ❌ Spec says measured, metric is retired |
| C10 | Honesty | `untested` | `capability.status-reality-mismatch-count` | **active, 0** | ✅ | ❌ Spec says untested, but metric is active and measured |
| I1 | Event bus | `partial` | `infra.bus.*` (3 metrics) | missing | ❌ | ✅ |
| I2 | Persistence | `partial` | `infra.persist.*` (3 metrics) | missing | ❌ | ✅ |
| I3 | Messages | `partial` | `infra.messages.*` (4 metrics) | missing | ❌ | ✅ |
| I4 | Sessions | `partial` | `infra.sessions.*` (4 metrics) | missing | ❌ | ✅ |
| S1 | Single start primitive | `partial` | `v2.runagent-callsite-conformance` | missing | ❌ | ✅ |
| S2 | Persist-before-dispatch | `holds` | structural (no live metric) | n/a | ⚠️ | ✅ |
| S3 | Single message primitive | `holds` | `v2.tool-surface-conformance` | missing | ⚠️ | ✅ |
| S4 | Message asynchrony | `holds` | structural | n/a | ⚠️ | ✅ |
| S5 | Convention over config | `untested` | `v2.agent-config-bytes-p50` | missing | ❌ | ✅ |
| S6 | Pi-coding-agent runtime | `partial` | `v2.manager-loc`, `v2.runtime-glue-loc` | **retired** | ❌ | ❌ Spec says partial, metrics are retired |
| S7 | agent.decision event | `partial` | `v2.heartbeat-decision-rate` | missing | ❌ | ✅ |
| S8 | metric.priority | `partial` | `v2.fork-on-breach-rate` | missing | ❌ | ✅ |

## Summary

### Currently Measured (active metrics exist and are computed)
1. **C7** — `capability.zombie-session-count` ✅
2. **C10** — `capability.status-reality-mismatch-count` ✅

### Structural Holds (no live metric needed — verified by code inspection)
3. **S2** — Persist-before-dispatch ⚠️ holds by design
4. **S3** — Single message primitive ⚠️ holds by design
5. **S4** — Message asynchrony ⚠️ holds by design

### Spec-Reality Mismatches (spec prose ≠ actual state)
| Claim | Issue |
|-------|-------|
| C1 | Spec says `measured`, but `capability.self-directed-iteration-rate-24h` is **retired** |
| C7 (concurrent) | Spec says measured in metrics-snapshot.ts, but `capability.concurrent-session-max-1h` is **retired** |
| C8 | `capability.session-trace-completeness` is **retired** |
| C9 | `capability.process-uptime-h` is **retired** |
| C10 | Spec says `untested`, but metric is **active and working** |
| S6 | `v2.manager-loc` and `v2.runtime-glue-loc` are both **retired** |

### Coverage Calculation

Using the current `v2.spec-coverage-rate` semantics (claims with a working measurement):
- **Measured**: C7 (zombie), C10 = 2 claims
- **Structural holds** (S2, S3, S4): 3 claims — these hold by code structure but lack live metrics
- **Everything else**: 17 claims with no active measurement

If structural holds count: **5/22 = 0.227**  
If only active metrics count: **2/22 = 0.091**  
DB reports 0.2727 (6/22) — slightly higher, possibly counting retired metrics that still have values.

### Key Finding

The metric is **retired** (`status=retired`), so it's not actively monitored. Several metrics referenced in the spec have been retired since they were first added, meaning the spec's prose status is stale in 6 places.

## Recommendations

### Phase 1 — Fix spec accuracy (no code changes needed, but spec is not editable by this project)
The spec has 6 claims whose stated status doesn't match reality. These should be calibrated.

### Phase 2 — Cheapest new measurements to raise coverage
Ranked by implementation effort:

1. **S5** (`v2.agent-config-bytes-p50`) — trivial: `stat` each `agent.json`, compute median. ~10 lines in metrics-snapshot.
2. **S6** (`v2.manager-loc`, `v2.runtime-glue-loc`) — trivial: `wc -l` on known files. Already was measured, just retired. Un-retire or re-add.
3. **S1** (`v2.runagent-callsite-conformance`) — medium: grep for callsites, compare to allowlist.
4. **C5** (`capability.cross-domain-handling-rate`) — medium: join breach events with remediation sessions.
5. **S7** (`v2.heartbeat-decision-rate`) — medium: count decision events vs heartbeat sessions.
6. **S8** (`v2.fork-on-breach-rate`) — medium: count forks triggered by breach events.

### Phase 3 — Requires new infrastructure
- C2 (recovery latency aggregation)
- C3 (journal reference detection)
- C4 (coordination rethink)
- C6 (trend computation — depends on other metrics existing)
- C8 (trace completeness — depends on S7)
- C9 (chaos testing)
- I1–I4 (event bus/persistence/message/session instrumentation)
