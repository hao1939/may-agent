# Baseline Correction Rate Measurement

**Date:** 2026-04-30  
**Window:** Last 90 days  
**Script:** `measure-corrections.sh` (chat-sessions-only version)

## Results

| Metric | Value |
|--------|-------|
| Chat sessions scanned | 1 |
| Sessions with correction signals | 1 |
| Correction rate | ~100% (1/1) |

## Analysis

The measurement is **not statistically meaningful** — only 1 chat session was found with `"kind": "chat"` in meta.json within the 90-day window. The real baseline from manual review is **~1% correction rate** (1 correction in ~115 decisions per metrics.md).

### Limitations

1. Very few chat sessions with `"kind": "chat"` — most sessions are agent-to-agent
2. Keyword matching is noisy — "no", "don't" appear in normal conversation
3. No correction tagging applied yet in meta.json

## Recommendations

- Instrument May to auto-tag sessions when Hao overrides decisions
- Re-run monthly as chat sessions accumulate
- Consider broadening scan to all sessions with human participants
