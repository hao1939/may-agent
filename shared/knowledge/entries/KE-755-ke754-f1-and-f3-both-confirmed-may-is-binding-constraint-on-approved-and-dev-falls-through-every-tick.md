# KE-755 — KE-754 F1 and F3 both confirmed: may is the binding constraint on `## Approved`, and dev falls through to ad-hoc work every tick

## Observation
KE-754 (2026-05-06 09:55Z) made two falsifiable predictions about the
half-built work-queue substrate. Both have now resolved on the **confirm**
side, well inside their 24h windows.

- **F1 (may = binding constraint)**: confirmed in 4 may heartbeats post-launch.
  Substrate landed at 09:27Z. Since then, may has run 4 completed heartbeats
  (`s_..._88`, `_104`, `_105`, `_125` at 09:28 / 09:55 / 09:56 / 10:25Z) and
  one running (`_126` at 10:27Z). **None** has touched
  `agents/shared/work-queue.md`. The Approved section is still empty
  (`awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' | wc -l = 0`).
  Three of the four may heartbeats produced near-identical outcomes — a
  recitation of KE-749/KE-750 explaining why three red metrics are
  "structural/known issues … requires human decision." The work-queue
  doesn't exist in may's mental model; her heartbeat (`agents/may/heartbeat.md`)
  has zero references to "queue", "approve", or "proposal".

- **F3 (dev fall-through)**: confirmed in 2 of 2 post-launch dev ticks.
  Both `s_1778061227022_102` (09:53Z, 16 ops) and `s_1778063026928_123`
  (10:23Z, 11 ops) have plan text *"Check the approved work queue and
  current metrics/failures"* — the exact ordering dev's new heartbeat
  imposes. Both then produced an investigation/edit that was **not** from
  Proposed. The 10:23Z tick produced an uncommitted timeout-budget tweak
  in `may/handlers/eval-poller.ts` (mtime 10:25:45Z, present in working
  tree, no commit) — a metric-derived fix, not the queued P0 eval-shape
  proposal. KE-754's F3 cost estimate (~12min/tick, ~1h/day re-derived
  work) is on track.

- **Uncommitted dev edit at risk of stash-sweep**: as of 10:27Z,
  `git -C /app/agents status --short` shows
  `M may/handlers/eval-poller.ts` and `M scout/last-session.md` and
  `M evaluator/last-session.md`. The eval-poller change (cap
  MAX_LLM_EVALS_PER_RUN 12→6, add MIN_REMAINING_MS_FOR_LLM_EVAL guard)
  was authored during dev session `_123` but never committed by that
  session. If the heartbeat wrapper's stash sweep runs against dev's lane
  rules (KE-450 mechanism), the edit will silently disappear. This is
  a **second** structural failure mode for the queue: even when dev
  *does* fix something, if it doesn't commit cleanly, the fix evaporates.
  Worth tracking whether this specific change survives the next sweep.

## Evidence
```
$ awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l
0

$ git -C /app/agents log --format='%h %ai %s' shared/work-queue.md
3b5729cd6 2026-05-06 09:57:57 +0000 shared: update work-queue        # arc (this proposal added)
e700a421a 2026-05-06 09:27:53 +0000 work queue: arc proposes → human approves → dev implements
45a44413e 2026-05-06 09:27:33 +0000 may: track shared work queue file
                                    # ← only may commit; pure scaffolding, no Approved entries
```

May heartbeats since substrate launch (4 done, 1 running):
```
09:28:06  s_..._88   3 ops   "...structural/known issues..."
09:55:40  s_..._104  2 ops   "...structural/known issues..."
09:56:16  s_..._105  9 ops   (same theme, 9 ops — investigated red metrics inline)
10:25:40  s_..._125  3 ops   "...structural/known issues..."
10:27:18  s_..._126  running
```

Dev heartbeats since substrate launch (2 done):
```
09:53:47  s_..._102  16 ops  plan: "Check the approved work queue..." → produced no commit
10:23:46  s_..._123  11 ops  plan: "Check the approved work queue..." → uncommitted eval-poller edit
```

May heartbeat content check:
```
$ grep -nEi 'work[- ]?queue|approve|proposal' agents/may/heartbeat.md
(no output — zero references)
```

Coverage signal still flat (5th tick of KE-751's prediction):
```
evaluations_24h:                  22
evaluator_done_24h:              899
ratio:                          0.0245       # 2.75% → 2.9% → 2.75% → 2.66% → 2.45%
```

## Implication
The substrate has now had **5h of live operation** with empty Approved.
The bottleneck is unambiguously may's heartbeat: it has not been
updated to describe its new role (the approval gate), so may is doing
exactly what her heartbeat tells her to — investigating red metrics —
which she correctly identifies as documented-stale and bounces back to
"requires human decision." The whole launch is sitting idle on a
prompt edit.

Three things follow:

1. **One-line edit unblocks the system**: add an explicit priority
   to `agents/may/heartbeat.md` of the form *"Read
   `agents/shared/work-queue.md`. For each item under `## Proposed`,
   either (a) move it under `## Approved` if the proposal is concrete
   and within scope, (b) reject it with a one-line reason, or (c)
   leave it for human review with a rationale. Do this BEFORE
   investigating metrics."* The edit is in may/'s lane (her own
   heartbeat), so a may-authored commit will land. Arc cannot make
   this edit (out of lane) — must propose.

2. **Dev fall-through is downstream of (1)**: dev's heartbeat already
   reads Approved first and only falls through when empty. Once may
   starts approving, F3 should auto-resolve without a separate dev
   change. Conversely, no dev-side fix can route around an empty
   Approved.

3. **The uncommitted eval-poller edit is a tell**: dev *is* doing
   real work, but her commit discipline is conditional on the
   heartbeat completing cleanly. A queue with seeded approved items
   creates a clearer commit boundary ("I implemented Approved item X")
   than ad-hoc metric-derived investigations. Empirically, the two
   post-launch dev sessions produced 0 and ~1 (uncommitted) artifacts;
   the average pre-launch was higher.

## Predictions / Falsifiers
- **F1' (12h)**: if a may-authored commit moves at least one item from
  `## Proposed` to `## Approved` within 12h of this KE, may's heartbeat
  was indeed the binding edit. Verifiable via
  `git -C /app/agents log --author=may shared/work-queue.md`.
- **F2' (24h, paired)**: if eval-shape proposal (now in Proposed) is
  approved AND dev picks it up AND commits a fix, then KE-751's
  evaluation-coverage ratio should rise from ~2.5% to ≥80% within one
  tick after the dev commit. Same falsifier as KE-754 F2; logged again
  because the chain is now 3 stages deep (may-prompt-fix → may-approves
  → dev-fixes → coverage-recovers) and any link can break.
- **F3' (next 2 dev ticks, ~1h)**: if `## Approved` stays empty, the
  next two dev `last-session.md` files will continue to show plan text
  "Check the approved work queue …" followed by an outcome describing
  metric-derived work or pure investigation, not "Implemented
  Approved item X". Three consecutive such ticks = FM1 fully
  structural and an automated nudge (e.g. may-watchdog: alert if
  Approved empty + Proposed non-empty for >2h) becomes worth
  proposing.
- **F4 (12h)**: the uncommitted `may/handlers/eval-poller.ts` edit
  either (a) gets committed by a later dev/may session, (b) survives
  in working tree across sweeps, or (c) silently disappears.
  Verifiable via `git log -- may/handlers/eval-poller.ts` and
  `git status --short`. Outcome (c) would itself be a KE — it would
  mean dev is in a write-then-lose loop on `may/handlers/`, and the
  lane policy needs auditing.

## Lane note
This KE is in `agents/shared/knowledge/entries/` (in-lane). No edits
to `agents/may/heartbeat.md` from this session — that fix is being
proposed via `agents/arc/workspace/proposals/`, per the heartbeat's
out-of-lane rule.
