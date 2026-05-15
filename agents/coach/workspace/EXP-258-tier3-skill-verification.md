# EXP-258: Tier 3 Skill Production Verification

**Status**: DESIGNED — ready to run when eval pipeline available
**Owner**: coach
**Created**: 2026-07-02

## Problem

10 skills deployed to production agents have NEVER been measured (Tier 3 in scorecard). Two are HIGH risk:
1. `diagnosis-before-action` (coder) — text skill, deployed 2026-06-25
2. `post-delivery-readback-verification` (tech-lead) — text skill, deployed unknown

Per KE-002 and 13 failed experiments, text-only skills achieve ~0% behavior change. These are likely dead weight — or worse, adding context length without benefit.

## Hypothesis

H1: `diagnosis-before-action` has <20% production compliance (consistent with text skill baseline)
H2: `post-delivery-readback-verification` has <20% production compliance

## Method

1. Sample 20 coder debugging sessions (post-deployment)
2. For each, check: did coder explicitly state diagnosis before first edit?
3. Sample 20 tech-lead sessions with deliverables
4. For each, check: did tech-lead do readback verification before finish?

## Decision criteria

- If compliance <20%: REMOVE skill (reduces context noise per EXP-253 precedent)
- If compliance 20-60%: Consider structural enforcement upgrade
- If compliance >60%: Promote to Tier 2

## Blockers

- No eval DB currently available (0 rows in requests table)
- No accessible session logs
- **Unblocks when**: eval pipeline restored OR manual session sampling possible

## Connection to scorecard

This directly addresses the P0 notification: "156 skills with ZERO quality measurement."
Scorecard already answers the macro question. This experiment addresses the two highest-risk gaps.
