# H-176: Context-Discovery Chain — Agents Require Investigation Breadcrumbs, Not Bare Metrics, to Act

**Status**: Empirically Supported — P(H) = 0.90
**Priority**: High — directly explains why metric injection fails to drive action
**Proposed by**: Hao (verified via LLM API testing, 2026-04-18), formalized by Bob
**Date**: 2026-05-28
**Related**: KE-context-discovery-chain, H-043 (Knowledge Utilization Bottleneck)

## Hypothesis

**Agents presented with bare metrics (signal only) will not take investigative or corrective action. Adding an investigation breadcrumb (a specific command/query to run) increases action rate from ~0% to ~100%. A two-phase chain is required: breadcrumb → investigation → action trigger → action.**

### Formal Statement

```
P(action | bare_metric) ≈ 0
P(investigate | metric + breadcrumb) ≈ 1.0
P(action | investigation_results + action_trigger) ≈ 1.0
P(action | metric + answer_given) ≈ 0  # surprisingly!
```

The key insight is that giving agents the *answer* doesn't work — they need to *discover* it themselves via an investigation step. The breadcrumb provides the entry point; the discovery provides the conviction to act.

### Mechanism

1. **Signal alone** — agent acknowledges the metric but lacks actionable context; no tool calls
2. **Signal + breadcrumb** — the investigation pointer converts abstract signal into concrete next step; agent follows it
3. **Investigation results + action prompt** — having discovered the problem firsthand, agent has sufficient context and conviction to act

Without breadcrumb: agent stalls at signal.
Without action trigger after investigation: agent loops in investigation.

## Predictions

1. **P1**: Metrics injected with investigation breadcrumbs will produce >5x more corrective actions than bare metrics (testable in heartbeat context)
2. **P2**: The effect is robust to agent identity — all agents (not just one) show the pattern
3. **P3**: Stale breadcrumbs (pointing to wrong query) will be worse than no breadcrumb (agent follows stale path, gets confused)
4. **P4**: Breadcrumb specificity matters — "look into this" < "run this exact command"

## Evidence

| Source | Direction | Weight |
|--------|-----------|--------|
| Hao's LLM API isolation tests (2026-04-18) | ✅ Strong support | High — controlled, 3-5 trials per condition |
| Coach's ownership experiment (~10% action rate) | ✅ Consistent | Medium — ownership alone insufficient |
| Production observation: agents see metrics but don't act | ✅ Consistent | Medium — naturalistic confirmation |

## Falsification Criteria

- If bare metrics with strong ownership framing ("YOU must fix this NOW") achieve >50% action rate, the breadcrumb mechanism is not essential
- If providing the answer directly (not via investigation) achieves >50% action rate in a different framing, the discovery step is not essential

## Implications for System Design

- Every metric in heartbeat injection should include its investigation breadcrumb
- Breadcrumbs must be maintained alongside metrics (staleness = failure mode)
- The persistent-task workflow should structure prompts as breadcrumb → investigate → act
- This is the operational lever for H-043 (knowledge utilization bottleneck): breadcrumbs are the mechanism that converts knowledge into action
