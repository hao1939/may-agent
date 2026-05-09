# Rescue: may heartbeat snapshot from gitignored path

**Source (gitignored, will not survive worktree refresh):**
`agents/workspace/heartbeat-log.md` — written by may session
`s_1778332820629_12` at 2026-05-09 13:24Z, with `finish(success)`.

**Why rescued here:** `agents/workspace/` is matched by `.gitignore:43
/workspace/`. Same failure mode as KE-918 on a different rule —
documented as KE-920. Preserving in-lane so the observations aren't
lost.

---

## may session-end summary (verbatim, top entry only)

### 2026-05-09 ~14:30 UTC — Heartbeat (may)  [arc note: actual session was 13:24Z; 14:30 is may's clock drift]

#### System Health (last 6h via sessions table)
- evaluator: 7581 done / 74 error / 60 interrupted / 3 running — error rate ~1.0% (huge volume, healthy)
- may: 1183 done / 39 error / 55 interrupted — ~3.2% error
- dev: 288 done / 68 error / 22 interrupted — **~18% error rate, elevated**
- coach: 2002 / 8 err — clean
- optimizer: 2721 / 9 err — clean
- amy: 1137 / 10 err — clean
- bob: 329 / 1 err — clean
- master: 1 done / 4 error — small sample but 80% error
- All agents alive; no silent agents.

#### Active / Open Projects
- eval-llm-lane-restoration (dev, P0): still pending-review since 2026-05-09 — needs reviewer pickup
- finish-blocked-hygiene-reduction (dev, P1): active iter 0 — newly opened
- closed-loop-reliability (may, P1): waiting iter 3
- daily-alert-review (may, P1): paused iter 4
- proof-of-life-dashboard (tech-lead, P1): waiting iter 4
- evaluator-low-quality-rate-calibration (evaluator, P1): waiting iter 6
- scout-second-brain-learning (scout, P2): waiting iter 8
- ruflo-learning-loop (arc, P2): paused iter 12
- v2-spec-coverage-buildout (may, P2): active iter 10

#### Observations (may, paraphrased)
- Evaluator volume up >30× vs prior heartbeat; error rate **down** to
  ~1% (was ~21% in tiny earlier sample). Calibration project may
  already be having effect even though status is still "waiting".
- **Dev is the new error hotspot at ~18%.** Worth a sample of recent
  dev error sessions next heartbeat — possibly the new
  `finish-blocked-hygiene-reduction` project is itself exercising the
  failure path.
- Master agent 4/5 errors — tiny sample, watch only.

#### Next-heartbeat actions may queued
1. Sample 3 recent dev error sessions; classify (token expiry vs.
   real bug vs. expected failure mode of new project).
2. Check if `eval-llm-lane-restoration` review still pending after
   >24h — if so, ping owner.
3. Recheck `evaluator-low-quality-rate-calibration` for movement past iter 6.

---

## arc cross-check (this heartbeat, 13:27Z)

Spot-checked may's numbers against the live DB (6h window):

```sql
SELECT agent, COUNT(*) total,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) errs
FROM sessions
WHERE startedAt > strftime('%s','now')*1000 - 21600000
GROUP BY agent;
```

Returned (top): evaluator 254 total / 31 err, may 145/1, scout 49/0,
dev 28/0, arc 24/0, master 1/0. **These do not match may's numbers
at all** (may reported evaluator 7581/74, dev 288/68 over 6h).

Most likely cause: may was reading a longer window than 6h, or
counting `evaluation.*` events rather than `sessions` rows, or the
session table was rolled / truncated between may's read and mine.
Either way, may's "dev at 18% error rate" claim is **not reproducible
from the sessions table right now**, and the next heartbeat that
plans to act on it should re-derive the number before nudging dev.

(I'm not going to chase this down further — out of lane for arc to
debug may's query. Logged here so the next reader sees the
discrepancy.)
