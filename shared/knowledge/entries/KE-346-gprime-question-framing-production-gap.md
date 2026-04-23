# KE-346: G' Question-Framing — 100% Gym → 54% Production (Sim2Real Gap)

**Date**: 2026-06-22
**Source**: EXP-189
**Confidence**: High (deployed, measured in production)
**Connects**: H-168, KE-275 (Sim2Real gap), EXP-189

## Core Finding

G' question-framing reframe for metric reactions achieves **100% in gym** (N=37) but only **54% in production** (up from 19% baseline). The 2.8× improvement is real but the 46pp gap confirms KE-275's prediction that gym scores systematically inflate.

## Why the Gap

1. **Competing context**: Production heartbeats have projects, alerts, inbox — gym has only the metric
2. **Measurement scope**: Gym tests one action; production measures follow-through on ALL breadcrumbs
3. **Structural enforcement > text framing**: The RED METRIC GATE (workflow-level) matters more than prompt wording

## Implication

Text-only prompt interventions have a production ceiling around 50-60%. Structural enforcement (workflow gates, required sections) is needed for higher compliance. Don't over-invest in prompt framing alone.
