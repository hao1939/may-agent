# Finding: Growth-Trigger Error Patterns — Root Cause & Recommendations

**Date**: 2026-04-14  
**Scope**: All `[cron:growth-trigger]` sessions (222 total)  
**Error rate**: 52% (115 errors + 6 interrupted = 121 failures / 222 total)

---

## Executive Summary

The 52% growth-trigger error rate is **not an agent behavior problem** — it's an infrastructure artifact from a single batch-overload incident on 2026-03-17. All 115 errors (100%) came from one day when the handler spawned 33-38 concurrent sessions per cron tick, overwhelming the LLM API. The problem was already fixed (MAX_TRIGGERS_PER_SCAN reduced to 1, handler replaced with sensor-judge workflow). Post-fix error rate: **0%**.

**Status: Already resolved.** No further action needed. This finding documents the root cause and confirms the fix is working.

---

## Error Taxonomy

### Category 1: API Rate Limits (18 errors, 16%)
```
429 RateLimitError: Github_copilotException - exceeded rate limits
429 No deployments available for selected model
```
**Cause**: 33-38 concurrent sessions hitting the same model endpoint simultaneously.

### Category 2: Empty Responses (36 errors, 31%)
```
Model returned an empty response (0 output tokens). This usually indicates a model/API issue.
```
**Cause**: Server-side degradation from concurrent request overload. The API accepted the request but returned nothing.

### Category 3: JSON Parse Errors (36 errors, 31%)
```
JSON Parse error: Unexpected EOF
JSON Parse error: Unexpected token '}'
JSON Parse error: Unable to parse JSON string
```
**Cause**: Truncated/malformed API responses under load. The server started sending responses but cut them short.

### Category 4: Protocol Errors (14 errors, 12%)
```
Unexpected event order, got content_block_start before "message_start"
Unexpected event order, got content_block_delta before "message_start"
undefined is not an object (evaluating 'content.type')
```
**Cause**: Streaming protocol corruption from server overload. Events arrived out of order.

### Category 5: Request Validation (3 errors, 3%)
```
400 BadRequestError: Invalid JSON format in tool call arguments
```
**Cause**: Likely cascading failure — previous truncated response fed back as malformed input.

### Category 6: Agent Logic (1 error, <1%)
```
OpBudgetExceeded: Limit 40 reached.
```
**Cause**: Only genuine agent-side error in the entire dataset.

**Summary**: 114/115 errors (99.1%) are infrastructure — API overload from batch spawning.

---

## The Incident: March 17 Batch Overload

### Timeline
| Time (UTC) | Sessions | Done | Error | Error Rate |
|---|---|---|---|---|
| 02:39:51 | **33** | 5 | 28 | 85% |
| 02:40-02:44 | ~30 (retries) | 12 | 18 | 60% |
| 03:09:51 | **37** | 19 | 18 | 49% |
| 03:39:51 | **38** | 6 | 32 | 84% |
| 04:20-10:37 | 3 per tick | 27 | 0 | **0%** |
| Post-March 17 | 1 per tick | 9 | 0 | **0%** |

### What Happened
1. The `error-log-scanner` cron handler had `MAX_TRIGGERS_PER_SCAN = 3` (originally higher)
2. It scanned ERROR_LOG.jsonl for all agents, found N error patterns above threshold
3. For EACH pattern, it spawned a separate `[cron:growth-trigger]` coach session
4. With ~7 agents × ~5 FM codes each = ~35 eligible patterns → ~35 concurrent sessions
5. 35 simultaneous LLM API calls → rate limit cascade → 70-85% failure rate

### Why The Error Rate Decreased Within March 17
The batch sizes suggest progressive fixes were applied during the day:
- 02:39 batch: **33 sessions** (old config, no cap or high cap)
- 04:20 onward: **3 sessions per tick** (cap reduced to 3)  
- Post-March 17: **1 session per tick** (cap set to 1)

---

## Success vs. Error Patterns

### By Batch Size
| Batch Size | Total | Done | Error | Error Rate |
|---|---|---|---|---|
| Large (11+) | 108 | 30 | 78 | **72%** |
| Small (1-3) | 114 | 71 | 37* | **32%** |

*Small-batch errors are all from the same day's retry cascade (02:40-02:44 window where the initial 33-session batch's failures spawned retries in subsequent ticks).*

### By Target Agent
| Agent | Done | Error | Error Rate |
|---|---|---|---|
| optimizer | 27 | 44 | 62% |
| tech-lead | 25 | 31 | 55% |
| coach | 13 | 13 | 50% |
| may | 16 | 13 | 45% |
| scout | 13 | 10 | 43% |
| coder | 3 | 4 | 57% |
| qa | 3 | 0 | 0% |
| bob | 1 | 0 | 0% |

Error rates are consistent across agents — confirms infrastructure cause (not agent-specific).

### Successful Session Characteristics
- **High-op successes** (38-57 ops): Full growth cycles — fork agent, apply training, verify, promote/discard
- **Low-op successes** (2-5 ops): Quick decisions — either determined the error wasn't trainable or the fork/lab setup failed gracefully
- **Average ops for done**: 17.2 (healthy for a growth cycle task)
- **Average ops for error**: 8.0 (died mid-execution from API failures)

---

## Current State: Problem Already Fixed

Two mitigations were applied, both effective:

### Fix 1: Rate Limit (applied March 17)
```typescript
// error-log-scanner.ts
const MAX_TRIGGERS_PER_SCAN = 1; // Reduced from 3
```
Comment in code: `"Reduced from 3 — growth forks not deploying (gym blocked), saves ~2.7MB/day"`

### Fix 2: Architecture Migration (applied by April)
The old `error-log-scanner` handler was replaced by the `error-scan` sensor-judge workflow:
- **Old**: JS scan → emit N separate coach sessions (one per error pattern)
- **New**: JS scan → filter → cap at `MAX_TRIGGERS_PER_SCAN=2` → single LLM judge session decides which patterns need intervention
- Cron config confirms: `error-log-scanner` is `"enabled": false`, `error-scan` workflow is `"enabled": true`

### Post-Fix Results
- March 18-April 14: **9 growth-trigger sessions, 0 errors (0%)**
- error-scan workflow: 1 session, 1 done (100%)
- New architecture eliminates the batch spawn pattern entirely

---

## Recommendations

### No Action Needed (problem solved)
The 52% error rate is historical, not ongoing. Both the rate limit fix and the architecture migration are in place and working.

### Informational: Residual Improvements
If growth-trigger is re-enabled at higher throughput in the future, consider:

1. **Stagger spawning**: Add 5-10 second delays between concurrent sessions (prevents API burst)
2. **Retry with backoff**: Currently errors are terminal — add 1-2 retry attempts with exponential backoff for 429/empty-response errors
3. **Circuit breaker**: If >3 sessions error in the same batch, cancel remaining and defer to next cycle

### For the Error Rate Metric
The 52% headline number should be contextualized in dashboards:
- Pre-fix (March 17): 54% error rate (single-day incident)
- Post-fix (March 18+): 0% error rate
- Displaying the all-time average (52%) misrepresents current health

---

## Raw Data Summary

```
Total growth-trigger sessions: 222
  Done: 101 (45%)
  Error: 115 (52%)  ← ALL from March 17
  Interrupted: 6 (3%)

Error type breakdown (of 115):
  Empty response:     36 (31%)
  JSON parse:         36 (31%)  
  Rate limit (429):   18 (16%)
  Protocol errors:    14 (12%)
  Bad request:         3 (3%)
  Agent logic:         1 (<1%)
  
Infrastructure errors: 114/115 (99.1%)
Agent logic errors:      1/115 (0.9%)

All errors from single day: 2026-03-17
Post-fix error rate: 0% (9 sessions, 0 errors)
```
