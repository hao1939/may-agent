# KE-360: Breadcrumb Action Rate Has ~38% False Negative Rate

**Date**: 2026-06-27
**Source**: EXP-204 Phase 1
**Confidence**: Medium-High
**Connects**: H-189 (breadcrumb gap), EXP-204

## Core Finding

The breadcrumb-action-rate metric overcounts failures by ~38%. When agents see a red metric but don't act on it, 38% of those cases (3/8 in N=22 sample) are because the agent correctly identified it was already handled in a prior session. The metric script has no cross-session memory.

## Evidence

- EXP-204 sampled 22 heartbeat sessions with below-target metrics visible
- Overall action rate: 64% (14/22 acted)
- Of 8 non-actions: 3 "already handled", 3 "competing priority", 2 "structural/stale metric"
- No cases of breadcrumb being too vague to understand (H-204c falsified)

## Mechanism / Why

The measurement script evaluates each session independently. It sees "red metric + no action = failure" but can't detect that the agent investigated and resolved the issue in session N-1 and correctly skipped it in session N.

## Implications

### 1. True action rate is ~76%, not 64%
Adjusting for the 3 false negatives: 14+3 = 17/22 = 77%. The real gap is smaller than measured.

### 2. Agent motivation matters more than enforcement
Coach (owns its metric) had 73% action rate vs May's 55%. Caring about a metric > being told about it.

## Actionable

- Metric script should track "last addressed session" per metric to suppress re-alerts
- Evaluator should consider cross-session context when scoring breadcrumb compliance

## Open Questions

- Does this false-negative pattern apply to other metrics too?
- Would a "last acted on" timestamp in breadcrumbs fix the measurement problem?
