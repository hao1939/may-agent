# KE-1772: Empty-Turn Error Spike — Broadening Across Models and Agents

**Status**: active
**Discovered**: 2026-06-10
**Scope**: system-wide runtime reliability
**Related**: KE-1670, KE-913, KE-949

## Claim

The "empty tool-use / empty assistant turn" error pattern (documented in KE-1670
as an arc/claude-opus-4.6 problem) has broadened to affect **all agents across
both model providers** (claude-opus-4.6 and gpt-5.4). The system-wide error rate
has spiked from 3.2% (12–24h ago) to 7.5% (0–6h), with the last hour reaching
17.5% (10/57 sessions). KE-1670's recommended runtime retry has not been
implemented; the problem is getting worse.

## Evidence

### Error rate by time window (system-wide)

| Window | Total sessions | Errors | Error % |
|--------|---------------|--------|---------|
| 12–24h ago | 285 | 9 | 3.2% |
| 6–12h ago | 138 | 3 | 2.2% |
| 0–6h ago | 266 | 20 | 7.5% |
| Last 1h | 57 | 10 | 17.5% |

### Error distribution by agent (last 6h)

| Agent | Errors | Total | Error % |
|-------|--------|-------|---------|
| aks-explorer | 9 | — | — |
| may | 4 | — | — |
| arc | 4 | — | — |
| scout | 1 | — | — |
| evaluator | 1 | — | — |

### All errors are the same failure mode

Every error session examined (19/19 in the last 6h) terminated with one of:
- "Agent ended on an empty tool-use assistant turn" (most common)
- "Agent ended with an empty assistant turn"
- "Agent ended without producing a response" (1 case, gpt-5.4)

No other error types were observed.

### Cross-model confirmation

| Model | Error sessions examined |
|-------|----------------------|
| claude-opus-4.6 | arc, may, aks-explorer, scout errors |
| gpt-5.4 | evaluator errors (4 in last hour alone, 3 at 0 ops) |

KE-1670 characterized this as a claude-opus-4.6 specific issue. It is not.
GPT-5.4 also produces empty first-turn responses, as evidenced by the evaluator
burst (3 sessions with 0 ops dying in <1 second at timestamp ~1781023112xxx).

### The fix was identified but not deployed

KE-1670 (2026-06-08) recommended: "when the harness receives `stopReason:
"toolUse"` with no tool calls in the content array, retry the API call (1-2
retries with backoff) before failing the session."

Dev investigated (2026-05-23) and added `classifyTerminalAssistantFailure()`
to `manager-utils.ts`, but this only improved **classification** (marking the
failure correctly as error instead of done). The actual **retry** on empty
response has not been implemented.

## Arc's specific exposure

Arc's 24h error rate is 17.0% (8/47), with the last 6h at 33.3% (4/12).
All 8 errors are the empty-tool-use pattern. This wastes an average of 36 ops
per error session — significant investigative work discarded each time.

## Implications

1. **This is a provider reliability issue, not an agent issue.** No prompt or
   context change will fix it. The stochastic empty-response rate has increased
   recently (possibly a model update or provider capacity issue).
2. **Retry is the correct mitigation.** A 1-2 retry loop on empty API responses
   would recover most of these sessions. The classification fix exists; the
   retry does not.
3. **The evaluator burst is a new pattern.** Three 0-op evaluator sessions dying
   in the same second suggests gpt-5.4 had a brief availability event. This is
   transient but still needs retry to be graceful.
4. **System health is degrading.** The session error rate metric (7.8%,
   threshold 30%) is still green, but the trajectory from 2.2% → 7.5% → 17.5%
   over 24h is a clear regression.

## Recommendation

**P1 for dev**: Implement the KE-1670 retry recommendation in the session
runtime. When the model returns an empty assistant turn (regardless of
provider), retry 1-2 times with exponential backoff before classifying as
error. This is the single highest-leverage fix for system reliability right now.
