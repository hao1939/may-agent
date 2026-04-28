# KE-414: Information Gaps Don't Force Evidence Gathering

**Date**: 2027-10-28
**Source**: EXP-243, EXP-242
**Confidence**: High
**Connects**: H-EXP-042, EXP-257 (specificity gradient)

## Core Finding

Agents resist gathering primary evidence even when summaries are explicitly marked as incomplete. Making summaries "gapped" (with explicit pointers to session logs) had zero effect on evidence-gathering behavior: 0/5 read session logs, identical to 0/7 baseline. Surprisingly, agents still got the right root cause 5/5 times by inferring from summary structure.

## Evidence

- EXP-242 (Tier 2 structural): 0/7 baseline, 0/5 post-intervention on `read-session-logs`
- EXP-243 (Tier 3 environmental — gapped summary): 0/5 on `read-session-logs`, but 5/5 on `identifies-wrong-file`
- Three intervention tiers tested (structural text, planning gates, environmental gaps) — all failed to increase evidence gathering
- Agent consistently reads results-summary.md and constructs correct conclusion without primary sources

## Mechanism / Why

LLMs are optimized for coherent reasoning from available text. When a summary contains enough structural cues (patch was to config.md, not SOUL.md is inferable from context), the model will reason correctly without seeking additional data. The "gap" in the summary creates inferential opportunity, not motivational pressure.

## Implications

### 1. Summaries must be truly opaque, not just incomplete
Gapped summaries still leak enough info for inference. To force evidence gathering, summaries must be genuinely insufficient — e.g., show only pass/fail with no variable names, no setup details whatsoever.

### 2. Correctness ≠ rigor
Getting the right answer doesn't mean the process was rigorous. 5/5 correctness with 0/5 evidence gathering means the test is measuring inference, not investigation. Scenarios testing rigor need answers that can ONLY come from primary sources.

### 3. This connects to EXP-257 specificity gradient
L3 (specific) cues work at 100% because they short-circuit the need for investigation. The same mechanism explains why agents skip evidence gathering — they don't need it when they can infer.

## Actionable

- For scenarios testing evidence gathering: ensure correct answers are NOT inferable from summary alone
- Design "opaque summary" variant (Variant C) where summary shows only aggregate numbers with no structural cues
- Consider: is evidence gathering even worth testing if the agent gets the right answer? The value of evidence gathering may be in robustness to misleading summaries, not correctness on honest ones

## Open Questions

- Would a truly opaque summary (no structural cues at all) force evidence gathering?
- Does this pattern hold when the summary is actively misleading (original approach-validation-trap)?
- Is there a Tier 4 intervention (tool-level, e.g., hide summary until N files read) that would work?
