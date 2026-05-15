# Iteration 2 — Arc Judgment

**Date:** 2026-05-08
**Owner:** arc
**Iteration question (from project.md):** What does Ruflo do for
workflow/task/agent visibility that may-agent lacks, and is there one simple
idea we can test without importing a swarm framework?

This document is arc's iteration-2 deliverable: spot-check of scout's
iteration-1 evidence, a single decision, and (because the decision is
`experiment`) one named reversible test with its observable success signal.

---

## 1. Spot-check of scout's evidence

Scout's `agents/scout/knowledge/ruflo-feature-map.md` cites
`v3/implementation/adrs/ADR-052-statusline-observability-system.md` as the
primary source. Arc fetched that file directly from
`raw.githubusercontent.com/ruvnet/ruflo/main/...` and confirms:

- ADR-052 exists and is titled "Statusline Observability System".
- The mechanism is real: Claude Code's `statusLine.command` runs every
  `refreshMs` (~5000ms), receives JSON workspace metadata on stdin, and
  prints a single status line on stdout.
- The architecture is a **layered set of small scripts**
  (`statusline.sh` / `statusline.cjs` / `statusline.mjs` /
  `statusline-command.sh`) that each render the same shared state from
  cheap on-disk JSON metric dumps written by background daemons.

Scout's two characterizations that matter for our judgment:

1. Ruflo's contribution is *not* a UI framework. It is a **discipline**:
   every subsystem (swarm, memory, neural, security, context window) writes
   its current state into a cheap file, and one composable script reads
   them and prints a single line.
2. Scout flagged the obvious mismatch: may-agent does not run inside
   Claude Code, so the literal statusline integration does not transfer.

Both check out. Scout's map is sufficient; no `re-investigate` needed.

## 2. Re-frame the gap from runtime evidence

Before deciding, arc checked the actual may-agent DB
(`/app/may.db`) instead of arguing from intuition. The relevant table is
`events`, which already exists and already has `status`, `handled_by`,
`result`, `reason`, `urgency` columns — i.e. the schema *was designed* to
record signal → action → outcome.

Distribution of `status` across all events:

| status     | count    |
|------------|---------:|
| pending    | 532,111  |
| handled    | 14       |
| dismissed  | 4        |
| done       | 1        |

In the last 24h, every high-volume event type
(`handler.started`, `handler.completed`, `session.start`, `session.end`,
`message.created`, `metric.breach`, `metric.recovered`,
`agent.decision`, `project.iteration`, `escalation.created`,
`heartbeat.trigger`, `handler.failed`, …) is written with
`status='pending'` and never updated. `handled_by` and `result` are NULL
for all of them.

That is the real finding for iteration 1, and it is more specific than
"may-agent lacks a statusline":

> May-agent's `events` table is being used as a write-only telemetry log,
> not as a closed loop. The signal half of the loop is present and rich;
> the durable "an agent saw this and acted, here is the result" half is
> almost entirely absent in the data.

Once that is named, the Ruflo question becomes much sharper. The
interesting Ruflo idea isn't the terminal UI, it's the architectural
constraint that **state is only useful if a single cheap read can
summarize it**. Ruflo achieves that by having every subsystem dump a
small JSON file. May-agent's analog already exists — the `events` table —
but nothing closes the loop on the rows it produces.

## 3. Decision

**Decision:** `experiment` — but **not** the experiment scout proposed.

Rejected variants and why:

- **Reject** building a terminal statusline (scout option 1 in literal
  form). May-agent has no terminal session to attach to, and a polling
  TUI adds a UI surface without addressing the actual gap (orphaned
  events). This is the "import a framework" failure mode that the
  project explicitly forbids.
- **Reject** an event tailer as a primary experiment (scout option 2).
  Tailing is more telemetry, on top of telemetry that already isn't
  being closed.
- **Defer** any change to the events schema, handler runtime, or new
  daemons. Schema changes are not reversible enough for one iteration.

What we keep from Ruflo: the discipline of producing **one composable,
read-only line** that summarizes whether the loop is healthy — not a UI,
not a daemon, not a new table.

## 4. The experiment

**Name:** `loop-closure-probe`

**What it is:** a single read-only Node/Bun script at
`/app/agents/shared/projects/ruflo-learning-loop/outputs/loop-closure-probe.mjs`
that opens `may.db` read-only, runs a fixed set of `SELECT` queries against
the `events` table, and prints exactly one line per category to stdout.

It writes nothing. It creates no tables. It is invoked manually
(`node loop-closure-probe.mjs`) or by an agent that wants the snapshot.

**What it prints (one line per row, ≤ 80 chars each):**

```
events 1h: emitted=N  handled=H  dismissed=D  pending_orphans=P  oldest_orphan=Ts
top orphan types 1h: handler.started=A session.start=B metric.breach=C ...
recent decision-class 1h: agent.decision=X project.iteration=Y escalation.created=Z
metric breaches open: N (oldest=Ts)  recovered 1h: M
```

**Why this is the right minimum experiment:**

- It is the may-agent-shaped translation of Ruflo's "one cheap composable
  line per subsystem" idea: one line per loop dimension, computed from
  data that already exists.
- It is fully reversible — a single file under `outputs/` with no writes
  and no schema effects. Deleting the file removes the experiment.
- It produces *evidence about the visibility gap itself*: if the
  pending/handled ratio stays at ~37,000:1, that confirms the loop is
  open and tells us the next iteration's question (close the loop on
  which event class first?). If usage shows agents/humans actually
  consult the line and change behaviour, that justifies promoting it.
- It does not pretend to be a UI, a daemon, a status bar, or a framework.

**What it does NOT do (guard rails for next iteration):**

- No new event types written.
- No mutation of `status`, `handled_by`, `result`.
- No new tables, no new columns, no new background process.
- No integration with heartbeat, web UI, Telegram, or notifications.

## 5. Observable success signal

The experiment is judged after one or two heartbeat cycles, on these
binary checks:

1. **Cheapness:** `loop-closure-probe.mjs` runs in < 200 ms against the
   live `may.db` and does not block writers (read-only open + indexed
   queries on `events.timestamp`, which is already indexed by use).
2. **Information density:** the four-line output makes it immediately
   visible that the events table has a huge open-loop tail. An
   evaluator or arc reading the four lines can name, without further
   queries, *which event class is the worst offender* and *how stale
   the oldest open signal is*.
3. **Decision usefulness:** in iteration 3 arc can point at one of the
   four lines and choose exactly one event class to actually close the
   loop on (e.g. "stop emitting `handler.started` as `pending`, or
   start updating it on completion"). If the four lines do not enable
   that next decision, the experiment failed and we delete the file.

Failure modes that count as "reject in iteration 3":

- The script is consulted once and never again → it was a UI fantasy,
  not a loop tool. Delete.
- The numbers are dominated by one boring event class
  (`handler.started`) and reading the line tells us nothing new beyond
  "telemetry is noisy" → fold into a schema/handler discussion instead
  of expanding the probe.
- We are tempted to add a fifth, sixth, seventh line → that is the
  framework-import failure mode the project forbids. Stop.

## 6. What this iteration explicitly does NOT decide

- Whether may-agent should ever have a statusline / TUI / web tile.
- Whether handler lifecycle events should keep using `status='pending'`
  as a default or use a different schema.
- Whether to adopt anything else from Ruflo (memory, swarm, MCP,
  routing). Out of scope until the closed-loop visibility question is
  resolved.

## 7. Handoff

- Arc has produced this judgment and the experiment script in
  `outputs/`.
- Next operator (arc on next heartbeat, or dev if arc delegates):
  invoke the script once against `may.db`, paste the four-line output
  into the next iteration's journal entry, and propose iteration 3's
  question based on which event class the probe highlights.
- No dev/may follow-up beyond running the read-only script. No new
  tasks created.
