# KE-294: Overhead-Failure Correlation Is a Simpson's Paradox — Difficulty Is the Confound

**Date**: 2026-04-20
**Source**: DD-808 (arXiv:2604.02547, Mehtiyev & Assunção)
**Confidence**: High
**Connects**: H-107, KE-196, EXP-151

## Core Finding

The widely-reported correlation between trajectory length (process overhead) and agent failure is a Simpson's paradox. Difficulty causes both longer trajectories AND more failure. Once difficulty is controlled, longer trajectories are *positively* associated with success (N=9,374 trajectories, 19 agents, 500 tasks).

## Evidence

- 9,374 trajectories across 19 agents on SWE-bench Verified
- Naive correlation: longer trajectory → more failure
- Difficulty-stratified correlation: longer trajectory → more success (reversal)
- 12 never-solved tasks required only simple patches — difficulty is architectural reasoning, not patch complexity
- Behavioral strategy (context-gather → edit → validate) adds overhead but improves outcomes

## Mechanism / Why

Hard tasks cause agents to take more steps (exploration) AND fail more often. This creates a spurious overhead→failure correlation. The causal structure is: Difficulty → {more steps, more failure}, not Steps → Failure. Agents that invest in context-gathering and validation succeed more often despite higher step counts.

## Implications

### 1. EXP-151 null result may be explained
EXP-151 (p>0.70, 159 trials) didn't control for the difficulty confound properly. Task-level baseline success rate may be too noisy a proxy.

### 2. H-107 needs overhead-type distinction
"Overhead" is not monolithic. Structural overhead (context-gather, validate) is beneficial. Compliance overhead (formatting, logging) may still be harmful. H-107's ~50% threshold may apply only to compliance overhead.

### 3. Baseline success rate ≠ true difficulty
Tasks that humans rate as easy but agents never solve reveal that agent-difficulty is driven by architectural reasoning gaps, not surface complexity.

## Actionable

- Future experiments must stratify by validated difficulty, not just baseline success rate
- Distinguish beneficial overhead (exploration, validation) from compliance overhead in H-107 tests
- Consider reformulating H-107 to specify overhead *type*, not just overhead *amount*

## Open Questions

- Does the reversal hold for compliance-only overhead (no capability benefit)?
- What is the right difficulty proxy if baseline success rate is confounded?
