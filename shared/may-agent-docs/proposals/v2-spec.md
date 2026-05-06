# v2 Conformance Spec

**Status**: draft
**Date**: 2026-05-06
**Companion to**: `proposals/v2-architecture.md` (intent), `proposals/v2-implementation-notes.md` (history)

## What this document is

`v2-architecture.md` describes **what v2 should be**. This document describes **how we know v2 is implemented** — as enumerable, testable properties.

The architecture doc is design intent; this doc is the contract. A change is v2-conformant if and only if every property below holds after the change.

The document is structured so that for each property:

- **Statement** — precise, falsifiable.
- **Why** — what v2 claim does this property encode.
- **Verification** — a static check, runtime test, or live metric that can decide pass/fail.
- **Status** — `holds`, `partial`, `violated`, or `untested`.
- **Known gaps** — concrete violations and their remediation plan, if any.

The property list is the load-bearing artifact. If a property is missing here, we are not enforcing it. If a property is here but unverified, we are claiming it on faith.

---

## Property list

### P1 — One agent-start primitive

**Statement.** Every agent session is started by a call to a single primitive (`manager.run` / `runAgent`), and every call to that primitive is reachable from a bus event handler, a workflow step, or an explicit human command (CLI/socket).

**Why.** v2's defining shape is `event → runAgent() → session.end`. If agents start via other paths — direct imports, hidden RPCs, recursive forks from inside another session — the event-driven property collapses.

**Verification.**
- *Static (Tier 1):* enumerate `runAgent` / `manager.run` call sites; every site must be in one of: `bus.on(...)` subscriber, workflow step executor, CLI/socket entrypoint, or test.
- *Runtime (Tier 2):* `test/v2-conformance/p1-runagent-callsites.test.ts` — AST-walks `src/`, lists callers, fails if any caller is outside the allowlist.

**Status.** `partial`. Today there are ~6 callers (manager.ts internal, may.ts heartbeat trigger, session-digest.ts evaluator fork, workflow-tool.ts, manager-agents-tool.ts fork-from-tool). Some are legitimate (the workflow runner); some are residue (fork-from-tool predates the message primitive). Allowlist needs to be written and reviewed.

**Known gaps.**
- `manager-agents-tool.ts:304` allows an agent to fork another agent from inside its own session. This is a v1 pattern that survived. Should it be removed and replaced by `message`? Decision pending.

---

### P2 — Persist-before-dispatch

**Statement.** For every event `E` emitted on the bus, the row in the `events` table for `E` is durably written *before* any non-persistence subscriber observes `E`.

**Why.** Crash recovery depends on the events table being the source of truth. If a side effect (session start, message delivery) can fire without the event being durable, restarting the system loses the trail.

**Verification.**
- *Static:* `EventBus.emit()` must call first-priority subscribers (persistence) before normal subscribers. Source-level invariant — see `src/app/event-bus.ts:163-180`.
- *Runtime (Tier 2):* `test/v2-conformance/p2-persist-before-dispatch.test.ts` — emit an event with a normal subscriber that throws; assert the row is in `events` table even though the throw happened. Then emit with a first-priority subscriber that throws; assert no normal subscriber ran.
- *Tier 3 metric:* `v2.dispatch-without-persist` — count of events observed by a normal subscriber but missing from `events` table within 1s. Should be 0.

**Status.** `holds` structurally (the `firstSubscribers` / `normalSubscribers` split exists), `untested` formally. The test above doesn't exist yet.

**Known gaps.** The `db-writer` is registered as a first-priority subscriber, but if it ever fails to insert (DB locked, disk full), the normal subscribers still run. v2 is silent on whether persistence failure should block dispatch. Suggest: persistence failures emit a sentinel `events.persistence-failed` event but allow dispatch to proceed (degraded mode is better than freeze). Document this explicitly.

---

### P3 — Message asynchrony

**Statement.** When agent A emits `message.created` targeting agent B at time T, B's earliest possible session start in response is at B's next scheduled heartbeat tick (≥ T + B's heartbeat interval / number-of-cycles-til-pickup). A cannot await B's response.

**Why.** Synchronous inter-agent calls turn the system into a distributed monolith. The async-with-heartbeat property is what makes agents independent.

**Verification.**
- *Static:* the `message` tool's return type contains no awaitable promise of the recipient's reply. Check by inspection — see `src/lib/tools/message-tool.ts`.
- *Runtime (Tier 2):* `test/v2-conformance/p3-message-asynchrony.test.ts` — start a session for agent A, have it emit `message` to B, assert A's session ends before any session for B starts.
- *Tier 3 metric:* `v2.message-latency-floor` — min wall-clock time from `message.created` to receiver's next session start. Should be ≥ next-heartbeat-tick-of-receiver. Anything less means someone bypassed the queue.

**Status.** `holds` by current tool design. Untested. The floor metric doesn't exist.

**Known gaps.** None known. The cleanups removed `notify`/`send`; `message` is the single primitive.

---

### P4 — Single message primitive

**Statement.** The set of inter-agent communication tools available to agents is exactly `{message}`. No `notify`, `send`, `forkAgent`, `runAgent`, or equivalents are exposed in any agent's tool registry.

**Why.** Tool surface area is the agent's contract with the system. Multiple ways to do the same thing breed v1 patterns and confuse model behavior.

**Verification.**
- *Static (Tier 1):* lint rule — exports from `src/lib/tools/` must match the v2 set. Or: snapshot test on the loaded tool registry.
- *Runtime (Tier 2):* `test/v2-conformance/p4-tool-surface.test.ts` — load the agent runtime, enumerate tools registered for an agent, assert set equality with the v2 spec.

**Status.** `holds`. notify/send removed in cleanup A. Untested formally.

---

### P5 — Metrics drive direction (with P0 fork rule)

**Statement.** Every metric in the `metrics` table has a non-null `owner`. Every `metric.breach` event either (a) triggers a direct fork of the owner (when `metric.priority = P0`), or (b) is included in the owner's prompt context at the owner's next heartbeat. There is no third path.

**Why.** Per `design/agent-metrics.md` and `design/heartbeat-as-agency.md`: metrics are vitals that surface to agents at heartbeat; only urgent metrics interrupt. Without this, breaches either flap unattended (no path to owner) or page constantly (no heartbeat queueing).

**Verification.**
- *Static:* schema-level `NOT NULL` on `metrics.owner`. (Already true.)
- *Runtime (Tier 2):* `test/v2-conformance/p5-breach-routing.test.ts` — emit a P2 breach for metric M owned by agent A; advance time to A's next heartbeat; assert A's prompt contains M's breach. Separately: emit a P0 breach; assert A is forked immediately (within 1s).
- *Tier 3 metric:* `v2.fork-on-breach-rate` — fraction of `metric.breach` events that fork directly. Should equal P0-priority-rate.

**Status.** `partial`. (a) — the P0 vs heartbeat-queue distinction is **not implemented today**; today, breach handling is uniform (fork on every breach) per the current `metric-alert-reactor` handler. (b) — the prompt-context inclusion exists in `prompt-assembly` but is independent of breach events; it shows current breach status. The "metric breach informs next heartbeat" path is implicit via "prompt shows status," not via "event is queued for next heartbeat."

**Known gaps.**
- `metrics.priority` column doesn't exist. P0 vs P1+ has no schema representation. **Blocks the test.**
- `metric-alert-reactor` doesn't check priority. **Needs a one-line change once `priority` exists.**
- Remediation: file project `metric-priority-and-fork-rule`; small DB migration + handler change. Estimate: half a day.

---

### P6 — Heartbeat is agency

**Statement.** Every session with `trigger='heartbeat'` emits exactly one `agent.decision` event before the action phase. The decision event carries `{agent, sessionId, decision: string}` where `decision` states what the agent is doing and why.

**Why.** Per `design/heartbeat-as-agency.md`: the heartbeat is where agents decide for themselves. Without a structured decision event, "the agent decided" is unobservable; it lives only in transcripts. This makes agency invisible to the system, the UI, and other agents.

**Verification.**
- *Runtime (Tier 2):* `test/v2-conformance/p6-heartbeat-decision.test.ts` — run a heartbeat session for an agent in a fixture environment; assert exactly one `agent.decision` event in the events table for that session id.
- *Tier 3 metric:* `v2.heartbeat-decision-rate` — fraction of `trigger=heartbeat` sessions that emitted at least one `agent.decision`. Should be 1.0.

**Status.** `untested`. The `agent.decision` event type does not exist today. The heartbeat workflow does not emit it.

**Known gaps.**
- Event type doesn't exist. Needs addition to `event-bus.ts` AgentEvent union.
- Heartbeat workflow (`agents/shared/workflows/agent-heartbeat.ts`) doesn't emit it.
- This is a **prerequisite for the new web UI** (`design/webui.md` data-model gap #1).
- Remediation: file project `heartbeat-decision-event`. Small system change, large downstream value.

---

### P7 — Workflow crash safety

**Statement.** When the may-agent process is killed mid-workflow:
- Agent steps in progress can be resumed via `SessionManager.continueRecent()`.
- Function steps in progress can be re-run idempotently (i.e., re-running them produces the same effect, or no effect, given the same input).
- The workflow's step ledger reflects which steps completed before the crash.

**Why.** Long-running workflows that span hours or days must survive process restarts. Without crash safety, restarts produce duplicates, lost work, or corrupted state.

**Verification.**
- *Runtime (Tier 4):* gym scenario `crash-recovery/` — start a multi-step workflow, kill the process at step 2, restart, assert workflow completes correctly.
- *Static:* code review of every function step in `agents/*/workflows/` — each must be idempotent. Hard to enforce statically; relies on convention.

**Status.** `partial`. Agent-step recovery via `continueRecent` works. Function-step idempotency is a convention; some steps in the wild may not be idempotent. No automated test.

**Known gaps.**
- No gym scenario for crash recovery exists.
- No lint or convention check for function-step idempotency.
- Remediation: low-priority unless we observe a crash producing duplicate work. File issue, defer.

---

### P8 — UI is a bus subscriber

**Statement.** The Web UI receives live state via `/ws` (which proxies the bus). UI mutations of system state are emitted as bus events; the UI does not write directly to `metrics`, `messages`, or `sessions` tables, and does not call `manager` internals.

**Why.** Per `proposals/v2-architecture.md`: "UI backends are just event bus subscribers." A UI that reaches into the manager creates a second control plane and breaks the event-driven property.

**Verification.**
- *Static (Tier 1):* `src/app/ui/web.ts` imports from `manager` are limited to read-only types and the bus interface. Any direct DB writes are flagged.
- *Runtime (Tier 2):* `test/v2-conformance/p8-ui-via-bus.test.ts` — POST a steering verb (e.g., comment); assert exactly one event was emitted; assert no direct DB row was inserted by the UI handler (only by the event handler).

**Status.** `partial`. Today's `web.ts` mostly reads SQLite for queries (Plane B in the webui design — fine, this is allowed). But the steering POST endpoints don't all exist yet (per webui doc); when they're added, this property must be enforced for them.

**Known gaps.** Property enforcement comes online with the new steering endpoints, not before.

---

### P9 — Convention over configuration

**Statement.** A new agent works with: a `SOUL.md`, a `context.md`, an `agent.json` setting only `name` and `model`, and a `cron.json` setting only the heartbeat interval. No custom handlers, custom workflows, custom prompts, or custom tools are required.

**Why.** Convention-over-configuration is core principle P9. If new agents need substantial scaffolding, the convention has failed and the system encodes complexity per-agent.

**Verification.**
- *Manual review:* periodic audit of `agent.json` files. Ratio of "minimal" to "customized" should be high.
- *Tier 3 metric:* `v2.agent-config-bytes-p50` — median size of `agent.json`. Trend over time. Increasing trend = drift.

**Status.** `untested`. Subjective. The current 13 agents have varying levels of customization; no measurement.

**Known gaps.** Property is hard to enforce mechanically. Best we can do is observe trends and call out drift in review.

---

### P10 — Pi-coding-agent owns the runtime; we are glue

**Statement.** Our agent runtime code (the layer between the bus and `pi-coding-agent`) is bounded in size. Specifically: `src/lib/manager.ts` ≤ 500 LOC. The LLM loop, retry, compaction, tool execution, and session persistence live in `pi-coding-agent`, not in our code.

**Why.** v2's architecture doc claimed "~50 LOC of glue." That target is aggressive; 500 LOC is a realistic ceiling given guards, hooks, and event bridging. Beyond that, we are reimplementing the agent runtime — which is the v1 pattern.

**Verification.**
- *Static (Tier 1):* line-count assertion in CI: `manager.ts` ≤ 500. Fails the build if exceeded.
- *Tier 3 metric:* `v2.runtime-glue-loc` — sum of LOC in glue files. Trended.

**Status.** `violated`. `manager.ts` is **2,346 LOC** today. This is the largest single non-conformance with v2 intent.

**Known gaps.**
- `manager.ts` duplicates substantial logic from `pi-coding-agent`'s `Agent` class: retry loop, session persistence wrapping, compaction triggering, tool guard composition.
- Remediation requires either:
  - **(A)** A focused refactor that pushes logic into pi-coding-agent or a thin wrapper, then deletes from `manager.ts`. Estimated 3–5 days.
  - **(B)** Accept the current shape and update the spec ceiling to e.g. 2,500 LOC. **Honest but a retreat from v2 intent.**
- This is the property most worth fighting for. **A v2 that fixes this is meaningfully different from a v2 that doesn't.**

---

## How the verification mechanisms relate

| Tier | Tool | Cost | Catches | Used for |
|---|---|---|---|---|
| 1 — Static | grep, AST, line-count, schema check | low | textual drift, missing types | P1 (allowlist), P4 (tool surface), P10 (LOC), P2 (schema) |
| 2 — Property test | vitest, in-memory bus + DB | medium | behavioral drift | P1, P2, P3, P4, P5, P6, P8 |
| 3 — Live metric | metrics-snapshot handler | low (once added) | continuous drift | P2, P3, P5, P6, P9, P10 |
| 4 — Gym scenario | gym subsystem | high | end-to-end regressions | P7, full-pipeline scenarios |

The four tiers are **complementary**, not alternatives. A robust v2 has all four for its most important properties.

## What the spec does NOT cover

- **Performance.** v2 doesn't promise specific latency, throughput, or memory. Performance regressions caught by observation, not spec.
- **Aesthetics.** "manager.ts is too long" is a property (P10 above) only because we picked a ceiling. "this code is ugly" is review feedback, not spec.
- **Semantics of agent decisions.** The spec checks that `agent.decision` is emitted (P6). It does not check whether the decision is *good*. Quality is for evaluator/judge agents, not the conformance suite.
- **Migration progress.** "We are X% done with v2" is a useful narrative number but not a property. The spec replaces it with a property checklist.

## Status summary (2026-05-06)

| Property | Status |
|---|---|
| P1 — One agent-start primitive | partial (allowlist undefined) |
| P2 — Persist-before-dispatch | holds (untested) |
| P3 — Message asynchrony | holds (untested) |
| P4 — Single message primitive | holds |
| P5 — Metrics drive direction | partial (P0 priority not in schema) |
| P6 — Heartbeat is agency | violated (no decision event) |
| P7 — Workflow crash safety | partial (no test) |
| P8 — UI is a bus subscriber | partial (steering endpoints not built) |
| P9 — Convention over configuration | untested |
| P10 — Pi-coding-agent owns the runtime | **violated** (manager.ts 2,346 LOC vs. 500 ceiling) |

**Conformance score: 1/10 holds, 4/10 partial, 1/10 violated, 4/10 untested.** This is the actual state of v2.

Reading the score:
- Most "violated" or "partial" entries are *known gaps with concrete remediation*, not surprises.
- The big one — P10 — is structural and can't be fixed by deletion. It needs an architectural decision (refactor vs. retreat the ceiling).
- "Untested" is the largest bucket because we never wrote the conformance suite. That's the next concrete deliverable.

## Implementation plan for this spec

Three steps, ordered by leverage:

1. **Land the conformance test suite** (`test/v2-conformance/*.test.ts`). Write all 6 testable properties (P1–P6, P8). Each test is small. Run on every commit. Estimated: 1.5 days. **This converts most "untested" entries to either "holds" or "violated."**

2. **Add v2 architectural metrics to the registry.** `v2.runtime-glue-loc`, `v2.heartbeat-decision-rate`, `v2.fork-on-breach-rate`, `v2.message-latency-floor`, `v2.agent-config-bytes-p50`. The system observes its own conformance. Estimated: 1 day. Adds Tier 3 coverage.

3. **File remediation projects for the violations:**
   - `heartbeat-decision-event` (P6) — small, high downstream value.
   - `metric-priority-and-fork-rule` (P5) — small.
   - `manager-shrink` (P10) — large, architectural. Decision required: refactor or retreat.

Step 1 is the highest-leverage action. Without it, this document is aspirational. With it, the spec has teeth.

## Open questions

1. **Is P10's 500-LOC ceiling the right number?** The architecture doc said 50; that's pi-coding-agent doing all the work. 500 is "thin wrapper with guards and event bridging." 2,500 is "we're reimplementing." Pick one.

2. **Does the conformance suite gate commits?** If yes (CI fails on conformance regression), it has real teeth but blocks experimentation. If no, it's diagnostic but not enforcement. Suggest: gate on `holds` properties only; allow regressions on `partial` to flip to `violated` with explicit ack.

3. **Where does the "allowlist" for P1 (`runAgent` callsites) live?** The test needs a list of legitimate exceptions. Suggest: `test/v2-conformance/p1-allowlist.json` with one-line justification per entry. Reviewing the allowlist is reviewing the v2 boundary.

4. **Should `agent.decision` be optional or required?** P6 says required (rate=1.0). But not every heartbeat session may have a meaningful decision (idle heartbeats: "nothing to do today"). Suggest: an idle decision is still a decision. Emit `{decision: "idle: no work this cycle"}`. Forces every heartbeat to be deliberative.

5. **Who owns this doc?** Suggest: human (you) owns the spec; agents (`arc`?) own the conformance suite. The spec is a contract; the suite is the enforcement.

## Maintenance

When the system changes:

- **New v2 property?** Add it to this doc with verification mechanism. No "informal property."
- **Property newly verified?** Update its status. Move from `untested` to `holds`.
- **Property violated by a change?** Either fix the change, update the property to `partial` with a known-gap entry, or — if v2 intent itself is changing — update the property statement.

This doc is a living artifact. It is updated in the same PR as the change it describes. Drift between the spec and reality is itself a v2-conformance violation.
