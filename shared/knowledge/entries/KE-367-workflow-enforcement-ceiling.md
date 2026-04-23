# KE-367: Workflow Enforcement Has No Advantage Over Text Skills at High Baselines

**Date**: 2026-04-23
**Source**: EXP-010
**Confidence**: Medium-High
**Connects**: KE-007, H-070

## Core Finding

Workflow enforcement (structurally forcing a verify phase) shows no advantage over text-based skills when the baseline pass rate is already near 100%. Both arms hit ~100% on C2.3 verify-after-edit — a ceiling effect that prevents measuring any difference.

## Evidence

- EXP-010: Arm A (text skill) achieved ~90-100% C2.3 pass; Arm B (workflow) achieved ~100%
- With baseline so high, no statistical power to detect workflow benefit
- The convention-verify-edit skill text alone was sufficient to change agent behavior

## Mechanism / Why

Text-based skills work when the behavior is simple and well-defined (e.g., "read file after editing"). Workflow enforcement adds value only when: (1) the behavior is complex/multi-step, (2) agents reliably skip it under cognitive load, or (3) baseline compliance is low enough to improve.

## Implications

### 1. Don't workflow-ify already-working skills
Adding workflow structure to high-compliance behaviors wastes engineering effort and adds orchestration overhead (~16-20s per EXP-050).

### 2. Target workflow enforcement at low-compliance, high-impact behaviors
Focus structural enforcement where text skills fail — complex judgment tasks, multi-agent coordination.

## Actionable

- Before building a workflow for a convention, measure text-skill baseline first. Only invest in workflow if baseline < 80%.
- Use EXP-050's overhead data (1.76-3.78x for forced externalization) to justify NOT adding workflows for simple behaviors.

## Open Questions

- At what baseline compliance rate does workflow enforcement start adding value? (Hypothesized: <70%)
