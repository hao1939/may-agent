# KE-266: Conflict-Aware Meta-Verification Beats Uniform Verification

**Date**: 2026-04-19
**Source**: DD#777 (Co-Sight, arXiv 2510.21557)
**Confidence**: Medium-High
**Connects**: KE-105 (Verification Orchestration Stack), H-172 (Calibrated Verification), CR-324

## Core Finding

Conflict-aware meta-verification (CAMV) concentrates verification compute on disagreement hotspots — points where multiple expert agents diverge — rather than uniformly verifying entire reasoning chains. Combined with a shared structured-facts layer (TRSF) that grounds verification in source-traced evidence, this achieves SOTA on GAIA (84.4%) while keeping verification tractable.

## Evidence

- Co-Sight GAIA: 84.4% (SOTA), HLE: 35.5%, Chinese-SimpleQA: 93.8%
- Ablations confirm synergy: CAMV alone helps, TRSF alone helps, together they're multiplicative
- Verification cost scales with inconsistency count, not chain length

## Mechanism / Why

Uniform verification wastes compute on points where all agents agree (high confidence, low value). Conflict detection identifies exactly where uncertainty lives. A shared structured-facts layer prevents circular verification (A checks B checks A) by grounding both in source-verified evidence. The closed loop (facts → verification → updated facts) prevents drift.

## Implications

### 1. Verification should be disagreement-directed, not coverage-directed
Our current verification patterns (guard checks, evidence-gate) apply uniformly. A conflict-aware approach would only trigger deep verification when agents disagree on a finding, reducing overhead on consensus items.

### 2. Shared structured facts prevent circular verification
Without a grounding layer, multi-agent verification can become circular. TRSF-style source-traced facts give verification a fixed reference point — analogous to our knowledge library but with explicit provenance metadata.

### 3. Conflict-proportional compute is the efficiency principle we need
This connects to H-172 (calibrated verification): allocate verification effort proportional to uncertainty. CAMV operationalizes this via disagreement detection.

## Actionable

- When Scout and Bob disagree on a finding's significance, treat that as a conflict hotspot worth additional verification rather than defaulting to one agent's judgment
- Consider adding source-verification metadata to knowledge entries (TRSF-style provenance)
- The "closed verification loop" (knowledge → verification → updated knowledge) is a design pattern for our verification orchestration stack

## Open Questions

- How well does conflict detection work with only 2-3 agents vs. Co-Sight's multiple experts?
- Does CAMV degrade when agents share training biases (correlated errors produce false consensus)?
- What's the minimum disagreement threshold that triggers useful verification?
