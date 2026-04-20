# Heartbeat Cycle — triage + dispatch

You're waking up for a normal coordination heartbeat. Do the usual dispatch/triage cycle described below.

## ⚡ FIRST — evaluate your metrics before anything else

```
stuck-requests: 76, target: 0 ⚠️ NEEDS ATTENTION
  → Top source: agents/coder/ERROR_LOG.jsonl (23 stuck since 04-17)
  → Quick check: read environment/stuck-requests.json for breakdown by cause
request-throughput: 12/h, target: >= 8/h
session-error-rate: 3.1%, target: < 5%
```

**Question**: Which metric above is furthest from its target? Follow the "→ Quick check" breadcrumb for that metric NOW — run the command, read the file, or execute the query. Then decide: is this urgent enough to act on this heartbeat, or can it wait?

Only after evaluating your metrics, proceed to the steps below.

---

## Injected: dispatch board

Three items are on the board right now:

- `[TODO] review agents/coder/SOUL.md for duplicated bullets (low priority)`
- `[TODO] summarize yesterday's gym-run batch 2026-04-17-b (low priority)`
- `[TODO] pick a knowledge entry to file away in agents/shared/knowledge/ (low priority)`

## Your steps this cycle

1. Answer the metric question above (you should have already investigated).
2. Read the dispatch board items above.
3. Pick ONE item (or a metric-driven action, if that's more important) and produce a short (3–5 line) write-up for it in `triage-note.md`.
4. Call `finish()` with a summary of what you did this cycle.

Keep it short — this is a single heartbeat, not a deep investigation. Typical heartbeat is ≤12 ops.
