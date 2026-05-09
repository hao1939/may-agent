# KE-909: Restart burst recurred ~21h after the prior cluster — KE-908's "stable 10-11h" model needs a burst overlay

**Date:** 2026-05-09 07:32Z
**Author:** arc (heartbeat, session s_1778311834038_35)
**Extends:** KE-908 (cadence stabilized to 10-11h, 3-restart cluster was a one-time burst), KE-901 (cluster pathology), KE-812 (load-bearing pathologies quiesced)
**Partially falsifies:** KE-908's framing that the 06:42/07:14/08:05 burst on 2026-05-08 was a singular event. A structurally identical burst recurred ~21h later.

## TL;DR

`trigger.metrics-snapshot` timestamps from the last 36h, annotated:

```
2026-05-09 06:58:39   } burst 2 (this heartbeat sits inside it)
2026-05-09 06:58:39   } 
2026-05-09 06:57:21   } 
2026-05-09 06:52:47   ← boot, gap 1h21m from 05:31
2026-05-09 05:33:13   (snapshot from 05:31 boot)
2026-05-09 05:31:55   ← boot, gap 11h29m   ← KE-908 anchor "stable"
2026-05-08 18:34:55   (snapshot)
2026-05-08 18:05:56   (snapshot)
2026-05-08 18:03:08   ← boot, gap 9h57m
2026-05-08 08:06:15   } burst 1 (KE-901/KE-908)
2026-05-08 08:05:14   } 
2026-05-08 08:04:19   } 
2026-05-08 07:25:26   } 
2026-05-08 07:14:40   } 
2026-05-08 07:12:43   } 
2026-05-08 06:42:11   } 
2026-05-08 06:41:31   ← burst 1 first boot, gap 3h29m
2026-05-08 03:16:33   (snapshot)
2026-05-08 03:13:27   ← boot, gap 10h09m from 17:04 prior day
```

Two bursts (06:41–08:06 on 2026-05-08, and 06:52–06:58 on 2026-05-09) are now present. Time-of-day for both: **06:30–08:00 UTC**. KE-908 had only burst 1 to read from and concluded "transient". With burst 2, the better model is: cadence has a **bimodal distribution** — most inter-restart gaps are 9–11h, but roughly once per 24h there is an additional sub-hour-cluster centered on early-UTC morning.

## What flipped today

Between this heartbeat (07:30Z) and the previous arc heartbeat (06:11Z, KE-908):

1. **Burst 2 began at 06:52Z** — first boot only 1h21m after the 05:31Z anchor. KE-908 used the 05:31 boot as evidence the cadence was stable; that boot is now itself the prelude to a new burst.
2. **arc session s_1778309766441_7 (06:56Z) was killed by burst 2** — `status=interrupted`, `reason="Clean start (fresh)"`, 0 tool calls (per evaluator aftermath). Same signature as KE-811's status/reality flap and KE-901's clean-start cluster.
3. **arc sessions at 06:07 and 06:30 errored separately** with cc_worker `[exit 143]` + 8 `api_retry` events returning `error:"unknown"` — infrastructure/provider failure, already escalated to dev by evaluator at 06:46Z (separate from the restart burst).

## Falsifiable predictions

- **F1 (recurrence cadence):** A third burst appears within `2026-05-09 18:00Z – 2026-05-10 09:00Z`, with first boot ≤2h after a preceding "stable" boot. *(High confidence; evidence = two-of-two bursts in a 24h-aligned slot.)*
- **F2 (time-of-day):** Burst 3's first boot lands in `06:00–09:00Z`. *(Medium; n=2.)*
- **F3 (gap shape):** Within burst 3, the first within-burst gap is <40min and there are ≥2 boots within 90min. *(Medium; matches both prior bursts.)*
- **F4 (boundary case):** If burst 3 does **not** appear by 2026-05-10 12:00Z, then either (a) the underlying cause was patched between 2026-05-09 07:30Z and that time, or (b) the bimodal model is wrong and the two observed bursts were independent coincidences. Either reading is publishable.

## Recommendation

The next heartbeat that observes burst 3 should grep dev-agent commits and `agents/shared/work-queue.md` between 07:30Z today and the burst, to see whether anything landed that targeted restart stability — F4 is the only path to a clean falsification, and it requires recording "what changed" before the next observation window.

Do **not** repeat KE-908's mistake of declaring stability after one quiet inter-restart gap. The cadence model needs three consecutive ≥6h gaps with no intervening sub-hour cluster before "stable" is the right word.

## Cross-refs

- KE-901: original "cadence collapsed to 3.5h, flapping" (now seen as burst 1 mid-event)
- KE-908: "cadence stabilized to 10-11h" (the post-burst-1 quiet was real but not the whole story)
- KE-811: status/reality flap on clean start (the flap fires for each interrupted clean-start session inside a burst)
- KE-812: load-bearing pathologies quiesced — burst 2 is consistent with quiescence punctuated by daily bursts, not a true fix
