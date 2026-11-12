# Scout creator consumption and closure of published recovery work

Two real publication-recovery children were already published but remained idle
and live. Their exact creator Tasks consumed the accepted results, independently
verified the publication evidence, and closed the children after a bounded routed
follow-through request. No implementation change was needed for this execution.

## Participants and authority

| Creator Task     | Existing child                         | Published finding                                                                                                                     |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `explore-github` | `goal/appdep_18e088fb52a74f11a1274954` | [Pipelock recovery seal](../../../scout-knowledge-lib/knowledge/findings/2026-11-08-pipelock-recovery-seal-attested-discontinuity.md) |
| `explore-hn`     | `goal/appdep_aeefd5188a2afe5fabde7041` | [Jane Street addendum](../../../scout-knowledge-lib/knowledge/findings/2026-11-09-jane-street-socratic-tutor-skill-addendum.md)       |

Both creators are standing Scout research Tasks in `scout-knowledge-lib`. Their
children's immutable creator records name those exact Tasks. Each child had an
accepted generation-1 result, publication and adaptation facts, a saved original
caller result, and no open Conditions. Before routing, canonical bytes exactly
matched the reported publication revisions. Closure still required the creator's
judgment against the original acceptance and a fresh exact Task read.

The user authorized the next owner follow-through check. Human App input was
admitted to each existing creator with `targetTaskId`. That contract selects an
existing attachment, bypassing the new-Task mapper and preserving the standing
assignment. The addressed requests asked the creators to inspect retained results,
judge publication fulfillment and use the normal guarded creator closure tool.
They did not request source scans, publication retries, library edits, additional
children or retirement of the standing Tasks.

## Durable trace

The GitHub request was admitted by event `6711299` with caller receipt
`app_a4393f68-8401-4e8c-99c7-e867cec6d0cb`. Creator attempt
`r_3_8a8f0408-f099-4bc8-b363-d660adae6d5c` ran from 17:01:09.250 to
17:01:42.206 UTC on 2026-11-12, or 01:01 on 2026-11-13 in Asia/Shanghai.
It consumed child result `r_1_357a7361-438a-48f1-bb46-66b2f7d8509a`, verified
the adapted finding at publication `7228b1d24be891b055aaf129857496af4f3b71c8`,
and closed the child at 17:01:32.879 UTC. The child resource version advanced
from 10 to 11. Its closure has `kind: closed` and
`decidedBy: {kind: creator, creator: {appId: scout-knowledge-lib, taskId: explore-github}}`.

The HN request was admitted by event `6711300` with caller receipt
`app_b7158951-312f-47f4-a095-24eca45b734e`. Creator attempt
`r_3_d8d06036-3860-4b95-81c3-9522fc0c60c6` ran from 17:01:43.724 to
17:02:18.924 UTC. It consumed child result
`r_1_aed4477b-8c8e-4c8f-a63c-7c1a942823f6`, verified the canonical addendum
at `d16ecf40497ee6d17cd8b5f7402b5e3e52836fe7`, and closed the child at
17:02:06.476 UTC. The child resource version advanced from 3 to 4. Its closure
identifies `explore-hn` as the deciding creator.

Each creator used one native Scout call, with nine recorded operations. The
children retained their original accepted attempt IDs and were not re-executed.
Both new follow-through receipts became done with authored answers naming the
consumed result and closure. Both original child caller results remained saved.
The operator supplied the routed requests and performed read-only verification;
the recorded creator Tasks performed closure through the existing authority.

## Verification and limit

Final scoped reads verified both children closed, the exact deciding creators,
retained accepted-result references, and both creator Tasks still live and idle.
The creators retained their original outcomes, acceptance, inputs and generation.
Both canonical findings continued to match their original publication revisions
byte for byte. All nine earlier XHS caller answers also remained byte-identical.

At 17:04:54 UTC, Scout had 12 open/idle Tasks, down from 14, and no active work.
No handler/subscriber failures or SQL errors appeared during this check. Daemon
PID 100753 and active source
`b1714639c2317b681ac0b150b58107c8c8be14ed-definitions-v5` were unchanged.
No restart or definition activation was required.

This demonstrates creator-authorized consumption and closure after real
publication. The decisions were based on fulfilled obligations and checked
evidence. An idle state or Task count alone is not a closure basis. The test used
explicitly routed reminders with exact child references; it does not establish
that ordinary research wakes will discover and close old fulfilled children
without that reminder. That discovery and owner-guidance question remains open.

Commands, before/after Task reads, native session metadata, closure records,
caller answers and byte comparisons are retained under
`/home/hao/workspace-archive/scout-owner-publication-follow-through-20261113/`.
Operations used the [control-plane-operation skill](../../../../shared/skills/control-plane-operation/SKILL.md).
