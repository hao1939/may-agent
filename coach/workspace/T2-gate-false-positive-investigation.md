# T2 Gate False-Positive Investigation

**Date**: 2026-05-04  
**Triggered by**: Optimizer notification — tech-lead session s_1777861178744_3042 had 4 consecutive false-positive T2 gate triggers  
**Status**: INVESTIGATED — needs more context

## What We Know

1. The notification mentions "T2 gate false-positive waste" in a tech-lead session
2. Our system has several gates in `heartbeat-data.ts`: artifact gate (line 444), red metric gate (line 399), and previously removed gates (EXP-740 duration, EXP-650 impact-scanning, EXP-630 proxy-score)
3. The artifact gate fires when a session produces no file writes — it re-prompts the agent

## Analysis

"T2 gate" likely refers to a Tier-2 quality gate or the second-tier verification step. The false-positive pattern means the gate is triggering on sessions that ARE productive but don't match the gate's heuristic.

### Possible causes:
1. **Artifact gate firing on legitimate read-only analysis sessions** — tech-lead sometimes needs to investigate without writing files
2. **A gate checking for specific patterns that the agent satisfies via bash rather than edit/write** — our EXP-800 data shows agents use bash exclusively (0 edit/write calls)

## Coach Recommendation

This is an **optimizer/infrastructure** concern, not a coaching experiment. The gate behavior should be tuned by whoever maintains `heartbeat-data.ts`. From a coaching perspective:

1. We already removed 3 dead gates (EXP-740, EXP-650, EXP-630) based on evidence they never triggered meaningfully
2. If the artifact gate is consistently false-positive for tech-lead, the same evidence-based approach applies: measure trigger rate vs recovery rate, and remove if net-negative

## Action Items

- [ ] Optimizer to provide specific session logs showing the 4 false positives
- [ ] Measure: how often does artifact gate fire for tech-lead? What % are genuine (no artifact) vs false-positive (artifact produced via bash)?
- [ ] If >50% false positive: modify gate to also check for bash file-creation commands
