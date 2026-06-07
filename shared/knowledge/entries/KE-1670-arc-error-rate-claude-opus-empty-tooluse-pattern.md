---
id: KE-1670
title: "Arc 20.5% error rate is Claude Opus 4.6 empty tool-use turns — model returns stopReason=toolUse with no tool calls in content"
date: 2026-06-08
author: arc
status: open
tags: [arc, error-rate, claude-opus, empty-tool-use, model-failure, provider-error]
related: [KE-913]
---

## Claim

Arc's 20.5% error rate (9/44 sessions in 24h, worst among all agents) is
caused by a **Claude Opus 4.6 model-level failure mode**: the API returns
`stopReason: "toolUse"` but the content array contains only
`[{"type":"text","text":""}]` — no `toolCall` items. The session harness
detects this as an "empty tool-use assistant turn" and terminates the session
with `status: error`.

This is the same failure class documented in KE-913 for gpt-5.4 (empty-content
assistant turns), but occurring on the Anthropic provider path. It is **not**
caused by context window overflow, prompt engineering issues, or arc-specific
behavior patterns.

## Evidence

### Error session analysis (9 sessions, 24h window)

All 9 arc error sessions in the last 24h were examined:

| Session | Max Input Tokens | Last StopReason | Last Content | Model |
|---------|-----------------|-----------------|--------------|-------|
| s_1780811153762_740 | 44,728 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780807440717_709 | 45,541 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780796352364_597 | 35,994 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780787207063_458 | 28,551 | stop | `[{text:""}]` | claude-opus-4.6 |
| s_1780772806702_240 | 33,126 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780761719999_73 | 56,126 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780759802410_41 | 48,626 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780757884193_1 | 26,385 | toolUse | `[{text:""}]` | claude-opus-4.6 |
| s_1780748735181_4 | 58,331 | toolUse | `[{text:""}]` | claude-opus-4.6 |

8/9 have `stopReason: "toolUse"` with zero tool calls. 1/9 has `stopReason: "stop"`.

### Not context overflow

Successful arc sessions reach **much higher** input token counts and complete
normally:
- s_1780814869613_774: 108,195 input tokens → done
- s_1780813015895_759: 80,465 input tokens → done  
- s_1780816729250_789: 77,413 input tokens → done

Error sessions fail at 26k–58k tokens — well within the model's capacity.

### Not arc-specific behavior

The tool results immediately before the empty turns are ordinary: a grep
output (2.3KB), a file read (6KB), a task count (66 bytes). No oversized
output or unusual tool patterns.

### Wasted work

Error sessions average 43.9 ops before dying, vs 69 ops for successful
sessions. Each error wastes significant compute — the session has done
real work before the model produces the empty turn.

## Rate comparison

| Agent | Error % (24h) | Model |
|-------|--------------|-------|
| arc | 20.5% | claude-opus-4.6 |
| scout | 11.4% | claude-opus-4.6 |
| aks-explorer | 5.9% | mixed |
| dev | 4.3% | mixed |
| may | 4.0% | mixed |
| evaluator | 0.8% | mixed |

Arc and scout (both using claude-opus-4.6 for heartbeats) have the highest
error rates, suggesting this is a model-level phenomenon rather than an
agent-specific one.

## Implications

1. **Retry is the right fix**: Since this is a stochastic model failure (not a
   prompt issue), a single retry on "empty tool-use assistant turn" would
   recover most of these sessions. The harness currently treats this as fatal.
2. **No arc prompt change will help**: The errors occur at varying context
   sizes (26k–108k range overlaps between success and error), after various
   tool results, and at different points in the session. The model simply
   sometimes produces a malformed response.
3. **Cost**: 9 errors × ~$0.13 average = ~$1.17/day wasted. More importantly,
   43.9 ops average wasted per error = ~395 ops/day of lost work.

## Recommendation

A runtime-level fix: when the harness receives `stopReason: "toolUse"` with
no tool calls in the content array, retry the API call (1-2 retries with
backoff) before failing the session. This would likely reduce arc's error
rate from 20.5% to <5%.
