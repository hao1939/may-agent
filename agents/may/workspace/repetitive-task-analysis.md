# Repetitive Task Analysis — Budget Waste Identification

**Date**: 2026-04-16  
**Data source**: `.state/may.db` sessions since 2026-04-09

## Top 3 Repetitive Tasks Wasting Budget

### 1. Echo/Probe Sessions (74 sessions, ~148 wasted ops)

**What**: `echo hello`, `echo testing`, `checkpoint` — test/probe sessions that do nothing useful.
- Bob: 60 `echo hello` + 19 `checkpoint` = 79 sessions
- Optimizer: 8 `echo hello`
- Others: ~5 scattered

**Root cause**: Likely health checks or startup probes that create real sessions instead of lightweight pings.

**Automation plan**: Add a probe filter in the session creation path — if task matches `/^echo\b/` or is exactly `checkpoint`, skip session creation and return a synthetic OK response. Saves ~148 ops/week.

### 2. Evaluator JSON Retry Loops (53 retry sessions, ~371 wasted ops)

**What**: Evaluator fails to output valid JSON scores, gets a retry message: "Your previous response did not contain a valid JSON scores block." Each retry is a new session averaging ~7 ops.

**Root cause**: The evaluation prompt sometimes produces malformed JSON. The retry mechanism creates a whole new session instead of retrying within the same session.

**Automation plan**: 
- **Quick fix**: Add a JSON extraction post-processor — use regex to extract `{...}` from evaluator output before declaring failure. Many "failures" likely have valid JSON buried in prose.
- **Better fix**: Switch to structured output / function-calling for the evaluation response format.
- Estimated savings: 53 sessions × 7 ops = 371 ops/week.

### 3. Coach cron:reflect — High Volume (1,822 sessions, ~24,600 ops)

**What**: Coach reflection runs every cycle, averaging 13.5 ops per session. This is the single largest op consumer among cron tasks (24,600+ ops total).

**Root cause**: Reflection runs unconditionally every heartbeat cycle regardless of whether there's new data to reflect on.

**Automation plan**:
- **Add a staleness check**: Before running full reflection, check if any new evaluations/sessions exist since last reflection. If not, skip with 1-2 ops instead of 13.5.
- **Reduce frequency**: Move from every-heartbeat to every-3rd-heartbeat or hourly cron.
- Estimated savings: If 50% of reflections find nothing new, saves ~12,300 ops.

## Summary Table

| Rank | Task | Sessions | Est. Wasted Ops | Fix Complexity |
|------|------|----------|-----------------|----------------|
| 1 | Echo/probe sessions | 74 | ~148 | Low |
| 2 | Evaluator JSON retries | 53 | ~371 | Medium |
| 3 | Coach reflect frequency | 1,822 | ~12,300 | Low |

## Automation Implemented

### Evaluator JSON Extraction Helper

Created `agents/shared/scripts/extract-json-scores.sh` — a post-processor that extracts valid JSON from evaluator output before triggering a retry. This addresses waste item #2.
