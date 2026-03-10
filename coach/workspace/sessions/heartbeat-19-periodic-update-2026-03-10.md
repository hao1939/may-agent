# Periodic Tasks Update — 2026-03-10 (19th heartbeat)

## Updates needed in periodic-tasks.md:
1. **Line 8**: Change "Last done: 2026-03-10 (6th run)" → "Last done: 2026-03-10 (7th run)"
2. **After line 14**: Add new result:
   `**Result (2026-03-10 7th):** 1158 total evaluations (+20 since last scan of 1138). 20 new evaluations: 5 evaluator (skipped), 1 optimizer q=0.78 (good), 4 coder q=0.62 (acceptable), 5 coder q=0.35 (needs_improvement — known COACHEES split false positives), 1 scout q=0.8 (good), 2 coder q=0.88 (good), 2 qa q=0.92 (good). No new actionable issues.`

## Session Log Entry:

### 2026-03-10 — Heartbeat (19th)
**Activity:** Evaluation scan (7th) + Convention library review (first) 
**Result:** 1158 evaluations (+20). Convention library reviewed against reality — 3 new conventions added (B12, O9, O10), all validated by 2+ sessions of evidence. No new coaching targets from evaluation data.
**Actions taken:**
- Evaluation scan: 1158 total (+20 since 1138). All new evals are good/acceptable or known false positives. No new coaching targets.
- Convention library review: First systematic review of all 35 conventions against evaluation data and coaching sessions.
  - Verified: S1-S7 (all compliant), B8/B10 (mostly compliant), K2-K4/K6 (compliant), C1/C3/C4/C7 (compliant), O1-O3/O6 (compliant)
  - Violated: B7 (16 violations, most common), B2 (14), B6 (8), B3 (5), B1 (4)
  - Not tested: B11 (claim before act), C5/C6 (coordination planning)
  - Added B12 (pattern-based sed, Required/Builder) — 5 eval violations from line-number sed
  - Added O9 (correction saturation, Required/Coach) — Bob 4-exercise evidence
  - Added O10 (model upgrade consideration, Recommended/Coach) — QA GPT-5.2 evidence
- Marked stale todo item (s_1773120271796_139, coach self-session, no eval file)
- Updated todo.md with evaluation scan results

**Key findings:**
- **Most violated conventions are stress-related**: B7 (paths), B2 (verification), B6 (fabrication) — all triggered when agents are under pressure, not during normal operation.
- **B11 (claim before act) is invisible**: Evaluator doesn't test it. Need exercise or evaluator update.
- **Convention library now has 37 conventions**: 7 structure, 12 behavior, 7 knowledge, 7 coordination, 10 operational. Coverage is good but coordination conventions need exercise validation.

**Next priorities:**
- Design convention exercises for B1, B7, K1 (most commonly violated)
- Coder/Scout regression reviews (~2026-04-07)
- Self-review (periodic task)
