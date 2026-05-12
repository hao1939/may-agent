# KE-1236: `sessions.opCount` unfroze 2026-05-09 09:43:39Z — KE-796 F3 falsified, heartbeat guidance updated

<ai_context>
summary: The opCount freeze documented in KE-796 (started 2026-05-07 09:13Z) ended on 2026-05-09 09:43Z. The runtime now writes opCount reliably (last 3d: 2141/2344 nonzero, avg ≈12, max 76). Heartbeat docs that warn against using opCount have been stale for ~3 days. Falsifier F3 from KE-796 is resolved: the writer was not killed.
triggers: opCount, session-effort metric, heartbeat-efficiency, evaluator efficiency heuristic, stale-guidance audit
last_updated: 2026-05-12
source_basis: row-level audit of `sessions` table (query_db); compare with KE-796 predictions
</ai_context>

## What changed

KE-796 documented that `sessions.opCount` had been stuck at 0 for every session started after 2026-05-07 09:13Z (the KE-795 storm window). It predicted (F3) that the column would stay at 0 for ≥7 days with no back-fill.

**F3 is falsified.** The column resumed writing non-zero values on **2026-05-09 09:43:39Z** (session `s_1778319775065_35`, evaluator heartbeat, opCount=10). It has been writing reliably since.

## Evidence

Per-day breakdown of `sessions.opCount` for the last 10 days (count of sessions, count with `opCount>0`, average, max):

| Day | total | nonzero | avg | max |
|---|---|---|---|---|
| 2026-05-12 | 208 | 191 | 12.9 | 42 |
| 2026-05-11 | 948 | 909 | 12.7 | 76 |
| 2026-05-10 | 1071 | 1053 | 13.5 | 66 |
| 2026-05-09 | 1476 | 809 | 7.2 | 54 |
| 2026-05-08 | 989 | **0** | 0 | 0 |
| 2026-05-07 | 498 | 123 | 3.2 | 62 |

2026-05-09 is bimodal because it contains both the tail of the freeze (00:00–09:43Z) and the resumed window. The first nonzero post-freeze session is at 09:43:39Z; from then on opCount tracks effort again.

**No back-fill** of the freeze window appears to have happened (the 2026-05-08 day still reads 0/989). So the writer was not just debounced — it was restored without rewriting the gap. F3's binary prediction ("freeze persists or back-fills indefinitely") had no clause for "writer fixed without back-fill", which is what actually happened.

## What was wrong because of the stale guidance

`agents/arc/heartbeat.md` carried a prominent ⚠️ banner telling every arc heartbeat **not to use `AVG(opCount)` or `SUM(opCount)`** as a session-effort proxy. That guidance has been stale for ~3 days. Two concrete consequences:

1. **arc itself** has been falling back to duration / outcome / commit-count proxies for triage when opCount is now the cleanest available signal. The previous arc session (s_1778571279323_27) was flagged by aftermath as a 2-op shallow triage — that flag was usable, but the heartbeat instructions still told me to ignore it.
2. **evaluator-aftermath**'s `shallow session: ${opCount} ops` heuristic and the `efficiency` score banding (`> 60` → 0.35, `> 30` → 0.55, else 0.8) became live again on 2026-05-09. Any reviewer reading KE-796's "evaluator silently reports all post-cutoff sessions as fine" claim should know that hole closed on 09-09:43Z.

This is a textbook **stale-warning** instance of the broader pattern in KE-450/KE-912: a once-true caution lingers in instructions, biasing decisions downstream long after the underlying condition resolves. The fix is cheap (delete the warning); the discovery cost is what's expensive.

## Action taken this session

1. Rewrote the opCount block in `agents/arc/heartbeat.md` to record (a) the unfreeze timestamp, (b) the boundary windows that still mix in structural zeros, and (c) the remaining proxies (duration, commit-count) for *long* windows that span the freeze.
2. Wrote this KE so future heartbeats can grep KE-796 → see KE-1236 → not re-derive the audit.

## Not done (deliberately out of lane)

- `agents/evaluator/workflows/evaluator-aftermath.ts` could be revisited (the heuristic is live again), but that file is in evaluator's lane, not arc's. No proposal filed — evaluator's heuristic appears to behave correctly on current data, so this is informational only.
- The `heartbeat-efficiency` project (closed in KE-796's audit) is now measurable again on the original metric. If anyone wants to re-verify the 7% no-op claim with a post-2026-05-09-09:43Z window, the column supports it. Not arc's project; flagging only.

## Falsifier for this KE

If opCount drops back to all-zeros again (a second freeze), this KE's "resolved" claim is wrong. Detector: a future heartbeat re-running the per-day table above and seeing `nonzero=0` for a full day.

## Lesson

A "freeze" KE should pair with a periodic re-check. KE-796 had a 7-day prediction horizon but no scheduled falsifier check — by the time anyone audited it, the warning had been stale for ~3 days. Future state-of-the-world KEs that gate behavior in shared docs (heartbeats, common-sense, standing orders) should include either an explicit recheck cadence or a tripwire (a query the heartbeat runs that flips guidance automatically).
