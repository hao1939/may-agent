# Skill Quality Scorecard
**Date**: 2026-06-29 | **Author**: Coach

## Methodology

Each skill scored 0-6 on structural quality:
- **Trigger condition** (+1): Has when/before/after/if-you framing
- **Actionable steps** (+1): Numbered steps or clear procedure
- **Examples** (+1): Concrete examples or e.g. references
- **Anti-patterns** (+1): Don't/never/avoid guidance
- **Evidence-backed** (+1): References KE/EXP/experiment data
- **Right length** (+1): 50-500 words (not too terse, not bloated)

## Score Distribution (108 skill files analyzed)

| Score | Count | % |
|-------|-------|---|
| 0 | 5 | 5% |
| 1 | 3 | 3% |
| 2 | 1 | 1% |
| 3 | 5 | 5% |
| 4 | 24 | 22% |
| 5 | 62 | 57% |
| 6 | 8 | 7% |

**Mean score: ~4.4/6** — structurally decent but thin on evidence.

## Key Findings

### 1. Most skills are structurally solid (86% score 4+)
The system-wide skill templates (closing-the-loop, reading-metrics, verify-after-edit, etc.) are well-structured and widely deployed. 62 skills score 5/6.

### 2. Evidence backing is the weakest dimension
Only 57/108 (53%) reference any experiment or KE. The rest are "good ideas" without proof they work. This is the #1 quality gap.

### 3. 8 junk files (README.md placeholders)
5 README.md files score 0 (just "# Skills" placeholders), 3 more score 1. These inflate the count without adding value. Should be excluded from metrics.

### 4. Top skills (score 6) — evidence-backed AND well-structured
- `verify-after-edit.md` (optimizer, scout, bob)
- `verify-quantitative-claims.md` (scout)
- `knowledge-dedup-check.md` (scout)
- `task-instruction-compliance.md` (coder)
- `multi-file-discovery-completeness.md` (coder)
- `sanitize-content.md` (shared)

### 5. Real skill count: ~100 (not 156)
- 108 .md files in agents/*/skills/
- ~50 more in agents/shared/skills/ subdirectories (not fully counted)
- Minus 8 junk README.md = ~100 real per-agent skills + ~50 shared

## Behavioral Effectiveness: UNKNOWN

Structural quality ≠ behavioral effectiveness. A well-written skill that agents ignore is worse than a rough skill they follow. We need:

1. **Gym A/B tests** (EXP-250 in progress) — fork with/without skill, measure pass rate delta
2. **Instruction-compliance tracking** — does the agent actually DO what the skill says?
3. **Regression testing** — promoted skills retested quarterly

## Recommendations

1. **Cull the 8 README placeholders** — they're noise
2. **Add evidence citations to top-24 skills** (score 4, missing evidence) — even "deployed based on KE-xxx" counts
3. **Run EXP-250** to get first behavioral effectiveness data for a skill
4. **Define "verified" status** — a skill is verified when it has gym data showing ≥30pp improvement

## Next Actions
- [ ] EXP-250: Amy path-orientation (blocked on gym runner)
- [ ] Delete/archive README.md placeholders from skill counts
- [ ] Pick top 3 score-4 skills and add evidence backing
