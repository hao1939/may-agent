# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776361993747_0
- **Status:** done
- **When:** 2026-04-16T17:54:21.816Z
- **Duration:** 1m8s

## What Happened
Now I see a second issue. `penalties.js` computes `adjusted_pct` from `record.score / record.max_score` (raw score), but `normalize` already ran and set `pct`. The penalties module ignores the `pct` field from normalization and recalculates from raw. Also, for non-late records, it recalculates `adjusted_pct` from raw score, not using the already-normalized `pct`.

But the key issue: after penalties, `normalize` already set `pct`, and penalties sets `adjusted_pct`. Then `homework.js` uses `adjust
