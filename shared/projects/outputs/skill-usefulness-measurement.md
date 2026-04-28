# Skill Usefulness Rate — Initial Measurement

**Date**: 2025-06-26
**Methodology**: Per `skill-usefulness-design.md` intent — sample sessions where skills were applied, score: first-pass success + no rework + no rejection.
**Sample**: 15 recent sessions from checkpoints (all bob/tech-lead, reflecting primary skill consumers)

## Definition

**skill.usefulness-rate** = (sessions where skill-influenced behavior led to first-pass success) / (sessions where skill-influenced behavior was observed)

"Useful" means the skill-aligned behavior **contributed to task completion** without rework or rejection. This goes beyond "used" (behavioral compliance) to "actually helped."

## Scored Sessions

| # | Session | Agent | Skill Signal | First-Pass Success | Rework | Rejection | Useful? |
|---|---------|-------|-------------|-------------------|--------|-----------|---------|
| 1 | s_1777382729184_148 | bob | SCBA (6 reads, 6 edits, structured experiment) | ✅ EXP-261 complete | None | None | ✅ |
| 2 | s_1777379126618_128 | bob | SCBA (baseline reads before treatment) | ✅ EXP-260 complete | None | None | ✅ |
| 3 | s_1777377493591_115 | bob | SCBA (5 baseline trials before treatment) | ✅ Baseline complete | None | None | ✅ |
| 4 | s_1777375528366_99 | bob | Evidence-Over-Narrative (dismissed stale notifs with reasoning) | ✅ EXP-259 writeup + EXP-260 design | None | None | ✅ |
| 5 | s_1777357999295_18 | bob | SCBA (created 6 scenario variants, ran pilots first) | ✅ EXP-257 Phase 1 complete | None | None | ✅ |
| 6 | s_1777345305501_236 | bob | Verify-Before-Finish (5/5 structural auditor confirmed) | ✅ EXP-242 Phase 0 complete | None | None | ✅ |
| 7 | s_1777336304994_175 | bob | Evidence-Over-Narrative (promoted hypotheses with evidence) | ✅ 2 KEs promoted, EXP-256 deployed | None | None | ✅ |
| 8 | s_1777334504974_162 | bob | Evidence-Over-Narrative (20 sessions analyzed for H-EXP-046) | ✅ Hypothesis resolved | None | None | ✅ |
| 9 | s_1777321905309_73 | bob | SCBA (17/24 trials with controls) | ⚠️ Partial (status noted) | None | None | ⚠️ Partial |
| 10 | s_1777318305281_37 | bob | Evidence-Over-Narrative (quality scoring: 1.2/8 vs 7.4/8) | ✅ EXP-251 Phase 1 complete | None | None | ✅ |
| 11 | s_1777313991955_4 | bob | SCBA (compression audit with metrics) | ✅ EXP-249 Phase 1 complete | None | None | ✅ |
| 12 | s_1777301862116_95 | bob | Evidence-Over-Narrative (9/20 data → shelved as inconclusive) | ✅ Correct decision to shelve | None | None | ✅ |
| 13 | s_1777300062220_84 | bob | Evidence-Over-Narrative (4/30 validated scorecard) | ✅ EXP-245 scorecard complete | None | None | ✅ |
| 14 | s_1777278816790_1224 | tech-lead | SCBA (exported tables, verified before recreate) | ✅ DB fixed 460MB→24MB | None | None | ✅ |
| 15 | s_1777271772827_1174 | bob | Evidence-Over-Narrative (rejected own hypothesis with 0/3 data) | ✅ EXP-240 closed correctly | None | None | ✅ |

## Results

- **Sessions with skill-aligned behavior**: 15/15 (100% — all sampled sessions showed SCBA or Evidence-Over-Narrative)
- **First-pass success**: 14/15 (one partial)
- **Rework required**: 0/15
- **Rejection by caller**: 0/15

### **skill.usefulness-rate = 93% (14/15)**

The one partial (session 9) still completed its objective in a subsequent session — the partial status was due to session time, not skill failure.

## Interpretation

The high usefulness rate reflects two things:

1. **SCBA is genuinely useful** — reading state before acting prevents errors. 86% behavioral adoption (from audit) × 93% usefulness = SCBA contributes real value.

2. **Evidence-Over-Narrative is the most useful skill** — every session where bob cited data to make decisions (promote, shelve, reject) reached correct conclusions first-pass. This skill prevents wasted cycles on bad hypotheses.

3. **Verify-Before-Finish has lower adoption (33%)** but when used, it's always useful — the bottleneck is adoption, not usefulness.

## Caveats

- **Sample bias**: All 15 sessions are bob (researcher) or tech-lead. These agents do analytical work where SCBA/Evidence naturally help. Worker agents (coder, amy) doing edit-heavy tasks may show different rates.
- **Survivor bias**: We only see sessions that produced checkpoints. Sessions that crashed or were abandoned aren't captured.
- **Attribution difficulty**: It's hard to separate "agent would have done this anyway" from "skill caused this behavior." The 93% is an upper bound.

## Recommended Target

| Metric | Current | Recommended Target | Rationale |
|--------|---------|-------------------|-----------|
| skill.usefulness-rate | 93% | ≥ 80% | Allow for harder tasks where skills don't help. Below 80% suggests skills are busywork. |

## Next Steps

1. **Measure across worker agents** (coder, amy) — they do different work where usefulness may differ
2. **Track over time** — if usefulness drops below 80%, investigate whether new skills are adding noise
3. **Use as a gate** — new skills must demonstrate usefulness-rate ≥ 80% in pilot before broad deployment
