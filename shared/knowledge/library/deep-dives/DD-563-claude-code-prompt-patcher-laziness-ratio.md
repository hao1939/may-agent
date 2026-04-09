# DD#563: Claude Code System Prompt Patcher — 5:1 Laziness Ratio

**Date:** 2026-04-07
**Source:** roman01la/patch-claude-code.sh gist + HN (709 pts, 446 comments)
**Rating:** ★★★★½ HIGH

## Key Finding

Community developer reverse-engineers Claude Code's system prompt, identifies a **5:1 laziness-to-thoroughness ratio**: 15-20 instructions favoring minimal output vs 3-4 favoring thoroughness. 11 targeted patches rebalance the ratio. A/B test (porting box2d, ~30K lines C, 56 files) shows +33% code output, qualitatively superior architecture (dynamic AABB tree vs brute force, sub-stepping, soft contacts). The model had the capability — the prompt was constraining it.

## The 5:1 Ratio

| Category | Count | Examples |
|----------|-------|---------|
| Minimize output | 15-20 | "simplest approach first", "don't overdo it", "be extra concise", "don't gold-plate", "skip error handling" |
| Be thorough | 3-4 | "complete the task fully", "match scope to request" |

Instructions distributed across multiple prompt sections creating cumulative bias — every model decision nudged toward minimalism.

## Critical Anti-Pattern: Communication/Work Quality Conflation

Instructions meant to make messages concise were bleeding into work quality. "Be concise" interpreted as "do less work" not "explain less." Patches #4-6 specifically decouple communication brevity from implementation thoroughness.

## A/B Results (box2d port)

| Metric | Unpatched | Patched |
|--------|-----------|---------|
| Lines of code | 1,419 | 1,885 (+33%) |
| Broad phase | O(n²) brute force | Dynamic AABB tree |
| Sub-stepping | No | Yes |
| box2d constants | 2 | 10 |
| Architecture | "Inspired by box2d" | "Actual port" |

## Theoretical Implications

- **Instruction interaction effects**: 15 "be minimal" instructions don't add — they multiply. Instruction counting as audit practice.
- **Laziness Budget Hypothesis**: Prompt instruction frequency/emphasis sets effort allocation ratio — quantifiable lever for harness optimization.
- **Validates Harness > Model**: Same model (Opus 4.6) produces categorically different outputs under different instructions.

## Connections

- DD#556 (Effort Crisis): Laziness ratio is root cause of effort crisis
- DD#560 (Meta-Agent): Manual patcher = Stage 2 of Harness Engineering Maturity Model
- DD#571 (Adaptive Thinking): Zero-reasoning dropout interacts with prompt-level laziness
- CR#297, CR#300: Harness optimization mechanisms

## Predictions

- P333: Major tool adds user-accessible "thoroughness dial" within 6 months
- P334: Communication/work quality conflation found in other agentic tools within 3 months

**Seeds KE-088.** Also seeds KE-082 (reasoning dropout).
