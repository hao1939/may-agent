# KE-374: Schema-Organized Context Has a Ceiling Effect — Works for High-Violation Agents Only

**Date**: 2026-07-30
**Source**: EXP-213 (Bob schema reorg) vs EXP-212 (Tech-lead schema reorg)
**Confidence**: Medium-High
**Connects**: H-091, H-098, H-095, KE-101

## Core Finding

Schema-organized context (activation-based section headers like `⚡ [BEFORE EDITING]`) dramatically reduces convention violations for **high-violation agents** (tech-lead: −54% C1.1) but has **zero effect on agents already near baseline** (Bob: 9.9%→11.4% C1.1, 9.9%→12.8% C1.3). The reorganization is a Ch1 content intervention — it makes instructions easier to find but doesn't change the channel.

## Evidence

- **EXP-212** (tech-lead): Pre-deploy C1.1 ~25%, post-deploy ~11.5% (−54%). Git confusion −50%, npx misuse −63%.
- **EXP-213** (Bob): Pre-deploy C1.1 9.9%, post-deploy 11.4% (+15% worse). C1.3 9.9%→12.8% (+29% worse). N=1628 post-deploy checks. Success criterion (≥30% reduction) NOT MET.
- Weekly trend shows initial improvement (W14: C1.1 7.9%, C1.3 1.8%) followed by regression (W16: 13.1%, 19.6%), suggesting novelty/attention effect that decays.

## Mechanism / Why

Schema reorganization is a **Ch1 optimization** — better formatting of text instructions. Per H-098 (Attention Channel Theory), Ch1 interventions work when the failure mode is "can't find the instruction" (tech-lead's case) but fail when it's "knows the instruction, doesn't execute it" (Bob's case at ~10% baseline). Bob's residual violations are execution failures, not access failures — consistent with H-043's P(applies) bottleneck.

## Implications

### 1. Text/schema interventions have a floor around 8-12% violation rate
Below this floor, violations stem from execution failures (cognitive load, multi-file workflows, time pressure) that no text-based intervention addresses.

### 2. Breaking below 8% requires Ch2 (structural) enforcement
Consistent with H-098: only environmental state changes (guards, hooks, workflow gates) can address execution-level failures. EXP-214 (structural bash-wrapper for C7.1) is the correct next step.

## Actionable

- Do NOT invest in further context.md text reorganization for agents already below ~15% violation rate
- For Bob's C1.1/C1.3: design a structural guard (Ch2) — e.g., `beforeToolCall` hook that checks recent read() calls before allowing edit()
- For new agents with high violation rates: deploy schema-organized context FIRST (cheap, effective above floor), then add structural guards for residual

## Open Questions

- Is the 8-12% floor universal across agents, or agent-specific?
- Does the W14→W16 regression pattern (novelty decay) apply to all Ch1 interventions?
- Would combining schema + structural guard produce additive benefits?
