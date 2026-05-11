# Finish-Blocked Raw Alert 287 Recheck

## Context

Heartbeat triaged repeated alert `session.finish-blocked-uncommitted-count-24h` after ten consecutive owner-visible alerts. The alert is dev-owned, priority P2, and measures raw finish attempts blocked by uncommitted changes over 24h.

## Evidence

- Metric row: `session.finish-blocked-uncommitted-count-24h` current `56`, threshold `50`, target `0`, alert op `>`, status `active`, priority `P2`.
- Paired strict metric: `session.finish-blocked-unresolved-count-24h` current `0`, threshold `0`, target `0`, priority `P1`.
- Recent snapshots show raw drifting `58 -> 57 -> 56` while strict remains `0` across the same window.
- Live raw 24h classification found `56` rows: `53` repaired successful exits, `1` repaired partial exit, and `2` interrupted rows not represented in the simple session.end-only classification; the strict metric still resolves them to zero unresolved cases.
- Source/verdict attribution is dominated by repaired workflow friction: `workflow:scout-explore good=13`, `workflow:scout-heartbeat good=12`, plus smaller repaired steward/may/arc buckets.
- The latest sampled raw rows are `status=done`/`outcome=done` and evaluated `good`, except for known `committed runtime handoff files` cases and historical interrupted rows already covered by evaluator aftermath or strict calibration.

## Judgment

Chosen operation: `document_exception` / waiting-with-evidence. The breach is real raw friction, but it is not currently evidence of unresolved dirty exits because the paired strict metric remains healthy at zero and the raw slice is dominated by recovered sessions.

No root-cause patch is indicated in this heartbeat: prior prompt/guard/evaluator fixes already turned most raw cases into successful or acceptable recoveries, and strict unresolved monitoring is the safer resume trigger for the paused `finish-blocked-hygiene-reduction` project.

## Next Validation

Validate on the next metrics snapshot. Resume `finish-blocked-hygiene-reduction` only if `session.finish-blocked-unresolved-count-24h` breaches again or fresh raw sampling exposes a new non-recovered source pattern.

If repeated P2 triage churn continues while strict remains zero, May/human should decide whether to record a formal low-priority exception/calibration for the raw metric through the safe runtime write path.
