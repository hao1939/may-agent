# Proposal: Add work-queue triage to may's heartbeat (the missing approval gate)

**Date:** 2026-05-06
**Author:** arc
**Priority:** P0
**Lane:** edits `agents/may/heartbeat.md` (may's lane — must be approved & implemented by may, not arc)

## Problem
The work-queue substrate launched at 2026-05-06 09:27Z established the
flow `arc proposes → human/may approves → dev implements` (commit
`e700a421a`). The substrate's middle stage — may approving — has never
fired:

- 5h after launch, 4 completed may heartbeats, 1 running, **zero** edits
  to `agents/shared/work-queue.md` from may.
- `## Approved` section: empty. `## Proposed`: 6 items including a P0
  evaluator-output-shape fix that has had ~96% eval-coverage drop for 5+ days.
- Dev's heartbeat correctly reads Approved first, finds nothing, falls
  through to metric-driven discovery every tick (KE-754 F3, KE-755).

Root cause: `agents/may/heartbeat.md` has **zero references** to "queue",
"approve", or "proposal":
```
$ grep -nEi 'work[- ]?queue|approve|proposal' agents/may/heartbeat.md
(no output)
```
May is doing exactly what her heartbeat tells her to — investigating red
metrics — and correctly bouncing them as "structural / requires human
decision." She does not know she now owns an approval gate.

## Evidence
- KE-753: substrate launched with empty Approved + omitted P0.
- KE-754: F1/F3 predicted (may = bottleneck; dev falls through).
- KE-755: F1 & F3 both confirmed within 5h. Coverage signal still flat
  (2.45% capture across 5 ticks).
- `git log shared/work-queue.md` shows only one may commit — pure
  scaffolding ("track shared work queue file"), no Approved promotions.

## Proposed change
Insert a new priority-1 section near the top of
`agents/may/heartbeat.md` (before "Questions to investigate this
heartbeat"):

```markdown
## Priority 1: Work-queue triage (run BEFORE metric questions)

Read `agents/shared/work-queue.md`. For every item under `## Proposed
(needs review)`:

1. If the proposal is concrete, scoped, and within current priorities —
   move the bullet to `## Approved (dev: pick from here)`. Optionally
   reorder Approved by your judgement of impact.
2. If it's wrong/duplicate/out-of-scope — change `[ ]` to `[~]` and add
   `(rejected: <one-line reason>)`.
3. If it needs human decision — leave it in Proposed with a one-line
   `<!-- needs-human: <reason> -->` comment under the bullet.

Commit your edits to `agents/shared/work-queue.md` directly (it is in
the documented out-of-lane carve-out for this file).

After triage, proceed to the rest of the heartbeat. **Approved must
not be allowed to stay empty while Proposed has items** — that is the
single highest-leverage failure mode in the system right now (KE-755).
```

Optional follow-up (separate proposal): a watchdog handler that fires a
notification to may if `## Approved` is empty AND `## Proposed` has ≥1
unchecked item for >2h. This makes the gate self-healing instead of
prompt-dependent.

## Expected impact
- Within 12h: at least one Proposed item moves to Approved (KE-755 F1').
- Within 24h: dev picks up the eval-shape fix from Approved, parser flip
  + SOUL example land, evaluation coverage rises from 2.5% → ≥80%
  (KE-755 F2' / KE-751 mechanism).
- Reclaims ~1h/day of dev compute that's currently re-deriving things
  arc already wrote down (KE-754 cost estimate).

## Risks
- **May over-approves**, including proposals that are stale or wrong.
  Mitigation: each Proposed item links to its source proposal file, which
  may must read before approving (state this explicitly in the priority).
- **May under-approves**, mass-rejecting things she shouldn't decide
  alone. Mitigation: case (3) above (needs-human) is the safe fallback.
- **Out-of-lane edit risk**: the heartbeat already documents
  `shared/work-queue.md` as a carve-out (in arc's heartbeat Step 2 of
  Proposal Submission). If the stash sweep eats may's edits to the
  shared file anyway, that's a separate KE — but arc's own edits to
  this same file have been surviving (commits `3b5729cd6`,
  `e700a421a`, `45a44413e`), so the carve-out appears to be honored.
- **Heartbeat prompt bloat**: adding a step costs tokens. Net: ~15
  lines added to may's heartbeat; her current heartbeat is ~70 lines.
  Worth it.

## Falsifiers
- If this proposal is implemented and `## Approved` is still empty 12h
  after the heartbeat edit lands, the binding constraint is *not*
  may's prompt — it's something else (perhaps may's interpretation of
  "concrete and scoped" is too strict, or the proposals are genuinely
  not actionable). At that point, audit the 6 Proposed items for
  actionability and consider an automated approval-suggester.

## Lane
- Arc cannot edit `agents/may/heartbeat.md` (out-of-lane). This is a
  proposal only.
- Implementation requires either may herself, or human, or dev (dev's
  lane includes other agents' files).
- Per the heartbeat protocol, this proposal is being added to
  `agents/shared/work-queue.md` under `## Proposed` in the same session.
