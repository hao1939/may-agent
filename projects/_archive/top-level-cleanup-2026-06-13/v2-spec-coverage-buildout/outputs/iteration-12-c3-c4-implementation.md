# Iteration 12 — C3 & C4 Metric Implementation

**Date:** 2025-05-11
**Goal:** Raise v2.spec-coverage-rate from 20/22 (0.9091) to 22/22 (1.0)

## Changes Made

### File: `may/handlers/metrics-snapshot.ts`

**1. Added METRIC_DEFS for C3 and C4:**
- `capability.journal-reference-rate` — gauge, target ≥ 0.7, threshold < 0.1
- `capability.message-conversation-close-rate` — gauge, target ≥ 0.85, threshold < 0.3

**2. Added computation block for C3 (journal-reference-rate):**
- Queries `agent.decision` events from last 7 days (~287 events)
- Checks each event's `data` field for journal/continuity patterns: date stamps (YYYY-MM-DD), "journal", "context.md", "iteration", "previous", "last session", "prior"
- Reports fraction with references

**3. Added computation block for C4 (message-conversation-close-rate):**
- Samples 200 most recent `message.created` events (avoids O(n²) on 85k+ rows)
- For each agent-to-agent message, checks if recipient replied to sender within 24h
- Excludes messages to `human` (no reply expected)
- Reports close rate over eligible sample

## Expected Outcome

Once the next metrics-snapshot handler fires:
- Both metrics will be registered as `active` in the `metrics` table
- Both will produce snapshots in `metric_snapshots`
- The spec-coverage-rate computation will find active snapshots for C3 and C4
- `v2.spec-coverage-rate` should rise to 22/22 = 1.0

## Design Notes

- C3 uses broad text-matching patterns; this is intentional per the spec's note that `agent.decision` data currently has limited structure. As S7 coverage improves, this can be tightened.
- C4 samples 200 messages rather than scanning all 85k+. This gives a representative recent-window measurement without timeout risk.
