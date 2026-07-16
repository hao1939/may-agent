# Agent App Scenario Audit — 2026-07-16

**Status:** Design review.
**Scope:** Test the proposed Agent App model against typical use, Gym, live
diagnostics, parallel evaluation, production events, multi-app hosting, and
recovery. This report does not accept or implement the proposal.

## Core Model Under Review

```text
App package = owner context + tasks + workflows/tools + app-owned data
Running app = generic runtime + app package
App ID = root owner agent ID
No event = no agent work
Gym = controlled scenario events with production event sources disconnected
Relevant task mutation = revisioned steering to the linked active session
```

## Overall Verdict

The core model is coherent and simpler than the current project-app runtime.
It works naturally for idle agents, explicit human turns, scheduled production
work, dedicated/shared hosting, and read-only Gym evaluation.

It is not yet implementation-ready. Six contracts remain incomplete in the
current implementation:

1. app-addressed ingress for apps that are not merely project aliases;
2. structural read-only access to real failure state during evaluation;
3. separation of event consumers from event producers at app-instance scope;
4. app/instance-scoped identity, state, sessions, and budgets;
5. owner-input closure only after successful judgment;
6. revisioned task-mutation steering and action-result continuation.

The current implementation passes its own loader tests, but those tests confirm
the old hybrid model rather than the proposed one.

## Scenario Matrix

| Scenario | Expected flow | Design result | Current implementation |
| --- | --- | --- | --- |
| Idle loaded app | Load package and consumers; attach no event producer | **Good.** Owner waits and spends no model budget. | **Partial.** Loading itself starts no owner session, but schedule activation is controlled by the host-wide `--cron` path rather than per-instance source attachment. |
| Explicit human turn | Human input targets `app:<id>` and reaches the same-named root owner | **Good.** One stable public identity and one owner entry. | **Gap.** CLI/one-shot targets `--agent`; SDK event targets have project/task/owner/session/human but no app target. |
| Synthetic alignment case | Gym sends one scenario input; owner submits a proposal; no other events | **Good.** Natural unit test of owner judgment. | **Partial.** Gym invokes a raw named agent with `--oneshot --agent`; “do not execute” is prompt guidance, not a restricted tool surface. |
| Diagnose a real live failure | Infra prepares the same failure packet for several independent agent generations | **Good with one rule:** observation revision may be shared, trial transcripts/results may not. | **Gap.** Gym redirects `STATE_DIR` to isolated temporary state, so the real event/metric failure is absent. There is no context-packet adapter for live state. |
| Parallel diagnostic trials | One app state, N independent owner sessions, one targeted scenario event each | **Good.** Session—not app instance—is the normal parallel unit. | **Gap.** Current batch execution is sequential and the app-root owner/context path is not used. |
| One mutable execution trial | One scenario event may synchronously use tools and change its private/approved state | **Good if bounded.** Record resulting trajectory separately from proposal quality. | **Partial.** One-shot agent tools can execute, but actions are not typed or linked to proposal steps. |
| Several trials mutating shared state | Concurrent sessions change the same task/event/project state | **Unsafe by design.** Run sequentially or use snapshots/copy-on-write state. | **Unsafe/undefined.** No Gym-level state-version or conflict contract. |
| Scheduled production review | Attached schedule emits an event; fast path or owner entry handles it | **Good.** Autonomy is explained entirely by event producers. | **Partial.** Schedules and workflow handlers work, but enablement is host/global and ingress remains split among handlers, `onEvent`, and fallback. |
| Worker completion | Worker evidence event wakes owner; owner accepts/rejects task meaning | **Good and aligned with accepted design.** | **Partial.** Representative apps contain direct reviewer/controller routes and large workflows that mix mechanics with owner policy. |
| Task changes during an active owner turn | Infra steers a revisioned delta and evidence references into the linked session | **Good.** The agent neither polls nor imports a task client; the next safe turn sees the committed state. | **Partial.** Generic session steering exists, but there is no task-mutation bridge or canonical revision envelope tied to app/task/session identity. |
| Owner requests a task change | Owner returns a typed action; infra applies it; committed revision is steered back before continuation | **Good.** Mutation and verification remain in one session without coupling the agent to the task store. | **Partial.** Workflows can mutate task state, but mutation, evidence, and owner continuation are not one uniform contract. |
| Cross-app handoff | Source app emits typed target to destination app; destination owner receives it | **Good conceptually.** Ownership and traces remain explicit. | **Blocker.** There is no canonical app target, and internal app-agent names are registered globally. |
| Two apps with `worker`/`reviewer` roles | Internal identities are qualified by app | **Good.** Local role names can repeat safely. | **Blocker.** Duplicate project-app agent names are currently rejected. |
| Dedicated deployment | Start generic runtime with one package | **Good.** Stronger process/container isolation with identical semantics. | **Gap.** Current runtime discovers all sibling apps; no app-specific start surface exists. |
| Shared deployment | One host loads several isolated app packages | **Good.** Share engines, not context/state. | **Partial.** Current host loads several apps, but identity and persistence are not consistently instance-scoped. |
| Restart with pending owner work | Recover state; attach recovery source; retry unclosed input | **Good if closure is transactional.** | **Correctness issue.** Some paths mark inbox work reviewed before the owner turn successfully produces and applies judgment. |
| Gym preference-learning replay | Later trial sees an explicitly approved preference update | **Possible, but must be intentional.** | **Partial.** Gym supports sequential environment/artifact carryover, but parallel trials need a frozen initial context to avoid contaminating one another. |

## Detailed Findings

### 1. “No event means no work” is sound, with one qualification

Every emitter is an event producer, including schedules, metrics, recovery,
webhooks, agents, and workflows. Disconnecting external input alone is not
enough if a schedule or recovery loop can emit internally.

For a proposal benchmark, the clean rule is:

```text
connected producer: Gym scenario only
agent event emission: denied by proposal tool policy
pending production delivery: not attached
```

No additional activity/profile abstraction is necessary.

### 2. Live diagnostic evaluation should share state, not sessions

The useful boundary is:

```text
prepared before each call: tasks, events, metrics, logs, knowledge, evidence
private per trial: model session, transcript, core-tool log, proposal, score
```

The harness should record a state revision or observation timestamp. Exact
snapshots improve reproducibility but are optional for a live diagnostic test.
If the state changes during the batch, the report must show that drift.

The agent does not query infra during generation. Infra materializes a compact
summary plus a versioned read-only context directory containing task, event,
metric, log, and evidence projections. The agent explores that view with normal
read/search/local-query tools in one run. Automatic context learning, memory
writes, alert resolution, event review, and session-digest updates must remain
outside the call and must not mutate shared app state during a proposal trial.

For a normal hosted run, the view is not a one-shot limitation. When the owner
returns a declared action or evidence request, infra performs it outside model
generation, steers the result and new revision into the same session, and the
owner continues. External task, worker, workflow, and human mutations arrive
through the same revisioned steering path. Fixed proposal trials disable these
unsolicited updates unless the scenario explicitly tests steering.

This preserves adaptive diagnosis and post-action verification without giving
the agent an infra query API. The actual limitation is capability availability:
if neither the materialized view nor a granted capability can supply evidence,
the agent must report the gap. That is also true of a standalone run, which
keeps local reasoning and core tools but has no durable workers, callbacks, or
shared task store to invoke.

The replacement contract is therefore mandatory, not optional: indexed depth,
a plain capability catalog, same-session continuation, and revisioned
freshness. A summary-only packet with no continuation path would materially
reduce the agent's diagnostic power and should fail conformance testing.

### 3. Generic Agent Apps need an app address

The current event authoring target supports project, task, owner, session, and
human fields. The proposed runtime introduces `app:<id>` as the public identity,
but does not yet define its canonical event target.

Add `target.app` as the canonical route for direct and cross-app Agent App
ingress, resolving it to the same-named root owner. Preserve `target.project`
for domain events and resolve the project to its bound app. This supports the
broader “another Codex with many context apps” idea without forcing system or
deputy apps such as May to pretend they are projects.

Do not introduce a persisted generic request object to solve this.

### 4. App ID equals owner ID is helpful but migratory

The invariant removes inference and public routing ambiguity. It does not match
the active apps today:

- `may-agent` is owned by `tech-lead`;
- `scout-knowledge-lib` is owned by `scout`;
- `evaluation` is owned by evaluator/judge roles;
- `aks-rp-e2e` is owned by `aks-explorer`.

Migration should preserve display roles while changing canonical root identity,
or explicitly rename app IDs. Compatibility aliases must be temporary because
permanent aliases recreate the mapping the invariant was meant to remove.

### 5. Current owner ingress is hybrid

Today an event can:

1. enter a declared workflow handler;
2. be consumed/nooped by `onEvent`;
3. fall back to a raw owner agent session.

The raw fallback does not use the app's owner context workflow. Direct workflow
handlers can also bypass semantic owner judgment. The new design needs one
explicit classification for each route:

- owner entry;
- deterministic capability/fast path;
- explicit no-op.

### 6. Owner-input closure has a real correctness problem

The loader fallback closes the inbox after starting the raw owner session, not
after successful judgment. The platform owner workflow similarly reviews/drains
inbox events before it invokes `tech-lead`.

The correct sequence is:

```text
accept/lease -> owner result -> apply decision -> typed follow-up -> close
```

This should be fixed before relying on the owner entry for durable autonomous
work.

### 7. Parallel Gym needs concurrent sessions, not replica infrastructure

The runner can start N sessions with:

- the same app/package/context revision;
- the same read-only app-state binding;
- separate session IDs, transcripts, result paths, and scorer records;
- one targeted scenario event per session.

Provider rate limits and benchmark concurrency are runner concerns. They should
not consume or alter the app's production session budget.

### 8. Steering is the live task-state contract

Task state remains owned by infra. A relevant task mutation is delivered to an
active owner session as a concise steering record containing app ID, task ID,
old/new revision, summary, and evidence references. It is queued at a safe
model/tool boundary; urgent interruption uses cancellation.

If no relevant session is active, infra does not start one merely to deliver a
delta. The next real event prepares context at the latest revision. This keeps
the event-driven rule intact: no event means no autonomous work.

Agent-requested mutations use the reverse half of the same contract:

```text
owner structured action
-> infra validates/applies with expected revision and idempotency key
-> committed result or conflict is steered to the same session
-> owner verifies, revises, or completes
```

No task polling, task-store import, or task-specific agent API is needed.

## Confirmed Current-Code Evidence

- `ProjectAppEventTarget` has no app field:
  `projects/may-agent/packages/sdk/src/project-app.ts`.
- Current one-shot selection is agent-based:
  `projects/may-agent/src/app/app-args.ts` and `projects/gym/src/cli.ts`.
- Gym launches `--oneshot --agent`, uses a temporary `STATE_DIR`, and runs batch
  scenarios sequentially: `projects/gym/src/cli.ts`.
- Duplicate app-agent names are rejected:
  `projects/may-agent/src/app/loader/agent-registry-loader.test.ts`.
- Workflow handler, `onEvent`, and fallback routes coexist:
  `projects/may-agent/src/app/loader/project-app-loader.ts`.
- Fallback inbox closure occurs immediately after session dispatch:
  `projects/may-agent/src/app/loader/project-app-loader.ts`.
- Platform inbox events are drained before `ctx.runAgent(...)`:
  `projects/may-agent.app/workflows/platform-owner-review.ts`.
- Generic active/idle/cold session steering already exists through
  `session.steer.requested`, `manager.send(...)`, and `manager.resumeSession(...)`:
  `projects/may-agent/src/app/event-bus.ts`,
  `projects/may-agent/src/app/chat-session.ts`, and
  `projects/may-agent/src/app/command-router.ts`. It currently carries a
  message and optional context; it is not yet connected to task revisions or
  owner-action results.

Focused verification on 2026-07-16:

```bash
cd projects/may-agent
bun test src/app/loader/agent-registry-loader.test.ts \
  src/app/loader/project-app-loader.test.ts

33 pass, 0 fail
```

The passing tests show that current behavior is stable; they do not show that
the new model is implemented.

## Priority Gaps

### P0 — Required before trustworthy evaluation

1. Structurally read-only proposal tool/runtime boundary.
2. Gym binding to fixture state or a read-only live app-state view.
3. Per-trial session/transcript/result isolation with host learning writes
   disabled.
4. State revision/time recorded in every diagnostic result.
5. Initial context manifest and all steering records retained with the trial.

### P0 — Required before durable owner operation

1. Close owner input only after successful applied judgment and typed follow-up.
2. Route every semantic input through the configured owner entry.

### P1 — Required for the generic multi-app model

1. Canonical `target.app` ingress alongside explicit project-to-app resolution.
2. App/instance-qualified internal identities and storage.
3. App ID/root-owner equality migration.
4. Per-instance event-producer attachment.
5. Revisioned steering for active task/app sessions and action-result
   continuation.

### P2 — Product and operational work

1. App-specific start/load/invoke CLI.
2. Dedicated-host packaging and state export/import.
3. Parallel Gym runner and Vitest/HTML report integration.

## Recommendation

Keep the simple conceptual model. Do not add profiles, activity modes, replica
protocols, or a new request lifecycle.

Before implementation, make these five contracts explicit:

1. How does canonical `target.app` ingress coexist with project-targeted domain
   events and explicit project-to-app resolution?
2. What exact state is read-only during a live diagnostic trial, including host
   memory/learning hooks?
3. Which event producers are attached in production versus Gym?
4. How are app and instance IDs carried by sessions, events, workflows, state,
   budgets, and reports?
5. How does a committed task revision or action result select a linked session,
   enter through steering, and resume owner verification without duplicate
   application?

Then implement the smallest vertical slice:

```text
load one app package
-> bind its same-named owner
-> attach only one Gym scenario producer
-> run several read-only sessions over one failure state
-> produce isolated proposals and a human-reviewable report
```

That slice directly tests the design's hardest and most valuable scenario
without first rebuilding the whole production runtime.
