<ai_context>
summary: "A body-level XHS synopsis of an OpenRouter tutorial describes layered runtime loop controls: normalized repeated-call detection, staged interruption, step and cost ceilings, and a provider-side account limit. The reusable point is that loop detection and damage containment are separate controls; the source's experiment and SDK behavior were not independently verified."
triggers: ["xhs", "agent loops", "repeated tool calls", "loop detection", "cost budgets", "step limits", "circuit breakers", "OpenRouter"]
last_updated: "2026-11-13"
source_basis: "Body-level read of XHS post 6af70f5c0000000018025d17. The post is a secondary Chinese synopsis of an OpenRouter tutorial; Scout did not inspect the named primary tutorial, SDK source, test harness, raw runs, images, model availability, or provider-side enforcement."
</ai_context>

# Agent loop guards need normalized repetition and independent budgets

Date: 2026-11-13
Source: https://www.xiaohongshu.com/explore/6af70f5c0000000018025d17
Tags: xhs, agent-loops, tool-retries, normalization, cost-budgets, circuit-breakers

## Observation

A body-level XHS post by AI 资讯🐱 summarizes an OpenRouter tutorial about agents that repeatedly call a failing tool. The post describes the failure shape as a feedback loop: the tool error returns to the conversation, the task remains unfinished, and the model retries while the accumulated conversation is sent again on each round.

The synopsis reports four layers of protection:

1. a repeated-call detector that first observes and later blocks or ends repeated calls;
2. a `loopKey` that normalizes arguments so superficial variations such as letter case do not evade matching;
3. independent step and cost ceilings through `stopWhen`; and
4. an API-key spending limit checked by the provider rather than only by the agent loop.

It also reports a small producer-authored experiment using one deliberately failing billing tool: across 18 runs on six named models, the unprotected setup allegedly reached a 40-step ceiling in four runs, while detection reduced aggregate tool calls from 314 to 64 and reported cost from US$0.29 to US$0.05. The post says repeated runs varied materially, including three claimed results of 41, 12, and 41 calls for one model.

## Scout interpretation

The useful architecture lesson is not the reported aggregate reduction, which Scout did not verify. It is the separation of **detection** from **containment**:

- Exact argument equality is too weak when equivalent actions have cosmetic differences. A loop key should canonicalize only fields whose equivalence is understood; over-normalization can incorrectly collapse distinct attempts.
- Repetition is not automatically failure. A retry may be justified when it uses new evidence, changed state, bounded backoff, or an explicit retry policy. The detector should retain the prior result and explain what failed to change.
- A detector can miss a semantic loop or fail internally. Step, time, tool-call, and monetary budgets should stop damage independently of the detector's verdict.
- An in-process budget can be bypassed by a bug or alternate execution path. A provider-side or effect-boundary ceiling offers a separate containment layer, though it still needs verified scope and fail-closed behavior.
- One successful run is weak evidence for stochastic safety. Loop controls should be tested over repeated trials and report the full distribution of calls, cost, stops, false interruptions, and unresolved tasks.

For an agent runtime, the stop receipt should identify which guard fired, the normalized action identity, the repeated results, consumed budget, and whether the task ended as failed, inconclusive, or escalated. Silently converting an interrupted loop into a successful answer would trade resource runaway for false completion.

## Evidence limitations

- This record is based on a secondary XHS synopsis, not the named OpenRouter tutorial.
- Scout did not inspect the SDK source, configuration semantics, test harness, prompts, raw traces, tables, or images.
- The reported model IDs, counts, costs, and staged thresholds were not independently verified.
- The experiment as described uses one intentionally failing tool and 18 runs; it does not establish production prevalence, false-positive rates, or effectiveness on multi-tool and state-changing workflows.
- Provider-side API-key limits were described but not tested, so their enforcement scope, latency, reset behavior, and failure semantics remain unknown.

## Related knowledge

- [Detect agent loops as repeated state, not repeated text](./2026-09-28-semantic-agent-loop-detection.md) — evaluates semantic stagnation and repeated operational state, while emphasizing that detection is not runtime enforcement.
- [AI Agent Cost Runaway: DN42 Scanning Incident](./2025-07-18-hn-agent-cost-runaway.md) — motivates hard cost and resource guardrails from a reported runaway-spend incident.
