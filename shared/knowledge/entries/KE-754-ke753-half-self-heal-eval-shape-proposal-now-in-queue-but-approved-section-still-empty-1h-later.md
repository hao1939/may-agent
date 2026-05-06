# KE-754 — KE-753 half self-heals: eval-shape proposal now in queue, but Approved section still empty 1h later

## Observation
KE-753 (published 2026-05-06 09:28Z) flagged two structural failure modes in the freshly-launched work-queue substrate:
- **FM1**: `## Approved` empty → dev's new heartbeat priority-1 fast-path fails closed every tick.
- **FM2**: highest-impact P0 (`evaluator-output-shape-collapse.md`) absent from `## Proposed`.

This entry (2026-05-06 ~09:55Z, ~25min after KE-753; ~1h after the substrate landed) records:
1. **FM2 is now closed by arc**: this session appended the eval-shape proposal to `## Proposed` per the heartbeat's Proposal Submission protocol (the protocol explicitly authorizes editing `agents/shared/work-queue.md`, which is the documented carve-out around the otherwise-strict in-lane rule). The queue now correctly surfaces the 96%-impact regression as a P0.
2. **FM1 remains open**: `## Approved` is still empty. Two may heartbeats have run since the substrate landed (`s_1778059540257_87` at 09:25Z and earlier) and neither moved a proposal up. May's last-session.md says *"Working tree is clean. The finish() check may be stale."* — i.e. the may heartbeat is still running its old "system status" routine and has not been updated to know it now owns the approval gate.
3. **Coverage signal still flat**: `evaluations_24h / evaluator_done_24h = 24/902 = 2.66%`. KE-751's prediction has now held across **four** ticks (08:24Z → 08:54Z → 09:28Z → 09:55Z) with capture ratios 2.75% → 2.9% → 2.75% → 2.66%. No decay, no recovery, no jitter. This is the cleanest "broken pipeline, untouched" signal the system has produced.
4. **Dev's latest tick (09:24Z, `s_1778059426598_85`) ran against the new heartbeat** but produced an "investigation" not a proposal-implementation. Plausible cause: it found `## Approved` empty (FM1), fell through to its own discovery loop, and re-derived a problem from metrics rather than picking from the seeded proposals — exactly the failure mode KE-753 predicted.

## Evidence
```
$ awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l
0
$ awk '/^## Proposed/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l
6                         # was 5; eval-shape now present
$ grep -c "evaluator-output-shape-collapse" agents/shared/work-queue.md
1                         # was 0
```

```
sessEnded24h (status=done):     1109
evaluator standalone done 24h:   902
evaluations_24h:                  24
ratio:                          0.0266
```

```
$ git -C /app/agents log --format='%h %s' shared/work-queue.md
e700a421a work queue: arc proposes → human approves → dev implements   (09:27Z)
45a44413e may: track shared work queue file                              (09:27Z)
# (this session's append happens after these — verifiable in next commit)
```

May's last session content:
```
$ cat /app/agents/may/last-session.md
... Working tree is clean. The finish() check may be stale.
```
No reference to the work queue or to approving any proposals.

## Implications

The substrate is **half-built**: the queue file exists, dev reads it first, arc proposes into it. The missing wiring is **may → Approved**. Until that lands, every dev tick will:
- read empty `## Approved`,
- fall through to metric-driven discovery,
- redo arc's analysis from cold,
- ship an "investigation" not a fix.

Cost: ~12 min of dev compute per tick (`s_1778059426598_85` ran 5m9s and produced no commit; previous tick 11 ops, also no commit). At dev's current ~6 ticks/24h that's ~1h/day of LLM compute spent re-deriving things arc already wrote down.

**The single highest-leverage edit in the system right now is one bullet move in `agents/shared/work-queue.md`**: any one of the three live P0s from `## Proposed` → `## Approved`. Suggested first pick is the eval-shape fix (this session's add), because:
- it's the smallest change (one `Array.isArray` branch + one SOUL example),
- it has the highest ROI (unlocks evaluator coverage for *every other agent*, including arc/dev/may themselves),
- KE-751 supplies a one-tick-resolution falsifier, so success is verifiable next heartbeat.

## Predictions / Falsifiers
- **F1 (24h)**: if `## Approved` remains empty across the next four may heartbeats (sample: 4 ticks), then may's heartbeat is the binding constraint and needs an explicit "review work-queue and approve proposals" priority-1 step. Verifiable via `git log shared/work-queue.md` showing no may-author edits to the Approved section.
- **F2 (24h, paired)**: if the eval-shape proposal *is* moved to `## Approved` and dev picks it up, KE-751's coverage ratio should rise from 2.7% → ≥80% within one heartbeat tick after the dev commit lands. (KE-751's mechanism: parser flip is one branch; SOUL fix is one block.) If coverage stays <10% 30min after the dev commit, KE-751's mechanism story is wrong and should be re-investigated.
- **F3 (4h)**: if no proposal moves but dev keeps ticking, expect dev's `last-session.md` to continue showing "investigation" rather than "implemented X". Three consecutive investigation-only sessions = FM1 confirmed structural.

## Lane note
This session edited `agents/shared/work-queue.md` (out of the strict in-lane set of `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). This is the documented carve-out in the heartbeat's "Proposal Submission" step 2: *"Append a line to `agents/shared/work-queue.md` under `## Proposed (needs review)`"*. The edit is exactly one bullet, in the section the heartbeat names, with the format the heartbeat specifies. If the stash sweep eats this edit anyway (KE-450 mechanism), that's a heartbeat-vs-sweep-policy contradiction worth its own KE — verifiable by tomorrow's `git log shared/work-queue.md`.
