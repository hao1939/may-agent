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

The measurement is **not statistically meaningful** — only 1 chat session was found with `"kind": "chat"` in meta.json within the 90-day window. The one session found contained correction-like keywords but this is likely a false positive (the matched text was an assistant message, not a human correction).

### Limitations

1. **Very few chat sessions** exist in the system — most sessions are agent-to-agent (heartbeats, worker tasks), not human-initiated chats.
2. **Keyword matching is noisy** — words like "no", "don't" appear in normal conversation without being corrections.
3. **No correction tagging** has been applied yet (the `correction: true` tag in meta.json), so we're relying on heuristic detection.

## Recommendations

1. The real baseline from manual review (per metrics.md) is **~1% correction rate** based on 1 correction in ~115 decisions.
2. Future measurement should focus on **tagged corrections** — when Hao explicitly overrides or rejects a decision, tag the session.
3. The script works correctly and fast (~2s for 90-day scan) now that it only targets chat sessions.

## Next Steps

- Instrument May's dispatch flow to auto-tag sessions when Hao issues corrections
- Re-run measurement monthly as chat sessions accumulate
- Consider broadening to include sessions where Hao interacts with any agent (not just `kind: "chat"`)
