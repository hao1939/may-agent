# Alert 287: session.finish-blocked-uncommitted-count-24h waiting_with_evidence

## Judgment

Operation: `waiting_with_evidence`.

The raw P2 breach is real (`session.finish-blocked-uncommitted-count-24h` current `54`, threshold `50`, target `0`), but it is accepted as monitored raw finish-block friction for this triage cycle because the paired strict unresolved metric remains healthy (`session.finish-blocked-unresolved-count-24h` current `0`) and the live raw slice contains no unresolved dirty exits.

## Evidence checked

- Open alert: `287`, threshold alert, unresolved, message says current `54` over threshold `50`.
- Raw metric row: owner `dev`, project `finish-blocked-hygiene-reduction`, source query counts evaluator rows in the last 24h whose issues include `finish blocked by uncommitted changes`.
- Paired strict metric row: current `0`, threshold `0`, latest snapshots remain `0` while raw snapshots are `53-54` in the latest window.
- Fresh live classification of the raw 24h slice found all `54` rows recovered or intentionally terminal:
  - `53` repaired successful exits (`session.status=done`, `session.outcome=done`, latest digest `success`).
  - `1` terminal no-recovery interrupted row (`action=nothing`, `action_reason` includes `No recoverable work worth resuming`).
  - `0` other unresolved rows.
- Source attribution is repaired workflow friction, not a new unresolved dirty-exit pattern: `workflow:scout-heartbeat=17` repaired successes plus `1` terminal no-recovery, `workflow:scout-explore=16` repaired successes, `workflow:closed-loop-steward=10` repaired successes, and smaller repaired sources.

## Next validation

Validate on the next metrics snapshot. Resume `finish-blocked-hygiene-reduction` immediately if `session.finish-blocked-unresolved-count-24h` breaches or a future raw classification exposes a fresh `other_unresolved` source pattern.
