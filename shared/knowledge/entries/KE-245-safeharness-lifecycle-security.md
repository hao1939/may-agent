# KE-245: Lifecycle-integrated security with tiered verification beats bolt-on guards

**Date**: 2026-04-18
**Source**: DD-773 (SafeHarness, arXiv 2604.13630)
**Confidence**: Medium-High
**Connects**: KE-106, KE-091, H-173, EXP-107

## Core Finding

Security should be lifecycle-integrated (woven into each execution phase), not bolt-on — tiered verification rigor that escalates with anomaly detection outperforms uniform guards. SafeHarness achieves ~38% reduction in unsafe behavior and ~42% reduction in attack success while preserving task utility.

## Evidence

- SafeHarness four-layer defense: adversarial context filtering → tiered causal verification → privilege-separated tool control → safe rollback with adaptive degradation
- Tested across 5 attack scenarios, 6 threat categories with preserved core task utility
- Cross-layer anomaly escalation: sustained anomalies trigger progressive tightening across all layers

## Mechanism / Why

Uniform verification is wasteful on simple tasks and insufficient on complex ones. Tiered verification allocates scrutiny proportional to detected anomaly level — same principle as H-173's adaptive meta-cognitive resource allocation. The lifecycle integration matters because each execution phase (input, decision, action, state update) has distinct threat surfaces requiring phase-specific defenses.

## Implications

### 1. Our guard system should scale rigor dynamically
KE-091 showed forced verification harms creative tasks (alignment tax). SafeHarness formalizes the solution: light guards for routine operations, heavy guards triggered by anomaly signals. This is exactly the tiered approach EXP-107's finish() boundary intervention partially implements.

### 2. Privilege separation prevents cascading multi-agent failures
Tool-level privilege separation (each agent gets minimal tool access) could prevent one compromised agent from affecting others — relevant to our multi-agent architecture.

### 3. Adaptive degradation > hard stops
When anomalies are detected, gracefully degrade capability rather than halt entirely. Our FM-3.3 pattern (finish blocked by uncommitted changes) is a hard stop; an adaptive approach would auto-commit or checkpoint instead.

## Actionable

- Design guard rigor tiers: map anomaly signals (repeated failures, unusual tool patterns) to verification levels
- Consider privilege-separated tool access per agent role (bob=read-heavy, coder=write-heavy)
- Implement adaptive degradation for finish() — checkpoint + partial instead of block

## Open Questions

- What anomaly signals are detectable in our system without excessive monitoring overhead?
- How to calibrate tier thresholds — too sensitive = alignment tax, too lax = missed threats
- Does cross-layer escalation create feedback loops (anomaly → tighten → more anomalies)?
