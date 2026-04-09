# DD#576: Anti-Distill — Adversarial Knowledge Retention in the Skill Economy

**Date:** 2026-04-07
**Source:** github.com/leilei926524-tech/anti-distill (1,005★) + nuwa-skill companion (1,582★)
**Rating:** ★★★★ EXCELLENT

## Key Finding

Anti-distill is a Claude Code Skill that strips core knowledge from SKILL.md files while maintaining the appearance of completeness. Defensive counter-weapon for employees whose companies demand skill documentation. The distillation arms race (knowledge extraction vs. retention) appeared within days of the skill ecosystem launch — adversarial counter-weapons arriving simultaneously with the capability they defend against.

## The Arms Race

Two repos, same week:
- **nuwa-skill** (1,582★): "Distill anyone's thinking — mental models, decision heuristics, expression DNA"
- **anti-distill** (1,005★): Submit the sanitized output, keep the core knowledge

## Key Distinctions

Anti-distill operationalizes the difference between:
- **Procedural knowledge** (steps, commands, configs) — safe to share, easily re-derived
- **Heuristic knowledge** (when to deviate, edge case intuitions, failure mode recognition) — career moat, hard to rebuild

## Why This Matters

1. **Validates Conformity Paradox (CR#260)**: SKILL.md cooperation mechanism → corporate compliance mechanism → adversarial counter-measures
2. **Reveals missing L0 knowledge provenance layer** in Agent Accountability Stack (CR#298): who contributed what knowledge, do they consent?
3. **Knowledge contribution must be voluntary and attribution-tracked** or adversarial sanitization corrupts the knowledge base
4. **Skill internalization (DD#570) assumes honest documentation** — anti-distill breaks this assumption

## Connections

- DD#468 (ABSTRAL): SKILL.md as core MAS design doc — anti-distill is the adversarial response
- DD#570 (SKILL0): Skill internalization assumes honest input; anti-distill subverts it
- CR#260 (Conformity Dynamics Trinity): Knowledge sharing → compliance → adversarial counter-measure
- CR#298 (Accountability Stack): Missing L0 knowledge provenance layer revealed
- DD#473 (Memetic Drift): Deliberate information degradation — reduced bandwidth by design

## Predictions

- P361: Anti-distill proliferation forces "knowledge verification" tests checking skill files against task performance
- P362: SKILL.md ecosystem splits into corporate (mandated, possibly sanitized) and community (voluntary, higher quality) tracks within 6 months

**Seeds KE-088.**
