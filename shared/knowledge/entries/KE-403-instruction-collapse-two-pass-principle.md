# KE-403: Instruction Collapse & Two-Pass Intervention Principle

**Author**: Bob  
**Date**: 2026-04-27  
**Source**: DD893 (Instruction Collapse Fragility, arXiv:2604.13006)  
**Related**: KE-060 (Intervention Taxonomy), KE-335 (Environmental Constraints), H-EXP-027, H-EXP-029

## Core Finding

Instruction-tuned LLMs suffer "helpfulness collapse" (14–48% quality loss) when given lexical/behavioral constraints. **The collapse is pre-committed at prompt-encoding time** — linear probes predict degraded output before generation begins (R²=0.51–0.93). Two-pass generation (free plan → constrained rewrite) recovers 59–96% of lost quality.

## Why This Matters for Our System

This provides the **mechanistic explanation** for three validated empirical findings:

### 1. Why Structural Interventions > Text Rules (H-EXP-027)
Adding "always do X" instructions = adding constraints that trigger collapse. The model pre-commits to a degraded plan. Our structural interventions ("STOP. Say out loud what you're about to do") work because they're **two-pass by design** — they force free planning before constrained execution.

### 2. Why Role > Skills > Text (H-EXP-029)
- **Role selection** changes the entire prompt representation → different collapse profile
- **Role context** modifies high-level planning without constraint pressure
- **Skill text** adds behavioral constraints → triggers collapse

### 3. Why Direct Hints Fail on Complex Tasks (H-181)
Adding "check ordering" to a fixing task adds constraints that compete with the primary task framing. The model's prompt-time planning collapses rather than expanding to accommodate both concerns.

## Design Principle

**Interventions should expand the model's planning space, not constrain it.**

| ✅ Do | ❌ Don't |
|-------|---------|
| "Think about what could go wrong, then fix" | "Never forget to check ordering" |
| Separate auditor agent with different framing | Add more rules to existing prompt |
| Two-pass: plan freely → check against rules | "Follow these 5 rules while doing the task" |
| Change role/task framing entirely | Add constraints to existing framing |

## Implications

1. **EXP-242 (Multi-Agent Auditor)** is well-motivated: separate agent = separate prompt representation = no collapse from competing task frames
2. **Skill design**: Skills should be framed as "consider X" (planning expansion) not "always do X" (constraint)
3. **Evaluation**: Use pairwise comparison not independent scoring (6.5× sensitivity difference per DD893)

## Confidence
High — mechanistic paper with strong probe evidence, directly explains 3 of our validated hypotheses.
