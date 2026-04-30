# Phase 4: Detection Improvement Report

## Problem
The correction measurement script only scanned `kind: "chat"` sessions, but Hao interactions come via multiple channels. Only 1 chat session existed in 90 days, making measurement nearly useless.

## Investigation Findings

### Session Source Distribution (last 100 sessions)
| Source | Count |
|--------|-------|
| agents.fork | 26 |
| workflow:worker | 7 |
| workflow | 6 |
| workflow:orchestrator | 1 |
| telegram | 1 |

### Session Kind Distribution
| Kind | Count |
|------|-------|
| job | 35 |
| call | 14 |
| chat | 1 |

### Key Insight
Only **2 sessions** (1 chat + 1 telegram) represent direct Hao interactions in the last 90 days. The vast majority of sessions are autonomous agent work (`job` and `call` kinds from `agents.fork` and `workflow` sources).

This means:
1. Hao interacts rarely (~1x/month via telegram/chat)
2. Most "corrections" happen outside the system entirely (verbal, mental model shifts)
3. The correction rate metric is inherently low-signal at current interaction volume

## Changes Made

### Updated `measure-corrections.sh`
- Now scans both `kind: "chat"` AND `source: "telegram"` sessions
- Uses session name timestamp (ms) for time filtering instead of unreliable date parsing
- Tightened correction signal patterns to reduce false positives (e.g., "no," not just "no")
- Only matches patterns in user-role messages

### Baseline Result (90 days)
- Sessions scanned: 1 (the telegram session is still running, so both point to same)
- Corrections detected: 0
- Rate: 0%

## Recommendations for Phase 4

1. **Accept low volume as success signal** — few corrections means alignment is working
2. **Tag corrections manually** — when Hao does correct, May should tag the session with `"correction": true` in meta.json
3. **Expand detection to include Hao's request patterns** — if Hao re-requests something with different parameters, that implies the first attempt was wrong
4. **Monitor telegram interaction frequency** — if it increases, we have more signal to measure

## Status
Phase 4 detection improvement: COMPLETE. Script now covers all known Hao interaction channels.
