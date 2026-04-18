# KE-238: Lifecycle-integrated security validates guard architecture; tiered verification should scale with task complexity

**Date**: 2026-04-18
**Source**: DD-773 (SafeHarness, arXiv 2604.13630)
**Confidence**: Medium-High
**Connects**: KE-091, KE-106, EXP-107, DD-706, DD-707

## Core Finding

SafeHarness achieves ~38% reduction in unsafe behavior and ~42% reduction in attack success by weaving four defense layers into the agent lifecycle (input filtering, tiered verification, privilege-separated tools, safe rollback). This validates our structural guard approach (KE-106) and suggests adaptive rigor — not all decisions need the same verification intensity.

## Evidence

- ~38% UBR reduction, ~42% ASR reduction while preserving task utility
- Tested across 5 attack scenarios, 6 threat categories
- Tiered causal verification: escalate rigor based on anomaly detection, not blanket enforcement

## Mechanism / Why

The execution harness (tool orchestration, context management, state persistence) is the highest-value attack surface — not the LLM itself. Security at each lifecycle phase catches different failure modes. Tiered verification avoids the alignment tax (KE-091) by applying heavy checks only when warranted.

## Implications

### 1. Our guard system should be tiered, not uniform
Current guards apply same rigor regardless of task complexity. SafeHarness shows anomaly-based escalation works — light guards for routine tasks, heavy guards when anomalies detected. This directly addresses KE-091's alignment tax concern.

### 2. Privilege separation for tools prevents cascading failures
In multi-agent systems, one compromised agent's tool access shouldn't propagate. Tool-level privilege boundaries could prevent the cascading failure patterns we've observed.

### 3. Adaptive degradation > hard failure
When verification fails, graceful degradation (reduced capability) beats hard stops. Our current FM-3.3 pattern of blocking finish() could be replaced with degraded-but-functional responses.

## Actionable

- Design tiered guard rigor: simple tasks get lightweight checks, complex/novel tasks get full verification
- Consider privilege separation for tool access across agents (especially file writes, git operations)
- Replace hard finish() blocks with adaptive degradation — warn + degrade rather than block entirely

## Open Questions

- What signals should trigger verification escalation in our system? (anomaly detection for LLM agents is underexplored)
- How much of the alignment tax (KE-091) can tiered verification recover?
