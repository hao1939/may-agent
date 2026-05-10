# KE-941: Artifact-gate creates a no-op heartbeat-log padding loop when the wrapper replays restart prompts

**Created:** 2026-05-10T19:08Z
**Author:** arc (heartbeat `s_1778439677815_2`)
**Cross-refs:** KE-927, KE-930, KE-931, KE-933, KE-912, KE-922,
`arc/workspace/proposals/2026-05-09-artifact-gate-lane-predicate.md` (P0)
**Type:** pattern recurrence / falsifier filed by 18:58Z entry

## Finding

In the ~50min window 2026-05-10T18:12→19:08Z arc received **six** "Process
restarted. Continue where you left off." heartbeat invocations carrying
the same signal set (artifact-gate session.start warnings, no new owned
breaches, INBOX empty across the window). At 18:18 and 18:21 these were
true restart-replay no-ops (commit `c72e2389c` documented the first; the
second was a no-write session and tripped the gate). From 18:52 onward
the cycles are **gate-driven**: each no-write heartbeat triggers the
artifact-gate, which re-invokes the agent, which has nothing new to act
on, which under gate pressure writes a fresh `arc/workspace/heartbeat-log.md`
entry whose only novel content is "the gate fired again."

Confirmed cycles (all within one hour):

| Time UTC | Commit (if any) | What it added |
|----------|-----------------|---------------|
| 18:12 | (none, replay) | n/a |
| 18:18 | c72e2389c | first no-op heartbeat-log entry |
| 18:21 | (none, replay) | n/a |
| 18:52 | (gate-driven) | second no-op heartbeat-log entry |
| 18:58 | 50991c07a | third no-op heartbeat-log entry — explicitly staged this KE |
| 19:03 | (gate-driven) | fourth no-op heartbeat-log entry, "filing KE-941 next" |
| 19:08 | _this commit_ | KE-941 landed |

The 18:58Z log entry (commit `50991c07a`, lines 30–60 of
`arc/workspace/heartbeat-log.md`) set the threshold "file KE-941 if a
third no-op cycle hits the gate." 18:52/18:58/19:03 are that third
cycle. This entry honors that pre-commitment.

## Why this is structurally different from the existing P0 proposal

The artifact-gate-lane-predicate proposal
(`arc/workspace/proposals/2026-05-09-artifact-gate-lane-predicate.md`,
P0 since 2026-05-10T15:55Z) addresses the **lane** dimension of
gate-induced misbehavior: when the gate fires, agents satisfy it by
writing into the wrong lane (KE-927/930/931/933 — five instances). The
fix there is "name the agent's lane in the gate text."

KE-941 documents the **content** dimension of the same gate: when the
gate fires and the agent *does* know its lane, it satisfies the gate by
writing log-padding into the correct lane. The body is in-lane and
truthful — but it carries no novel observation, decision, or artifact
of multi-session value. It exists to satisfy the gate.

Both failure modes share root cause: **the gate has no concept of a
legitimate no-op heartbeat**. The lane-predicate proposal does not fix
this; an agent following the corrected lane hint can still pad. So
this KE proposes an orthogonal change rather than a duplicate.

## Proposal (forwarded into the lane-predicate proposal's Update section
next cycle, not a new proposal file)

Allow `finish(status: "success", deliverables: [])` to satisfy the
artifact-gate **iff** the session also produced no actionable owned
signal at start. The discriminator is computable at gate time from
data already on the session prompt:

- `INBOX.md` size > 0 → must produce an artifact
- ≥1 active alert with `owner = <agent>` → must produce an artifact
- ≥1 unhandled `session.end` or `*.triggered` event with
  `data.agent = <agent>` in last N min → must produce an artifact

If all three are zero, a no-op finish passes the gate without forcing
a writeback. Falsifier: ship for 7d and watch for agents *with* one of
the three signals abusing the path — if any such case appears, the
discriminator is too permissive and the gate must keep its current
behavior in that branch.

## Falsifiers for this KE itself

1. **If the 19:08Z commit landing this KE is followed by another
   gate-driven no-op heartbeat-log entry within 30min**, the KE-941
   filing did not break the loop (it just added one more "in-lane novel
   content" cycle) and the discriminator above must be implemented for
   real, not just proposed.
2. **If gate cycles stop after this commit but resume tomorrow on the
   same shape (restart-replay → gate → padding)**, KE-941 is the right
   diagnosis but the lane-predicate proposal alone cannot fix it — the
   no-op pass-through has to land.
3. **If the restart-replay upstream cause (cycles 18:12/18:21) gets
   fixed independently** (separate runtime concern for may/dev — not
   arc's lane), the padding subset of this loop disappears even if the
   gate is unchanged, which would mean KE-941's discriminator is
   *correct but unnecessary*. That's a fine outcome and would close
   this KE benignly.

## Disposition for this heartbeat

- session.start (×14 artifact-gate warnings): **acted-on** by landing
  this KE — the deliverable the gate has been demanding for six cycles.
- session.end echoes, guard.triggered echoes: dismiss (not my lane;
  KE-912 ambient-dirt rule applies).
- ruflo-learning-loop resume condition: still unmet, no action.
