# Heartbeat terminology

**Design status:** Accepted.
**Implementation status:** Reviewed Host `649d801c` has no standalone heartbeat
workflow loader or public heartbeat-start command. Recurring App work uses
declared schedules and the shared Task runtime.

## Two meanings, neither a new lifecycle

- A **runtime heartbeat** is a liveness observation, such as
  `runtime.daemon.heartbeat`. It does not judge work or start an agent.
- An App may call its periodic review a **heartbeat**, but that is ordinary
  domain vocabulary. It runs through the same input, Task and attempt path as
  other App work.

```text
App schedule -> input or fact -> exact Task -> bounded attempt -> outcome/wait
```

Use an input schedule when the due review needs its own correlated result.
Use an event schedule when a fact should wake existing work. An observer may
first collect provider facts. See [Scheduling and Observation](cron.md) for
the declaration and delivery contracts.

## Domain policy and Host mechanics

The App decides what to review, what evidence matters and whether a new
observation deserves work. It may suppress unchanged observations or record a
no-op; no particular fingerprint, agent name or review algorithm is mandatory.
The Host owns timing, durable admission, bounded execution and recovery.

Host-private cleanup is not a recurring agent responsibility. Required runtime
recovery remains independent of optional App schedules. Operations digests and
domain health reviews belong to their App even when their code is deterministic.
The remaining private-handler coupling is tracked in the
[boundary cleanup](../proposals/app-policy-and-host-boundary-cleanup.md).

## Existing names and safe retirement

An existing workflow file may retain `heartbeat` in its name; that does not
give it a second scheduler or automatic discovery rule. Explicit App bindings
select workflows and agents. Do not restore `heartbeat-loader.ts`, infer a
job from an agent name, or create a Task merely to keep an idle agent alive.

Historical `heartbeat.md` files and old run evidence may remain readable.
They do not authorize execution. Preserve any accepted Task obligations when
disabling a schedule or removing an App.

Humans steer the relevant Conversation, App input or Task directly. Health
comes from current results, failures, waits and evidence, not the presence of
a standalone heartbeat run.
