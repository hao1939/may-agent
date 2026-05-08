# v2 Spec

**Status**: draft
**Date**: 2026-05-06 (revised 2026-05-08)
**Companion to**: `../architecture.md` (intent), `v2-implementation-notes.md` (history)

## What this document is

`../architecture.md` describes **what v2 should be**. This document describes **how we know v2 is there**, as enumerable, measurable claims.

The doc has three layers, top-down:

```
┌──────────────────────────────────────────────────────────────────┐
│  CAPABILITY                                                       │
│  "Does the system do what it claims to do?"                       │
│  Verified by: prod metrics (capability.*) + scheduled scenarios   │
│  Owner: may                                                        │
└──────────────────────────────────────────────────────────────────┘
                           ▲ depends on
┌──────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE                                                   │
│  "Does the infra give agents the primitives they need?"           │
│  Verified by: prod metrics (infra.*) + invariant tests            │
│  Owner: tech-lead                                                  │
└──────────────────────────────────────────────────────────────────┘
                           ▲ shaped by
┌──────────────────────────────────────────────────────────────────┐
│  STRUCTURAL                                                       │
│  "Is the implementation v2-shaped?"                               │
│  Verified by: static checks + code metrics (v2.*)                 │
│  Owner: arc                                                        │
└──────────────────────────────────────────────────────────────────┘
```

Each layer answers a different question. Each layer's claims are observed by metrics and live tests in the same system registry as everything else. **There is no separate enforcement system** — v2 conformance is an agent-owned work context whose metrics are signals, not decisions.

The diagnostic ladder is top-down: a red capability metric is a *symptom*; the cause is in the infra layer or the structural layer below. Investigate from the top, descend until you find the broken rung.

A note on what this means for the architecture doc: `../architecture.md` describes intent. It is the *design*. This doc is the *contract*. The intent doc is read for understanding; this doc is read for evaluating whether what we built lives up to it.

---

## Reading conventions

Every claim in this doc has the same structure:

- **Claim** — the property in falsifiable form.
- **Why** — what it encodes from the architecture doc or the design principles.
- **Measurement** — the metric ID and what it measures. Sometimes a test, when continuous measurement isn't possible.
- **Target / threshold** — the healthy range and the breach point.
- **Status** — `holds`, `partial`, `violated`, or `untested`.
- **Known gaps** — concrete current violations and their remediation.

Status definitions:
- `holds` — claim is true, and we measure it; current measurement is healthy.
- `partial` — claim is true under conditions, or measured but threshold ambiguous.
- `violated` — claim is currently false; remediation needed.
- `untested` — claim plausibly true, but no measurement exists yet.

---

# Layer 1 — Capability

What the system, as a whole, claims to do for the human. Measured continuously on prod. Owner: `may`.

A capability is a claim of the form: *given X over time period Y, the system produces outcome Z.* Capabilities are end-to-end behavioral properties; they don't care which file does the work, or whether the code is clean. They care whether the work happens.

## C1 — Self-direction

**Claim.** Without external input, agents do meaningful work. In any 24h window with zero human commands, project iterations, decisions, and output continue at a non-trivial rate.

**Why.** "Autonomous" means the system runs itself. If it stalls without humans, the autonomy is theatre.

**Measurement.** `capability.self-directed-iteration-rate-24h` — fraction of sessions in the last 24h whose `source` field starts with `workflow:heartbeat` (autonomous trigger) over total sessions. Computed in `metrics-snapshot.ts`.

**Target / threshold.** Target ≥ 0.80. Threshold < 0.50 = breach.

**Status.** `measured`. Metric registered and computed in `metrics-snapshot.ts` since 2025-05-07.

**Known gaps.**
- Uses `source LIKE 'workflow:heartbeat%'` as proxy for autonomous trigger; a dedicated `trigger` field (see I4) would be more precise.

---

## C2 — Self-correction

**Claim.** When something breaks, the system notices and fixes it. A breached metric eventually recovers, with bounded latency.

**Why.** "Metric-driven" means breaches drive remediation. Breaches that flap unattended falsify the claim.

**Measurement.** `capability.breach-time-to-recovery-p50-h` — for `metric.breach` events that have a corresponding `metric.recovered` event, the median time between them.

**Target / threshold.** Target ≤ 6h (one heartbeat cycle for most agents). Threshold > 24h = breach.

A second metric `capability.unrecovered-breach-count-7d` counts breaches with no recovery in 7 days. Target 0; threshold 2.

**Status.** `partial`. `metric.breach` and `metric.recovered` events flow from the alert lifecycle, but the recovery-latency aggregation metric does not exist yet.

**Known gaps.**
- Add the recovery-latency aggregation metric. Breach → recovered loops are verified at production scale.

---

## C3 — Memory and continuity

**Claim.** Each iteration builds on the previous one. Today's heartbeat references yesterday's journal. Agents don't re-discover the same problem repeatedly.

**Why.** Per `../architecture.md`, `../work-model.md`, and `../design/heartbeat-as-agency.md`: projects are *context*; without continuity they become amnesia.

**Measurement.** `capability.journal-reference-rate` — fraction of heartbeat sessions whose `agent.decision` event references prior journal entries (by date stamp or by content phrase) divided by heartbeat sessions where a referenceable journal exists.

**Target / threshold.** Target ≥ 0.7. Threshold < 0.4 = breach.

**Status.** `partial` — `agent.decision` event exists but emission coverage is low (see S7). Once coverage improves, the rate can be computed by text-matching on decision strings against journal entries.

**Known gaps.**
- Improve `agent.decision` emission coverage (S7). Once that's consistent, add the `journal-reference-rate` metric.

---

## C4 — Coordination

**Claim.** Multi-agent collaboration produces closed conversations. When agent A messages agent B, the thread reaches a closing event (reply, ack, or escalation) within bounded heartbeats.

**Why.** "Multi-agent" is only meaningful if agents actually coordinate. Open-ended message threads with no closure are coordination theatre.

**Measurement.** `capability.message-conversation-close-rate` — fraction of `message.created` events that have a corresponding closing event (reply, ack, escalation, or read-and-noted) within the receiver's next 3 heartbeats.

**Target / threshold.** Target ≥ 0.85. Threshold < 0.6 = breach.

A supporting metric `capability.message-thread-orphan-count` counts messages with no closure after 24h. Target 0; threshold 5.

**Status.** `violated by usage pattern, not by mechanism`. The `message.created` event fires (primitive works) but at low volume — query `events` table for current count. Agents prefer stigmergic coordination via shared file edits (project journals, `agents/shared/projects/*`) over explicit messaging. This is plausibly correct v2 behavior — see `proposals/stigmergic-coordination.md` — but it means the spec's `message-conversation-close-rate` measures a primitive that's not the actual coordination channel.

A historical residue note: the events table contains 371 `agent.notification` events from a deprecated code path. Daily counts trended 120/day (Apr 30) → 4/day (May 6); confirmed not currently emitted from any source in `src/` or `agents/`. These will age out via retention; the test in `test/message-tool.test.ts:49` already asserts no new emissions of this type.

**Known gaps.**
- The capability metric is wrong, not the system. The decision is: (a) drive `message` usage up via prompt/convention changes, or (b) replace the metric with stigmergy-aware measurement (e.g., "fraction of project journal entries that reference another agent's project workspace").
- Suggested resolution: keep `capability.message-conversation-close-rate` as a measurement of the explicit-message channel (it should still close when used), AND add `capability.cross-agent-file-reference-rate` for the stigmergic channel.

---

## C5 — Ownership

**Claim.** Each domain has someone responsible, and the responsible agent is the one who acts. A breach in agent X's domain is handled by X, not by some other agent.

**Why.** "Agents are accountability boundaries — they exist to OWN a domain." If breaches get handled by whichever agent happens to look, ownership is fiction.

**Measurement.** `capability.cross-domain-handling-rate` — fraction of `metric.breach` events whose remediation session was run by an agent *other than* the metric's `owner`.

**Target / threshold.** Target = 0. Threshold > 0.1 = breach.

**Status.** `untested`. Today, breach handling routes via the metric-alert-reactor which forks the owner; cross-domain handling shouldn't happen by design, but is unmeasured.

**Known gaps.**
- Add the join query to `metrics-snapshot.ts` against `metric_breach` events and resulting sessions.

---

## C6 — Adaptation

**Claim.** The system improves over time. Capability metrics themselves trend up over a week (or hold steady at healthy values; declining is the failure mode).

**Why.** A static system isn't autonomous in any deep sense. Stagnation is failure.

**Measurement.** `capability.trend-7d` — for each capability metric, the slope of its 7-day moving average. Aggregated: count of capability metrics with declining 7-day trend.

**Target / threshold.** Target = 0 declining. Threshold > 2 declining = breach.

**Status.** `untested`. Cannot compute until the other capability metrics exist.

---

## C7 — Boundedness

**Claim.** The system doesn't run away. No infinite loops, no cost spirals, no runaway forking, no zombie processes. Pathological states are detected and broken.

**Why.** Autonomous systems that run away cause expensive disasters. Boundedness is what makes autonomy safe.

**Measurement.**
- `capability.cost-per-day-usd` — sum of session cost in last 24h. Target ≤ budgeted; threshold = budget × 1.5.
- `capability.concurrent-session-max-1h` — peak concurrent running sessions in last hour (sampled every 5min). Target ≤ 8; threshold > 15.
- `capability.zombie-session-count` — sessions in `running`/`idle` state for > 30min. Target 0; threshold > 2.
- `capability.fork-loop-incidents-24h` — detected re-fork loops (same agent, same task, more than N forks in window). Target 0; threshold > 0.

**Status.** `partial`. `capability.zombie-session-count` and `capability.concurrent-session-max-1h` are now measured in `metrics-snapshot.ts`. Cost tracking and fork-loop detection remain unimplemented.

**Known gaps.**
- Add cost aggregation metric.
- Add zombie counter.
- Define fork-loop detector (sliding window: same agent + same task hash > 3 forks in 1h).

---

## C8 — Observability

**Claim.** A human can understand what the system did and why. For any session, the chain *trigger → context-read → decision → action → outcome* is reconstructable from the audit trail.

**Why.** Without observability, autonomous systems become magic boxes. Magic boxes can't be debugged or trusted.

**Measurement.** `capability.session-trace-completeness` — fraction of sessions in last 24h for which all five chain elements can be reconstructed:
1. `trigger` field non-null on session row,
2. context-read event(s) recorded (heartbeat workflow emits these),
3. `agent.decision` event present (for heartbeat sessions),
4. `tool.executed` events present,
5. `session.end` with outcome.

**Target / threshold.** Target ≥ 0.95. Threshold < 0.8 = breach.

**Status.** `partial` — `agent.decision` exists but emission coverage is low (S7). Sessions are partially traceable.

**Known gaps.**
- Improve `agent.decision` emission coverage (S7).
- Context-read tracking needs heartbeat workflow change to emit a `context.read` event listing what was loaded.

---

## C9 — Resilience

**Claim.** The system survives perturbations. Process restart, DB lock, model rate-limit, disk-full — none of these kill the system. Time-to-recovery is bounded.

**Why.** Production systems must survive their environment.

**Measurement.** This is one of the few capabilities that can't be measured continuously without intentionally perturbing the system.

Two-part:
- *Continuous*: `capability.process-uptime-h` (hours since earliest currently-running session, computed in `metrics-snapshot.ts`) and `capability.unexpected-restart-count-7d` (restarts not initiated by humans). Target: low restart count, growing uptime.
- *Scenario*: scheduled chaos test in `agents/gym/scenarios/crash-recovery/` that kills the may-agent process at random intervals and measures time to first successful heartbeat. Result is written as a metric: `capability.crash-recovery-time-last-test-s`. The metric has a freshness threshold — a stale result (> 7 days) is itself a breach.

**Target / threshold.** Restart-time < 60s. Unexpected restarts < 5 / 7d. Scenario freshness < 7d.

**Status.** `partial`. `capability.process-uptime-h` is now measured in `metrics-snapshot.ts`. Restart detection and chaos scenario don't exist.

**Known gaps.**
- Add `crash-recovery` gym scenario.
- Wire scenario result → metric.

---

## C10 — Honesty

**Claim.** The system tells the truth about itself. State fields reflect reality. If a project says `active`, an agent is iterating. If a metric says `healthy`, it's actually being measured. If a session says `done`, work was done.

**Why.** Without honesty, the signals agents rely on are unreliable, and the diagnostic ladder breaks. This is the meta-capability that protects all the others.

**Measurement.** `capability.status-reality-mismatch-count` — count of detected inconsistencies:
- Projects with `status=active` but no journal entry in last 7 days.
- Metrics with `status=ok` but no snapshot in last 2 measure cycles.
- Sessions with `status=done` but no `session.end` event with outcome.
- Agents listed as "loaded" but no heartbeat in last 4h.

**Target / threshold.** Target = 0. Threshold > 3 = breach.

**Status.** `untested`. The cross-checks aren't currently run; KE-726 documents that "all-green ≠ healthy" is a known structural blind spot.

**Known gaps.**
- Add the cross-check query to `metrics-snapshot.ts`.
- This is the **most important capability metric to land first** because it protects the integrity of every other metric.

---

# Layer 2 — Infrastructure

What the infra promises agents. Each primitive declares interface, preconditions, postconditions, invariants, failure modes. Verified continuously where possible. Owner: `tech-lead`.

The four foundational primitives in this section are the dependencies *every* capability depends on. If these don't hold, no capability metric can be trusted.

## I1 — Event bus

The pub/sub backbone. Every system change passes through here.

**Interface.**
- `bus.emit(event: AgentEvent): void` — synchronous; runs all subscribers before returning.
- `bus.subscribe(handler, opts?: { priority: "first" | "normal" }): unsubscribe`

Source of truth: `src/app/event-bus.ts`.

**Preconditions of `emit`.**
- `event.type` is a known type (in `AgentEvent` union).
- Event payload conforms to the type's schema.

**Postconditions of `emit` on success.**
- All `first`-priority subscribers complete before any `normal`-priority subscriber starts.
- Every subscriber registered at the time of emit observes the event exactly once.
- Subscriber exceptions are caught and logged; they do not propagate to the caller of `emit`.
- The DB writer (a first-priority subscriber) attempts to persist the event before normal subscribers run.

**Invariants.**
- Subscribers added after `emit()` returns do not retroactively receive past events.
- The bus is a single in-process instance; cross-process delivery is via the Unix socket subscriber, not the bus itself.
- Emit is synchronous and serial: `emit()` does not return until all subscribers have run.

**Failure modes.**
- *Subscriber throws*: error logged; other subscribers continue. Documented behavior, not a bug.
- *DB persistence fails (in DbWriter)*: error swallowed (try/catch in `db-writer.ts`); normal subscribers still run. **This is degraded mode** — see I2 below.
- *Subscriber blocks*: synchronous bus means a slow subscriber blocks the entire emit chain, including the originating tool call. Today there's no timeout. This is a real risk.

**Measurement.**
- `infra.bus.subscriber-error-rate-1h` — fraction of subscriber invocations in last hour that threw. Target near 0; threshold 0.05.
- `infra.bus.emit-latency-p99-ms` — p99 wall-clock of `emit()` calls. Target < 100ms; threshold > 1000ms (a slow subscriber is dragging the bus).
- `infra.bus.dispatch-without-persist-count` — events observed by a normal subscriber within 1s for which no `events` row exists. Target 0; threshold > 0 (any drift is a violation).

**Status.** `partial`. Structural invariants hold (verified by reading the source). Metrics don't exist yet.

**Known gaps.**
- All three metrics need to be added.
- Subscriber latency tracking requires wrapping each subscriber call with timing — small change to `event-bus.ts`.
- The "no timeout on subscribers" question: should slow subscribers be killed/skipped after N ms? Open. Today no.

---

## I2 — Persistence

The events table is the durable record of everything that happened. Other tables (sessions, metrics, messages) are projections.

**Interface.** Implicit via `DbWriter` (subscriber to bus, first-priority) and the typed-row writers (`upsertSession`, `updateSessionDb`, message inserts).

Source of truth: `src/lib/db-writer.ts`, `src/lib/persistence.ts`, `src/lib/requests.ts`.

**Preconditions.** SQLite database open and writable.

**Postconditions.**
- For every event emitted on the bus with a dot-form type (e.g., `session.start`, `message.created`), a row exists in `events` after `bus.emit()` returns — provided DB persistence didn't fail.
- Typed-row writes (sessions, messages) are atomic relative to the corresponding event row: either both succeed or both are absent. **Today this isn't enforced** (the two writes are sequential without a transaction); see gap.
- `events` rows are append-only — never updated, never deleted (except by retention pruning, separate cycle).

**Invariants.**
- Single SQLite connection per process (enforced by `getDb` returning a singleton).
- WAL mode enabled.
- Schema is versioned; migrations are idempotent.

**Failure modes.**
- *DB locked*: write retry happens at SQLite level (busy-timeout); if it ultimately fails, the error is logged and swallowed in DbWriter. **The event is lost from the durable record** but normal subscribers still ran. **This is the most serious infra failure mode.**
- *Disk full*: same as locked; swallowed.
- *Schema mismatch*: failure at startup, not at runtime.

**Measurement.**
- `infra.persist.write-failure-rate-1h` — fraction of `DbWriter.handler` invocations that hit the catch block. Target 0; threshold > 0.001.
- `infra.persist.event-row-coverage` — for sessions and messages, fraction of typed-table rows that have a corresponding `events` row. Target 1.0; threshold < 0.99.
- `infra.persist.wal-size-mb` — current WAL file size. Target < 100MB; threshold > 1GB (indicates checkpoint problems).

**Status.** `partial`. Durability is best-effort, not guaranteed. The "swallow and continue" pattern is documented in code as intentional but is the largest risk to the architecture's claims.

**Known gaps.**
- DbWriter swallows persistence failures silently. Should emit `infra.persist-failed` sentinel event so failures are observable. Without it, missing rows are invisible.
- No transaction around (typed-row + event-row) writes. They can diverge under failure. Either wrap in transaction or accept divergence and document it.
- The metrics above don't exist.

---

## I3 — Messages

Async, persisted, queued for next-heartbeat (default). Single inter-agent communication primitive.

**Interface.**
- Tool: `message({ to, content, intent?, artifact?, priority? })` — agent-callable.
- Event: `message.created` — emitted by tool, persisted by DbWriter, included in receiver's prompt.

Source of truth: `src/lib/tools/message-tool.ts`.

**Preconditions of tool call.**
- `to` and `content` are non-empty strings.
- `to` is in the sender's `allowedTargets` (if defined).
- `artifact` (if provided) exists and is within project root.

**Postconditions on success.**
- A `message.created` event is emitted with all parameters.
- The event row is persisted (subject to I2 caveats).
- Message body is composed with intent/priority/artifact prefixes for receiver consumption.
- For `priority=P0`, the receiver's heartbeat is triggered immediately. Returns `{triggered: true, delivery: "immediate (P0)"}`.
- For `priority=P1, P2, P3` (default P2), no immediate trigger. Returns `{triggered: false, delivery: "queued for next heartbeat"}`.

**Invariants.**
- The tool's return value cannot contain the receiver's reply. Replies arrive only as new `message.created` events targeting the original sender.
- Sender's session never blocks on receiver's processing.
- For non-P0 messages, receiver's first session start in response is at or after receiver's next scheduled heartbeat tick.
- Messages addressed to unknown agents persist (in events table) but are not silently dropped; the event row records them and they age out via retention.

**Failure modes.**
- *Receiver not loaded*: message persists; future load picks it up via prompt assembly reading unread events.
- *Receiver never heartbeats*: message ages; surfaced via `infra.messages.unread-age-p95-h`.
- *Receiver rejects/can't process*: not a v2-distinguished failure today; handled as a normal session outcome.

**Measurement.**
- `infra.messages.delivery-latency-p50-min` — for non-P0 messages, median minutes from `message.created` to first heartbeat session of receiver. Target ≈ heartbeat interval; threshold > 2× heartbeat interval.
- `infra.messages.unread-age-p95-h` — 95th-percentile age of pending messages. Target < 6h; threshold > 24h.
- `infra.messages.dropped-count-24h` — messages where the receiver never picks up after 7d. Target 0; threshold > 5.
- `infra.messages.p0-immediate-trigger-rate` — fraction of P0 messages that triggered immediately. Target 1.0; threshold < 0.95.

**Status.** `partial`. Tool behavior is correct per code; metrics don't exist; "pickup" detection requires defining what it means (is "pickup" = appearing in a heartbeat prompt, or = the receiver's decision referencing it?).

**Known gaps.**
- Add the four metrics.
- Define "pickup" precisely. Suggest: a message is "picked up" when the receiver's next heartbeat prompt includes it AND the resulting session reads beyond it (i.e., not just rendered, but observed). The first half is easy; the second is harder. Pragmatic v1: pickup = rendered in prompt.

---

## I4 — Sessions / runAgent

The execution lifecycle. A session is an LLM-loop run with tools, persistence, and a defined outcome.

**Interface.**
- `manager.run(agent, task, opts)` — start a session.
- Events: `session.start`, `session.end`, `tool.executed` (intermediate).

Source of truth: `src/lib/manager.ts` (today), wrapping `pi-coding-agent`.

**Preconditions.**
- `agent` is a known, loaded agent.
- `task` is a non-empty string.
- `opts.trigger` ∈ {`heartbeat`, `metric.breach`, `message`, `order`, `manual`} — see S1.

**Postconditions.**
- A `session.start` event is emitted with `sessionId`, `agent`, `task`, `trigger`, `parentSessionId` (if any).
- Exactly one `session.end` event is emitted, with one of the documented outcomes.
- Session transcript is persisted to `.state/sessions/<id>/session.jsonl` (pi-coding-agent's SessionManager).
- Tool calls are scoped to the agent's workspace.

**Invariants.**
- Every session has a unique `sessionId`.
- A session that started has exactly one `session.end` event (eventually). Sessions in `running` state for > N minutes are zombies (see C7).
- `sessionId` flows through all events emitted during the session (carried in payload).
- Sessions can be resumed via pi-coding-agent's `continueRecent` after process restart.

**Failure modes.**
- *Model API failure*: retried per `runAgentWithRetry`; eventually emits `session.end` with `status=error` if exhausted.
- *Tool guard violation*: the offending tool call returns an error to the model; session continues; no `session.end` impact.
- *Process killed mid-session*: session is left in `running` state; on restart, zombie cleanup either resumes (continueRecent) or marks as `interrupted`.
- *Agent never calls finish*: session ends via turn-budget exhaustion or timeout; emits `session.end` with `status=interrupted`.

**Measurement.**
- `infra.sessions.start-end-balance-1h` — count of `session.start` minus count of `session.end` in last hour. Target 0–4 (small positive = currently running); threshold > 10 = zombie buildup.
- `infra.sessions.trigger-field-coverage` — fraction of `session.start` events with non-null `trigger`. Target 1.0; threshold < 0.95.
- `infra.sessions.resume-success-rate` — fraction of sessions interrupted by process death that successfully resumed on restart. Target ≥ 0.9; threshold < 0.5.
- `infra.sessions.tool-sandbox-violations-24h` — count of tool calls that attempted out-of-scope writes. Target 0; threshold > 0.

**Status.** `partial`. Session lifecycle works; trigger field is inconsistently populated (this is a known gap blocking C1, C8); resume is implemented but unmeasured.

**Known gaps.**
- Audit `manager.run` callers; ensure `trigger` is always set. (Same task as the webui needs.)
- Add the four metrics.
- Resume-success measurement requires correlating restart events with subsequent session continuation; needs a marker.

---

# Layer 3 — Structural

How the implementation is shaped. Cheap, fast checks. These are *necessary conditions* for the upper layers — they don't replace them.

When a structural property is violated, capabilities don't necessarily fail today. But the system has lost a guarantee that protected it from future failure. Structural drift is a leading indicator.

## S1 — Single agent-start primitive

**Claim.** Every agent session starts via `manager.run()` (or a thin equivalent), and every call site is in: a bus subscriber, a workflow runner, a CLI/socket entrypoint, or a test. No agent forks another agent from inside its own session via direct call.

**Why.** v2's defining shape is `event → runAgent() → session.end`. Hidden start paths break the event-driven property.

**Measurement.** `v2.runagent-callsite-conformance` — boolean: do all `manager.run` / `runAgent` call sites match the allowlist in `test/v2-conformance/p1-allowlist.json`?

**Status.** `partial`. Today: ~6 known call sites. Known suspect: `manager-agents-tool.ts:304` allows agent-from-tool fork; this is a v1 pattern that survived.

**Known gaps.**
- Define the allowlist file.
- Decide on `manager-agents-tool.ts` fork: remove (replace with `message`) or document as legitimate exception.

---

## S2 — Persist-before-dispatch

**Claim.** First-priority subscribers (persistence) complete before normal-priority subscribers begin. No event is dispatched to a normal subscriber without persistence having been attempted.

**Why.** Recovery depends on the events table being the source of truth.

**Measurement.** Verified by source inspection of `EventBus.emit` (lines ~163–180 of `event-bus.ts`). Live signal: `infra.bus.dispatch-without-persist-count` (see I1).

**Status.** `holds` structurally. Live metric not yet present.

---

## S3 — Single message primitive

**Claim.** The agent-callable inter-agent communication tool set is exactly `{message}`. `notify`, `send`, `forkAgent`, etc. are not exposed to agents.

**Why.** Tool surface is the agent's contract. Multiple ways to do the same thing breed v1 patterns.

**Measurement.** `v2.tool-surface-conformance` — boolean: does the set of inter-agent tools registered match `["message"]` exactly?

**Status.** `holds`. notify/send removed in cleanup A.

---

## S4 — Message asynchrony (structural)

**Claim.** The `message` tool's return type does not include the receiver's reply. The tool returns immediately after emitting the event.

**Why.** Synchronous inter-agent calls break the async-via-heartbeat property.

**Measurement.** Source inspection of `message-tool.ts` execute() body. Live signal: `infra.messages.delivery-latency-p50-min` ≥ heartbeat interval (see I3).

**Status.** `holds`.

---

## S5 — Convention over configuration

**Claim.** A new agent runs with minimal scaffolding: `AGENTS.md`, `context.md`, an `agent.json` with only `name` and `model`, a `cron.json` with only the heartbeat interval. No custom handlers, workflows, or tool overrides required.

**Why.** Core principle P9. Per-agent customization should be opt-in, not the norm.

**Measurement.** `v2.agent-config-bytes-p50` — median size of `agent.json` across loaded agents. Target stable or decreasing; threshold > 500B (arbitrary; tune after baseline).

**Status.** `untested`. No baseline measurement.

---

## S6 — Pi-coding-agent owns the runtime

**Claim.** Our agent runtime code (the layer between the bus and pi-coding-agent) is bounded. The LLM loop, retry, compaction, tool execution, and durable session persistence should live in pi-coding-agent or narrow wrappers, not sprawl through the app layer.

**Why.** The original v2 target was a thin wrapper around pi-coding-agent. Beyond a thin wrapper we are reimplementing the runtime — the v1 pattern.

**Measurement.** `v2.runtime-glue-loc` — line count of `src/lib/manager.ts` plus adjacent runtime glue files that own session/tool lifecycle behavior. Track both:
- `v2.manager-loc` — `src/lib/manager.ts` only.
- `v2.runtime-glue-loc` — `src/lib/manager.ts`, `src/lib/manager-utils.ts`, `src/lib/manager-receipts.ts`, and `src/lib/manager-agents-tool.ts`.

**Target / threshold.** For `v2.manager-loc`: target ≤ 1,000 LOC, threshold > 1,500 LOC. For `v2.runtime-glue-loc`: target ≤ 1,500 LOC, threshold > 2,000 LOC. The earlier 500-LOC target was aspirational and should be treated as a stretch goal, not the breach threshold. Current spot-check on 2026-05-07: `manager.ts` = 1,119 LOC; tracked runtime glue = 1,891 LOC.

**Status.** `partial`. The v2 rewrite removed the previous 2,346-LOC manager, but current glue is still above target and not yet measured continuously.

**Known gaps.**
- Add computed `v2.manager-loc` and `v2.runtime-glue-loc` metrics so this claim stops relying on hand counts.
- Decide which adjacent files count as runtime glue and put that allowlist in code.
- Continue deleting compatibility shims once tests cover the pi-coding-agent boundary.

---

## S7 — `agent.decision` event exists and is emitted

**Claim.** Every heartbeat session emits exactly one `agent.decision` event with `{agent, sessionId, decision: string}` before the action phase.

**Why.** Per `../design/heartbeat-as-agency.md`: agency is invisible without a structured decision. Required for C3 (memory), C8 (observability), and the new web UI.

**Measurement.** `v2.heartbeat-decision-rate` — fraction of `trigger=heartbeat` sessions with at least one `agent.decision` event. Target 1.0; threshold < 0.95.

**Status.** `partial`. The `agent.decision` event type exists in the `AgentEvent` union and is emitted in production (observed in events table), but emission rate is low relative to heartbeat volume. The heartbeat workflow does not yet systematically emit it for every heartbeat.

**Known gaps.**
- Increase emission coverage: update heartbeat workflow to emit `agent.decision` consistently after the read phase, before the act phase.
- Idle heartbeats should still emit a decision: `{decision: "idle: no work this cycle"}` — every heartbeat is deliberative.

---

## S8 — `metric.priority` exists

**Claim.** The `metrics` table has a `priority` column with values P0/P1/P2/P3, and `metric-alert-reactor` only forks directly on P0 breaches. Lower-priority breaches are visible to the owner via prompt context but don't fork immediately.

**Why.** Per `../design/heartbeat-as-agency.md`: forking on every breach makes agents reactive; deferring to heartbeat makes them deliberative. P0 is the safety valve.

**Measurement.** `v2.fork-on-breach-rate` — fraction of `metric.breach` events that triggered a direct fork. Target = P0-priority-rate (varies by registry); threshold > P0-rate × 1.5.

**Status.** `partial`. The schema declares `metrics.priority`, built-in metric definitions maintain it, legacy/null priorities default to `P2`, and `metric-alert-reactor` gates direct forks on `P0`. The live conformance metric for fork behavior does not exist yet.

**Known gaps.**
- Add `v2.fork-on-breach-rate`.
- Audit other `metric.breach` subscribers so the P0-only direct-fork rule is system-wide, not only reactor-local.

---

# Maintenance

## Spec drift is itself a metric

`v2.spec-coverage-rate` — fraction of claims in this doc that have a working measurement (metric or live test). Target 1.0; threshold < 0.8.

A claim that's added without a measurement raises a flag. A measurement that breaks (stops emitting) raises a flag. The spec stays honest because the system observes its own coverage.

## Adding or removing claims

When a claim is added: this doc gets a new entry, AND the corresponding metric is added to `metrics-snapshot.ts`, AND the change is in one PR. No "I'll add the metric later."

When a claim is removed: this doc loses the entry, AND the metric is deleted from the registry, AND the change is in one PR. No orphan metrics.

When a claim's status changes (`untested` → `holds`, etc.): the entry is updated in the same PR that adds the measurement.

## Ownership

| Layer | Owner | Domain |
|---|---|---|
| Capability (C1–C10) | `may` | Cross-cutting outcomes |
| Infrastructure (I1–I4) | `tech-lead` | Platform primitives |
| Structural (S1–S8) | `arc` | Code shape and architecture |

Each owner's heartbeat sees breaches in their layer's metrics first. If a capability metric is red, `may` investigates and may delegate down the ladder (`may → tech-lead → arc`). The diagnostic flow follows ownership.

---

# Status summary

This document is the contract, not the live status page. Hand-maintained status tables decay quickly and have already misled review: S6, C2, and S8 all drifted between code reality and prose.

Until the system computes conformance directly, current status is tracked in the project `agents/shared/projects/v2-conformance-and-visibility/`. The target state is:
- each claim in this document has a metric or invariant test,
- `v2.spec-coverage-rate` reports how much of the contract is actually measured,
- a web UI conformance view renders the status from live metrics instead of this markdown file.

Current high-confidence gaps as of 2026-05-07:
- The recovery-latency aggregation metric does not exist yet.
- `agent.decision` does not exist, so heartbeat agency and session trace completeness are not visible.
- `context.read` does not exist, so the read phase of a heartbeat is not auditable.
- `v2.fork-on-breach-rate` does not exist yet, and non-reactor `metric.breach` subscribers still need audit.
- Runtime glue is smaller than the pre-v2 manager but still above target.

# Implementation plan

The ongoing tracking project is `agents/shared/projects/v2-conformance-and-visibility/`. This section lists the current implementation slices; durable status belongs in the project journal until it is computed by metrics.

## Project 1 — Fix metric recovery emission (highest leverage, smallest)

Initial plumbing landed: `metrics-snapshot.ts` emits `metric.recovered` when a metric recovers and resolves its open alert.

Remaining: verify a natural breach → recovered loop in the events table, then add the latency aggregation metric.

## Project 2 — Land C10 honesty cross-checks

C10 protects every other measurement. The cross-checks are SQL queries against existing tables — no schema changes:
- Projects with `status=active` but no journal entry in last 7 days.
- Metrics with stale snapshots.
- Sessions with `status=done` but no `session.end` event.
- Agents listed as loaded but no recent heartbeat.

Initial cross-checks landed in `metrics-snapshot.ts`. Once they run in production, we'll find out what *else* the system is lying about beyond C2 — and what this hand-maintained prose is lying about right now.

## Project 3 — Heartbeat agency event (S7)

Land `agent.decision`. Add to `AgentEvent` union. Update heartbeat workflow to emit it after the read phase, before the act phase. Estimated **1 day**.

Unblocks C3 (memory), C8 (observability), and the proposed web UI's "recent decisions" front-page panel.

## Project 4 — Metric priority and fork rule (S8)

Initial priority semantics landed: legacy DBs get `metrics.priority`, missing priorities default to `P2`, `ALL_METRICS` declares priority, and `metric-alert-reactor` gates direct forks on `priority=P0`; lower priorities inform next heartbeat via prompt context.

Remaining: add `v2.fork-on-breach-rate` and audit other `metric.breach` subscribers.

Brings metric breaches into parity with messages, where P0 immediate-trigger already works.

## Project 5 — Spec instrumentation: make this table computed

The long-running fix for the "this table decays" problem at the top of the status summary. Each spec claim becomes a registered metric (`spec.c1`, `spec.c2`, … `spec.s8`). The status table is replaced by a `/spec` page in the webui that renders from the metric registry. Markdown becomes the contract; webui becomes the live status; they can't drift because the status is computed.

Also add the remaining capability and infra metrics this spec already names but doesn't measure:
- `capability.self-directed-iteration-rate-24h` (C1)
- `capability.cross-domain-handling-rate` (C5)
- `capability.cost-per-day-usd`, `capability.zombie-session-count`, `capability.fork-loop-incidents-24h` (C7)
- `infra.bus.subscriber-error-rate-1h`, `infra.bus.emit-latency-p99-ms`, `infra.bus.dispatch-without-persist-count` (I1)
- `infra.persist.write-failure-rate-1h`, `infra.persist.event-row-coverage` (I2) — also emit `infra.persist-failed` sentinel from `db-writer.ts` catch blocks so I2 failures become observable
- `infra.messages.delivery-latency-p50-min`, `infra.messages.unread-age-p95-h`, `infra.messages.dropped-count-24h`, `infra.messages.p0-immediate-trigger-rate` (I3)
- `infra.sessions.start-end-balance-1h`, `infra.sessions.trigger-field-coverage`, `infra.sessions.zombie-count` (I4)

This is a tracking effort, not a one-shot patch. Smallest demonstration first (`v2.manager-loc` and `v2.runtime-glue-loc`) before doing all 24 claims.

## Project 6 — Rethink C4 (coordination)

The `message-conversation-close-rate` metric measures a path agents don't take (low message volume; see `proposals/stigmergic-coordination.md`). Either:
- Drive message volume up via prompt/convention changes (`arc` writes a proposal).
- Add `capability.cross-agent-file-reference-rate` to measure the stigmergic channel agents actually use.
- Both (recommended).

File as a project for `arc` to investigate. Estimated **one heartbeat cycle of analysis**, then implementation.

## Order

1, 2, 3, 4 land in any order; they're small and independent. **Land 1 first** (smallest, most visible). 5 starts with one computed structural metric and grows claim by claim. 6 is exploratory; it can run in parallel.

---

# Out of scope

- Performance benchmarks. v2 doesn't promise specific latency or throughput; performance is for observation, not spec.
- Aesthetic code review. "This code is ugly" isn't a measurable claim.
- The full web UI implementation. This contract defines what the UI should make visible, but UI build-out is tracked by `agents/shared/projects/v2-conformance-and-visibility/`.
- Agent decision quality. The spec checks that decisions are *emitted* (S7); it doesn't judge whether they're *good*. Quality is for evaluator/judge agents, not the conformance system.

---

# Open questions

1. **The 500-LOC ceiling for S6.** Is 500 right? The architecture doc said 50; that's pi-coding-agent doing everything. 500 is "thin wrapper with guards and event bridging." 2,500 is "we're reimplementing." Pick a number we'll defend.

2. **Synchronous vs. async bus.** The bus is sync today: a slow subscriber blocks emit. Should it stay sync (simpler, predictable ordering) or move to async (better isolation, harder to reason about)? Open. Default: stay sync, add timeout instrumentation.

3. **DbWriter swallowing failures.** Today persistence failures are caught and logged; the event proceeds. Should persistence be enforced (failure aborts emit)? Tradeoff: enforcement is correct but trades availability for consistency. Current behavior is the inverse. Document the choice explicitly either way.

4. **What does "message picked up" mean?** For C4 / I3 metrics. Pragmatic v1: rendered in receiver's prompt. Stricter v2: receiver's decision references the message. First is easy; second requires `agent.decision` to land first.

5. **Capability ownership.** Suggested `may` owns capability metrics. But `may` is the orchestrator and already heavily loaded. Should there be a dedicated `governance` agent for spec conformance? Defer; revisit if `may` becomes overloaded.

6. **Scenario freshness for resilience.** C9's chaos-test result has a 7-day freshness threshold. Who runs the scenario? Suggest: cron job that fires it weekly, writes the result, the result-as-metric flows through the same registry. No special runner.
