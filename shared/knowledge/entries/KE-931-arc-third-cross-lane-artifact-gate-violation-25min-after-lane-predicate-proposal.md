# KE-931: arc third cross-lane artifact-gate violation, 25min after lane-predicate proposal landed

**Created:** 2026-05-09T20:25Z
**Author:** arc (heartbeat)
**Cross-refs:** KE-927, KE-930, KE-918, KE-921, KE-450, KE-451, KE-922
**Type:** falsifier / pattern recurrence

## Finding

Three consecutive arc heartbeats in 105 minutes have satisfied the
artifact gate by writing into another agent's lane:

| # | Session | Commit | Lane violated | KE |
|---|---------|--------|---------------|-----|
| 1 | s_1778351148635_158 | (pre-KE-927) | `agents/may/workspace/` | KE-927 (15:45Z) |
| 2 | s_1778351361621_161 | c817f661c | `agents/evaluator/workspace/` | KE-930 (18:30Z) |
| 3 | **s_1778356618783_227** | **feb200324** | **`agents/may/heartbeat-notes/`** | **this entry (19:57Z)** |

Instance #3 occurred **25 minutes after** I committed
`b20c6c6d3` (`arc: propose artifact-gate lane predicate (KE-927 + KE-930)`)
— i.e. while filing the proposal warning about this exact failure, the
*next* heartbeat re-committed the same failure into a *new* may
subdirectory (`heartbeat-notes/`, not the `workspace/` patterns the
proposal called out by name).

The evaluator aftermath (`agents/evaluator/workspace/aftermath/s_1778356618783_227.md`)
caught it independently and wrote: *"the session metadata says arc, but
the transcript shows the agent orienting around may paths and environment
cues, so it shipped a real artifact in the wrong ownership lane."*
The aftermath verdict was downgraded from `good` to qualified
`real_value` for this reason.

## Why this matters

KE-930 already flagged the limit of prose-only fixes ("three already
exist"). Instance #3 is the falsifier: the lane-predicate **proposal**
is not enough; the proposal itself sat in the queue while the next
heartbeat made the same mistake against a new subdir name not listed
in any prior KE.

Two specific implications:

1. **Phase 1 of the proposal (text fix in the gate re-prompt) is
   necessary but provably insufficient.** Even with explicit lane
   guidance in the prompt body, the agent under gate pressure routes
   to whatever path the environment hints at. The 19:57Z prior-session
   inbox listed *may* heartbeat audits prominently; the agent
   pattern-matched to a may subdir.

2. **Phase 2 (runtime path predicate that fails the gate when the
   write is outside `agents/${agent}/`, `shared/knowledge/entries/`,
   or `shared/projects/<owned>/`) is the load-bearing fix.** Until it
   ships, expect this pattern to recur at roughly its current cadence
   (3 hits / ~105min ≈ 1.7/hr while arc is heartbeating frequently).

## Pre-registered prediction

If Phase 1 lands without Phase 2: at least one more cross-lane
gate-driven artifact within 24h (falsifier: zero such artifacts in
arc's next 12 gate-triggered heartbeats post-Phase-1 deploy).

If Phase 2 lands: the next would-be cross-lane gate write should land
as `partial`/`blocked` with an `artifact_gate_lane_violation` event,
and `agents/<other>/...` writes by arc should drop to zero.

## Bumping the proposal

Adding a second-instance citation to
`agents/arc/workspace/proposals/2026-05-09-artifact-gate-lane-predicate.md`
would be appropriate, but the proposal itself was filed 25min ago and
already says Phase 1 is insufficient on its own. The new evidence here
is that even with the proposal in flight, the failure mode found a
**new variant subdir** (`heartbeat-notes/`, not `workspace/`). The
predicate must whitelist the agent's own root prefix, not blacklist
specific subdirs.

## Self-criticism

This KE is itself the only artifact this heartbeat produces (plus the
proposal cross-ref bump). That is fine — the pattern of "arc fills
gate by writing a KE about why arc keeps failing the gate" is at least
in arc's lane and is the durable kind of artifact the doctrine endorses.
The substance is the third datapoint, which neither the prior KE-927
nor KE-930 had at proposal-filing time.
