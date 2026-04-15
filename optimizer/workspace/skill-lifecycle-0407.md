# Skill Lifecycle Review — April 7, 2026

**Previous review**: Mar 30 (54 skills, 5 saturations)
**Current inventory**: 46 shared skill directories + 12 loose .md skills = 58 unique skills
**Lab forks**: 29 experimental forks in agents/.lab/
**Gym runs (7d)**: 22 (all Apr 1-2, none since)
**Sessions analyzed**: 1,189 (7 days)

---

## 1. Skill Status Summary (from LIBRARY.md)

| Status | Count | Skills |
|--------|-------|--------|
| ✅ proven (workflow) | 5 | evidence-over-narrative, verify-before-finish, obstacle-pivot, tool-discipline, sycophancy-resistance |
| ✅ proven (skill file) | 2 | grep-first-reading (as file), structured-plan-writing |
| 📦 deployed | 5 | materialize-findings-concise (scout), verify-before-finish-micro (may), read-before-edit (scout/bob/may/tech-lead), verify-after-edit (ALL), structured-plan-writing (coder) |
| ❌ disproven (text) | 3 | classify-then-act, investigate-and-fix (text), grep-first-reading (workflow) |
| ⚪ untested | 6 | check-state, scope-discipline, task-adherence, brainstorm-before-build, regression-awareness, prerequisite-detection |
| ⚪ untested (ceiling) | 6 | check-state, scope-discipline, task-adherence, stale-approach-fixation, search-strategy-escalation, incremental-context-loading, wrong-fix-recovery |
| ⚠️ deployed (no lift) | 1 | read-before-edit (C1.1 declining despite deployment) |

**Note**: Many shared skill dirs exist but have no entry in LIBRARY.md and are not deployed.

## 2. Deployed Skills (16 unique across 7 agents)

| Skill | Deployed To | Evidence of Impact |
|-------|-------------|-------------------|
| verify-after-edit | ALL (7 agents) | C1.3 at 85.9% (7d) — was tightened Apr 6 |
| read-before-edit | bob, may, scout, tech-lead | C1.1 at 87.1% (7d) — ⚠️ KE-023 shows NO production lift, declining |
| efficient-file-reading | coder | Gym: 6/8→8/8 |
| structured-plan-writing | coder | Gym: 7/8→8/8 |
| experience-replay | coder, tech-lead | Not independently measured |
| know-when-blocked | coder | Not independently measured |
| materialize-findings-concise | scout | Gym: 52%→78% checks |
| verify-before-finish | may | C1.7 at 98.1% (7d) — up from 62.5% |
| consolidate-memory | coach | Coach-specific training skill |
| growth-cycle | coach | 13 task mentions (7d) — actively used |
| log-error | coach | Coach-specific |
| micro-reward | coach | Coach-specific |
| reactive-lesson | coach | Coach-specific |
| red-team | coach | Coach-specific |
| transient-skill | coach/may | 1 mention (7d) |
| search-governance | scout | Scout-specific |

## 3. Saturation Analysis (skills that can't be improved further)

### Already-Ceiling Skills (gym baseline already passes):
- **check-state**: baseline 8/8 (Apr 3)
- **scope-discipline**: baseline all-pass (Apr 3)
- **task-adherence**: baseline 10/10 (Apr 3)
- **stale-approach-fixation**: baseline 7/7 (Apr 3)
- **search-strategy-escalation**: baseline 6/6 (Apr 3)
- **incremental-context-loading**: baseline 7/7 (after scorer fix)
- **wrong-fix-recovery**: baseline 6/6 (EXP-035, Apr 6)

**New since Mar 30**: wrong-fix-recovery (was 2/6, now 6/6 — compound skill effect from EXP-040)

### Production-Saturated (convention compliance ≥95%):
- C1.7 verify-before-finish: **98.1%** — essentially solved
- C3.3: **99.3%** — solved
- C2.1: **99.9%** — solved
- C3.2: **98.1%** — solved
- C12.1: **96.8%** — near-solved

**Total saturated**: 7 gym scenarios + 5 convention metrics = 12 saturations (up from 5 on Mar 30)

## 4. Unused/Dead Skills (candidates for pruning)

### Never Deployed, Never Tested, No Activity (39 shared skill dirs):
These exist as .md files in shared/skills/ but are never loaded by any agent and have no gym evidence:

**Strong prune candidates** (last modified ≤ Mar 24, no mentions, no gym evidence):
1. **agent-coordination** — Mar 17, 0 mentions, 0 gym runs
2. **agent-growth** — Mar 12, 0 mentions, 0 gym runs
3. **baseline-before-change** — Mar 19, 0 mentions, 0 gym runs
4. **build-activation-verification** — Mar 25, 0 mentions, 0 gym runs
5. **consolidate-memory** (shared dir) — duplicate? Coach has its own copy
6. **constructive-friction** — loose .md, 0 mentions
7. **critical-pause** — loose .md, 0 mentions
8. **delegation-verification** — Apr 7 (renamed only), 0 gym runs
9. **deliverable-integrity** — Mar 24, 0 mentions
10. **document-collaboration** — Mar 12, 0 mentions
11. **error-handling** — Mar 20, 0 mentions
12. **evaluator-scoring** — Mar 12, 0 mentions
13. **experiment-before-apply** — loose .md, 0 mentions
14. **extract-directives** — loose .md, specific to May's workflow
15. **file-safety** — Mar 17, 0 mentions
16. **idempotent-work-detection** — Mar 23, 0 mentions
17. **knowledge-sharing** — Mar 31, 0 mentions
18. **l3-delegation-metrics** — Mar 13, 0 mentions
19. **plan-once-amend** (shared dir) — 1 mention, but coder already has structured-plan-writing deployed
20. **prerequisite-gap-protocol** — Mar 25, 0 mentions
21. **progressive-work-persistence** — Mar 24, 1 mention (evaluator, passive)
22. **prototype-skill-package** — Mar 14, 0 mentions
23. **request-triage-memoization** — Mar 24, 0 mentions
24. **sanitize-content** — loose .md, 0 mentions
25. **sanitize-memory** — loose .md, 0 mentions
26. **state-check-before-action** — Mar 23, 0 mentions
27. **synthesis-dpir** — loose .md, 0 mentions (Bob uses it implicitly?)
28. **verification** — Mar 19, 0 mentions (generic, superseded by verify-after-edit)
29. **verification-consistency** — Mar 24, 0 mentions
30. **web-scraping** — Mar 13, 0 mentions

### Disproven (should be archived, not deployed):
1. **classify-then-act** — ❌ disproven in EXP-017, EXP-032 (0% effect as text, 75% as workflow but not deployed)
2. **grep-first-reading** (as workflow) — ❌ disproven, WORSE than baseline
3. **investigate-and-fix** (as text) — ❌ disproven, 0/4 reproduce-first

### Problematic Deployments:
1. **read-before-edit** — ⚠️ Deployed to 4 agents, NO production improvement (KE-023). C1.1 at 87.1% but was declining. Scout worst at 23.8% (48h window, Apr 5). **Should NOT be removed** — may still help. But "deploy and hope" strategy failed. Needs heartbeat workflow gate (escalated to May Apr 6).

## 5. Workflow Promotion Candidates

Skills proven as workflows but NOT yet wired into production heartbeats:

| Skill | Gym Evidence | Promotion Path |
|-------|-------------|----------------|
| evidence-over-narrative | 5/8→11/11 (misleading-test-fix) | Wire into tech-lead/coder for diagnosis tasks |
| obstacle-pivot | 0/3→3/3 escalation (strongest A/B ever) | Wire into any agent hitting escalation failures |
| sycophancy-resistance | 3/6→9/9 (L5 strict, 5 runs) | Wire via L5 gate for judgment-heavy tasks |
| tool-discipline (npx) | 0→100% npx avoidance | Already handled by context.md env fact |

**Recommendation**: evidence-over-narrative and obstacle-pivot are the strongest candidates. Both require specific task contexts to trigger. Best approach: add to implement-and-review workflow for tech-lead/coder tasks involving diagnosis.

## 6. Lab Fork Status (29 forks)

**Active/Useful**:
- coder-no-* ablation forks (5) — for EXP-040 ceiling shift testing
- verify-after-edit-strict, verify-after-edit-v2 — iterating on deployed skill
- may-fm25-fix, tl-fm33-verified-workflow — targeting specific convention regressions

**Stale/Should archive**:
- archive/ (already archived)
- classify-then-act-skill — disproven
- context-efficient-reading — superseded by efficient-file-reading deployment
- read-before-edit-skill — deployed, fork no longer needed
- structured-plan-writing-skill — deployed, fork no longer needed
- verify-before-finish-skill — deployed, fork no longer needed
- wrong-fix-recovery-skill/workflow — ceiling (EXP-035)

## 7. Key Changes Since Mar 30 Review

1. **EXP-040 Ceiling Shift**: 4/5 non-ceiling scenarios are now ceiling with deployed skills. Compound skill effect is real and dramatic.
2. **Only 1 non-ceiling scenario remains**: sycophants-dilemma (judgment gap, requires L5+)
3. **New harder scenarios urgently needed** — the gym is nearly saturated
4. **verify-after-edit tightened** (Apr 6) — fixed misleading escape hatch, all agents
5. **verify-before-finish success**: C1.7 went from 62.5% → 98.1% — strongest convention recovery
6. **read-before-edit failure**: Despite deployment to 4 agents, no production lift (KE-023)
7. **No gym runs since Apr 2** — gym activity stopped, likely due to ceiling saturation + dispatcher mode focus

## 8. Recommendations

### Prune (archive to shared/skills/archive/):
Archive 20+ dead skills that are untested, undeployed, and have no mentions. They add noise to the skill inventory. Keep:
- Skills with gym evidence (proven or disproven — valuable data)
- Skills actively deployed
- Skills with lab forks in active testing

### Do NOT prune:
- obstacle-pivot, evidence-over-narrative, sycophancy-resistance (proven as workflows, promotion candidates)
- Any skill referenced in LIBRARY.md with gym data

### Archive lab forks:
Move to agents/.lab/archive/: classify-then-act-skill, context-efficient-reading, read-before-edit-skill, structured-plan-writing-skill, verify-before-finish-skill, wrong-fix-recovery-*

### Next actions:
1. **Create harder gym scenarios** — #1 priority, ceiling saturation blocks all skill testing
2. **Wire workflow promotions** for evidence-over-narrative and obstacle-pivot
3. **Monitor read-before-edit** after heartbeat workflow gate deployment
4. **Track verify-after-edit tightening** — did Apr 6 fix improve C1.3 from 85.9%?

---
*Next review: Apr 14, 2026*
