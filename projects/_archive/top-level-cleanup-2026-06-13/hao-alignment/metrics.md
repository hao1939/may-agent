# Correction Rate Baseline Measurement

**Date**: 2025-06-29
**Period**: Last 30 days (sessions modified within -mtime 30)

---

## Summary

| Metric | Value |
|--------|-------|
| **Correction Rate** | **~0.6%** (estimated) |
| Total autonomous sessions (kind: "job") | 312 |
| Total call sessions (kind: "call") | ~84 (extrapolated) |
| Chat sessions (kind: "chat") | 12 |
| Sessions with actual human (Hao) input | 2-4 |
| Detected correction signals | ~2 |

---

## Methodology

### Data Sources
1. **Session metadata** (`/app/.state/sessions/*/meta.json`) — 396 sessions modified in last 30 days
2. **Session transcripts** (`session.jsonl`) — only 396 had content; most chat sessions lacked transcripts
3. **Chat sessions** — 12 sessions with `"kind": "chat"` in the 30-day window

### How Corrections Were Counted
- Searched for `"User replying"` pattern in session.jsonl (indicates actual Hao input routed to agents): **2 sessions found**
- Searched user-role messages for correction keywords: `don't`, `stop`, `wrong`, `undo`, `revert`, `shouldn't`, `cancel`, `reject`, `no,` — with exclusion of system-injected task prompts
- Result: **~2 messages** with correction-like patterns in real human input

### How Autonomous Decisions Were Counted
- **312 job sessions** (heartbeat-triggered autonomous work)
- **49 explicit fork/call dispatches** found in transcripts
- Total autonomous decision surface: **~361 autonomous actions**

### Correction Rate Calculation
```
correction_rate = corrections / (autonomous_decisions + corrections)
                = 2 / (361 + 2)
                = 0.55%
```

---

## Caveats & Limitations

1. **Low observability of Hao input**: Only 12 chat sessions existed; only 1-2 had transcripts. Most Hao corrections may happen outside the system (e.g., direct Claude Code sessions in `.claude/` which don't persist full transcripts).

2. **Correction signal detection is noisy**: Keywords like "actually" and "instead" appear in system prompts. We filtered to only real human input but may miss subtle corrections.

3. **Denominator uncertainty**: Not all 312 job sessions represent meaningful decisions — many are heartbeat no-ops. The true "decision count" (actions that could be wrong) is likely 50-150.

4. **Adjusted estimate**: If we use 100 meaningful decisions and 2 corrections: `2/102 = ~2%`. If we use all 361: `2/363 = ~0.6%`.

5. **Best estimate range: 0.5% - 2.0%** correction rate.

---

## Baseline Declaration

**Baseline correction rate: ~1% (midpoint estimate)**

This serves as the pre-preference-model baseline. Future measurements should:
- Instrument chat sessions to reliably capture all Hao inputs
- Tag corrections explicitly (e.g., a "correction" flag in meta.json)
- Track preference-model query hits vs misses
- Re-measure after 30 days of preference model operation

---

## Next Steps for Better Measurement
1. Add correction tracking to the session system (when Hao overrides an agent action, log it)
2. Instrument the preference model to log when it prevents an action Hao would have corrected
3. Set up A/B comparison: decisions with vs without preference model consultation
