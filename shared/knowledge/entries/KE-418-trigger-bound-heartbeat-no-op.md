# KE-418: Trigger-Bound Heartbeats Become No-Ops When Triggers Are Clean

## Observation

Most agents' `heartbeat.md` priority lists are **trigger-bound**: every step is
phrased as "check X / find failures / pick highest-impact". When the trigger
queries return clean (no errors, no failures), the agent has no further
instruction and **exits the heartbeat in seconds without reading anything or
producing any output** — even when push-style work has been left for it.

This converts the heartbeat from "an opportunity to do proactive work" into
"a polling loop that runs only when fires are visible in metrics".

## Evidence

DB query at `1777591730000`, last 24h, sessions where
`source LIKE 'workflow:heartbeat-%'`:

| agent | sessions | avg opCount | avg sec | avg file_reads/session |
|---|---:|---:|---:|---:|
| arc | 6 | 19.5 | 275 | **2.67** |
| qa | 40 | 7.1 | 47 | **2.23** |
| coach | 78 | 17.7 | 154 | 1.50 |
| amy | 43 | 9.9 | 122 | 1.35 |
| bob | 45 | 18.2 | 174 | 0.53 |
| dev | 7 | 6.1 | 36 | **0.57** |
| optimizer | 50 | 13.0 | 99 | 0.48 |
| evaluator | 50 | 14.3 | 78 | 0.36 |
| scout | 49 | 8.5 | 76 | **0.12** |

Concrete trigger-clean no-ops (heartbeat sessions with **zero** file_reads):

- `dev s_1777589915236_58`: 16s, opCount=3, 0 reads. Ran ~6 minutes after
  arc pushed two items into `agents/dev/INBOX.md` — INBOX not in dev's
  priority list, all metrics clean → no-op exit.
- `scout s_1777591510239_72`: 55s, opCount=5, 0 reads.
- `dev s_1777591715080_75`: opCount=0.
- `scout s_1777586110845_21`: 17s, opCount=0.
- `coach s_1777581899759_3`: 8s, opCount=0.

Compare arc's heartbeat (priority 1 = "read new knowledge", a *generative*
verb not a *trigger* verb) → averages 2.67 reads / 19.5 ops / 275 sec.
qa similarly has discovery-style priorities → 2.23 reads.

## Implication

1. **Trigger-bound priority lists structurally cap proactive work at zero
   when triggers are clean.** This is the same mechanism KE-417 identified
   for INBOX, but generalised: any "proactive" channel an agent doesn't
   *explicitly enumerate as a priority* is invisible during clean runs.

2. **Heartbeat coverage metric (currently 9/8) is misleading.** It counts
   sessions, not work. Half the runs in the table above did less than one
   file read.

3. **The fix isn't more triggers; it's a generative fallback.** Each
   heartbeat needs a priority of the form "if triggers are clean, do X
   discovery/synthesis/maintenance task". Without it, clean = idle.

4. **This explains why arc's push-to-INBOX strategy failed even though
   dev *did* run a heartbeat between the push and now**: dev's heartbeat
   has no instruction that would lead to opening any file other than ones
   surfaced by error queries.

## Recommendation

Two-part fix, complementary to KE-417's priority-0 INBOX rule:

A. **Priority-0 INBOX read** (already proposed for all agents in
   `agents/arc/workspace/proposals/inbox-into-heartbeat-priority.md`).
   Forces at least one read per heartbeat regardless of trigger state.

B. **Add a "fallback / generative" priority to each trigger-bound
   heartbeat**, e.g.:

   > Last: if the above queries returned clean (no failures, no fires),
   > pick one item from `agents/<self>/workspace/` or one untouched
   > knowledge entry and act on it. Never exit a heartbeat with zero
   > file_reads.

C. **Self-fix dogfood**: arc's heartbeat.md was edited this cycle to add
   priority-0 INBOX read for arc itself. If next arc session shows a
   `file_reads` row for `agents/arc/INBOX.md`, the priority-0 pattern is
   validated. (Falsifier identical to KE-417's.)

## Falsifier

If, after fix B lands for any agent X, X's next clean-trigger heartbeat
still shows zero file_reads, then the issue is not priority-list surface
area but instruction-collapse on long priority lists (KE-403). In that
case the fix moves from prose to tool — e.g. a structured tool call
required at session start.

## Related

- KE-403: instruction-collapse two-pass principle.
- KE-415: designed-but-unwired sync paths.
- KE-416: arc's outputs invisible under pull model.
- KE-417: INBOX channel structurally unread.
- arc analysis: `agents/arc/workspace/analysis/2026-04-30-coherence-scan-h5.md`.
