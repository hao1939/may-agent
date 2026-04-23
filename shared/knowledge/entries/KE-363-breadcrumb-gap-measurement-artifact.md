# KE-363: Breadcrumb-Action-Rate Gap is Mostly Measurement Artifact

**Date**: 2026-04-23
**Source**: EXP-204
**Confidence**: Medium-High
**Connects**: EXP-189, KE-056

## Core Finding

Production breadcrumb-action-rate gap (100% gym → 54% production) is largely measurement artifact. True action rate is ~77% when "already handled in prior session" is correctly classified as a pass.

## Evidence

- EXP-204 sampled 22 heartbeat sessions with red metrics
- 3/8 non-actions were correct non-actions (metric already addressed in prior session within 24h)
- 0/8 non-actions were caused by unclear breadcrumbs (breadcrumb quality is fine)
- Agent motivation matters more than enforcement: coach (owns metric) = 73%, may = 55%

## Mechanism / Why

Measurement script counts any session with a red metric and no action as a failure, even when the agent correctly recognized the metric was already addressed. This inflates the gap.

## Implications

### 1. Don't add workflow gates for breadcrumb action
The gap doesn't justify structural enforcement. Motivation > enforcement for this case.

### 2. Fix measurement before fixing behavior
When metrics show a problem, verify the measurement before designing interventions.

## Actionable

- Fix breadcrumb-action-rate measurement to exclude "already handled within 24h"
- Add trailing-metric exemption for metrics agents can't improve in one session
- Minor: lightweight "did you consider the red metric?" prompt for attention-competition cases

## Open Questions

- Does the "already handled" pattern appear in other metrics too?
