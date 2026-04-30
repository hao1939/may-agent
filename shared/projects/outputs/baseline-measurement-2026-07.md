# Baseline Correction Rate Measurement — July 2026

**Date**: 2026-07-01
**Window**: Last 30 days (since 2026-06-01)
**Method**: Manual scan of `human-inputs.jsonl` + session metadata

---

## Results

| Metric | Value |
|--------|-------|
| Total human inputs (30 days) | 20 messages |
| Correction/override signals | 2 |
| Neutral directives | 18 |
| **Correction rate** | **10%** (2/20) |
| Tagged corrections in meta.json | 0 (tagging not yet instrumented) |

## Corrections Identified

1. **"No"** (2026-06-29) — Hao rejected May's suggestion to patch the event system directly. Correction: "Let the infra do its job" — separation of concerns.

2. **"So little? I thought we may have thousands"** (2026-06-29) — Mild correction on data scoping. May reported 396 sessions; Hao pushed to look deeper (37k files found).

## Non-Correction Directives (not counted as corrections)

- "look into it and unblock it" — standard task assignment
- "show me stalled projects" — info request  
- "keep pushing forward" — strategic direction (not correcting a mistake)
- "Clean up the house" — priority setting
- "create it" — approval
- "How is the projects going?" — status check

## Assessment

The ~10% rate is at the boundary of our target. However:
- Only 2 of 20 messages were actual corrections (Hao saying "you're wrong/stop")
- Most messages are directives, not corrections of bad autonomous decisions
- The preference-check gate (deployed to May's context.md) should prevent the class of error that triggered correction #1 (patching around infrastructure)

## Measurement Limitations

- `measure-corrections.sh` timed out on 397 session dirs (too slow for full scan)
- No sessions are tagged with `"correction": true` yet — instrumentation not active
- Human-inputs.jsonl is the only reliable source for now
- Keyword-based detection (grep for "no", "stop", "don't") produces too many false positives in session content

## Recommendations

1. **Fix measure-corrections.sh** — use `human-inputs.jsonl` as primary source instead of scanning all session meta.json files
2. **Start tagging** — when May receives a correction via telegram, tag it in the session
3. **Next measurement**: 2026-08-01 (monthly cadence)
