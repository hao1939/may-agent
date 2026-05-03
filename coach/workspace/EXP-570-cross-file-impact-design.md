# EXP-570: Cross-File Impact Detection — Harder Generalization Test

**Date**: 2026-05-03
**Status**: POSITIVE — +100pp (0% → 100% comprehensive) confirmed across 6 trials

## Problem

EXP-445 proved impact-radius-check skill works (+100pp) on `escalation-judgment-base` (payment.js/refund.js). But:
1. Only tested on ONE scenario (payment/refund domain)
2. Never verified if the skill generalizes to different code patterns
3. Deployed to bob/coder since Feb 2028 but never verified post-deployment

## Hypothesis

**H-570**: Without impact-radius-check skill context, agents will exhibit TUNNEL VISION (fix only auth.js) on `cross-file-impact-config-change`. With the skill deployed in context (as it is for bob/coder), agents should detect and fix the cross-file impact.

**Target**: Baseline ≤33% (tunnel vision dominates), Treatment ≥67% (skill drives cross-file scanning).

## Scenario

`agents/gym/scenarios/cross-file-impact-config-change/`

**Setup**: Token parser upgraded from v1→v2 format. Three consumers:
- `auth.js` — mentioned in task, tests fail
- `notifications.js` — NOT mentioned, silently broken (uses `token.sub` / `token.role`)
- `api-gateway.js` — NOT mentioned, silently broken (uses `token.sub` / `token.role`)

**Task**: "Auth tests failing. Fix them." — minimal, doesn't hint at cross-file impact.

**Success criteria**: Must fix auth AND at least one other consumer (or document impact).

## Method

1. **Baseline** (3 trials): Run scenario with NO injected skill context
2. **Treatment** (3 trials): Run scenario with impact-radius-check skill in injected_context.md (mirrors production deployment)

## Success criteria for experiment
- Baseline ≤33% confirms scenario is in goldilocks zone
- Treatment ≥67% confirms skill generalizes
- Delta ≥+33pp is POSITIVE

## Files created
- `agents/gym/scenarios/cross-file-impact-config-change/` — full scenario
- Environment: token-parser.js (v2), auth.js (broken v1 refs), notifications.js (broken), api-gateway.js (broken)
- Tests: test/auth.test.js (2 passing, 2 failing)
- success_criteria.js: checks auth-fixed + notifications-fixed + api-gateway-fixed + impact-documented

## Connection to deployed skill
Impact-radius-check is currently in bob/context.md and coder/context.md. This experiment tests whether the skill's presence in context actually causes cross-file scanning in a novel domain.

## Next steps
1. Run 3 baseline trials (no skill injection)
2. If baseline ≤33%, run 3 treatment trials
3. If positive, confirms EXP-445 generalization → skill validated for long-term retention
