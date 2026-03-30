# Workflow Registry

**Owner**: Optimizer (accountable for quality, deduplication, effectiveness tracking)
**Last audit**: 2026-03-30T21:10

## Shared Workflows (available to all agents)

| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `code-review-loop` | `shared/workflows/code-review-loop.ts` | 134 | Delegate code to coder, QA reviews, retry once on fixable issues |
| `context-learn` | `shared/workflows/context-learn.ts` | 276 | Extract and persist lessons from completed work |
| `evidence-gate` | `shared/workflows/evidence-gate.ts` | 217 | Gate a change behind evidence: measure baseline, apply, re-measure |
| `predict-then-verify` | `shared/workflows/predict-then-verify.ts` | 221 | Make prediction, execute, compare outcome to prediction |
| `reviewed-delivery` | `shared/workflows/reviewed-delivery.ts` | 89 | Build then review in sequence |
| `skill-lifecycle` | `shared/workflows/skill-lifecycle.ts` | 246 | Full lifecycle: propose → test → measure → promote/retire a skill |
| `two-phase` | `shared/workflows/two-phase.ts` | 192 | Generic two-phase workflow (plan then execute) |

## Agent-Specific Workflows

### Bob
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `deliver-or-report` | `bob/workflows/deliver-or-report.ts` | 185 | Attempt delivery, report back if blocked |

### Coach
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `convention-review` | `coach/workflows/convention-review.ts` | 50 | Review agent output against conventions |
| `growth-cycle` | `coach/workflows/growth-cycle.ts` | 318 | Full training cycle: assess → train → measure |
| `gym-helpers` | `coach/workflows/gym-helpers.ts` | 206 | Helper functions for gym scenarios (not a workflow) |
| `training-sprint` | `coach/workflows/training-sprint.ts` | 286 | Focused training session on a specific skill |
| `verify-setup` | `coach/workflows/verify-setup.ts` | 42 | Verify gym/training infrastructure is ready |

### May
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `design-then-build` | `may/workflows/design-then-build.ts` | 94 | Design phase then implementation |
| `implement-and-review` | `may/workflows/implement-and-review.ts` | 107 | ⚠️ DUPLICATE — see consolidation notes |
| `project-monitor` | `may/workflows/project-monitor.ts` | 97 | Actively monitor external projects — verify work, give feedback, escalate |
| `research-pipeline` | `may/workflows/research-pipeline.ts` | 84 | Multi-step research workflow |
| `test-and-fix` | `may/workflows/test-and-fix.ts` | 45 | Run tests, fix failures |
| `verify-and-finish` | `may/workflows/verify-and-finish.ts` | 272 | ⚠️ DUPLICATE — identical to tech-lead's |
| `verify-parallel` | `may/workflows/verify-parallel.ts` | 331 | ⚠️ DUPLICATE — see consolidation notes |

### Optimizer
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `design-review` | `optimizer/workflows/design-review.ts` | 119 | Review a design doc before implementation |
| `enhance-cron` | `optimizer/workflows/enhance-cron.ts` | 351 | Safely modify cron configuration |
| `implement-and-review` | `optimizer/workflows/implement-and-review.ts` | 98 | ⚠️ DUPLICATE |
| `safe-edit` | `optimizer/workflows/safe-edit.ts` | 291 | Edit with rollback capability |
| `verify-parallel` | `optimizer/workflows/verify-parallel.ts` | 331 | ⚠️ DUPLICATE — identical to may's |

### QA
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `vet-skill` | `qa/workflows/vet-skill.ts` | 266 | Evaluate a skill proposal end-to-end |

### Tech-Lead
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `implement-and-review` | `tech-lead/workflows/implement-and-review.ts` | 122 | ⚠️ DUPLICATE — has evolved best QA prompts |
| `verified-coder` | `tech-lead/workflows/verified-coder.ts` | 176 | Code with built-in verification |
| `verify-and-finish` | `tech-lead/workflows/verify-and-finish.ts` | 272 | ⚠️ DUPLICATE — identical to may's |
| `verify-parallel` | `tech-lead/workflows/verify-parallel.ts` | 343 | ⚠️ DUPLICATE — has best QA prompt framing |

## Consolidation Plan (Optimizer TODO)

### Priority 1: `verify-and-finish`
- may and tech-lead versions are **byte-identical**
- Action: Move to shared, delete both local copies

### Priority 2: `verify-parallel`
- may and optimizer versions are **identical**
- tech-lead version has evolved **better QA prompt framing**: Phase 1 DIAGNOSE / Phase 2 VERDICT pattern, pre-existing failure detection
- Action: Promote tech-lead's version to shared, delete all 3 local copies

### Priority 3: `implement-and-review`
- 3 versions with divergent improvements:
  - may (107L): More detailed QA framing, "NOTE: Frame coder output as claims"
  - optimizer (98L): Leaner, basic
  - tech-lead (122L): Has evolved best diagnostic prompts
- Action: Merge best elements into shared version, delete local copies

### Not duplicates (agent-specific, keep local):
- All coach workflows (training-specific)
- bob/deliver-or-report (bob-specific delivery pattern)
- optimizer/safe-edit, enhance-cron, design-review (optimizer-specific safety patterns)
- qa/vet-skill (QA-specific)
- tech-lead/verified-coder (tech-lead-specific)

## Effectiveness Tracking

**Last measured**: 2026-03-30T21:10 (all-time data, 177 workflow runs, 460 sessions)

### Overall Metrics
| Metric | Workflow Sessions | Non-Workflow Sessions |
|--------|------------------|----------------------|
| Quality (good+acc) | 70.7% (325/460) | 81.4% (12291/15108) |
| Error rate | 2.6% (12/460) | 18.1% (2733/15112) |
| Avg ops/session | 11.2 | — |
| Run completion rate | 72.9% (129/177) | — |
| Avg ops/completed run | 32.8 | — |

### Key Findings
1. **Workflows reduce errors dramatically** (2.6% vs 18.1%) — structured multi-step execution prevents crashes
2. **Quality is lower** (70.7% vs 81.4%) — driven by coach training workflows (68 NI) and coder sub-sessions (40 NI)
3. **Coach is the biggest NI source** — 68/133 needs_improvement in workflows are coach sessions (TASK_NONCOMPLETION in sprint planning)
4. **27.1% of runs interrupted** — 48/177 runs don't complete, wasting avg 19.1 ops each (total ~917 ops wasted)
5. **Job-kind sessions** (124) have 0 ops but still evaluated — may inflate NI counts for sub-task dispatches

### Consolidation Priority Updates (validated 2026-03-30T21:10)
- **P1 verify-and-finish**: Confirmed byte-identical (may vs tech-lead) ✓
- **P2 verify-parallel**: may/optimizer identical; tech-lead has better QA prompt (Phase 1 DIAGNOSE / Phase 2 VERDICT, pre-existing failure detection) ✓
- **P3 implement-and-review**: 3 versions divergent — tech-lead has best prompts (DIAGNOSE/VERDICT pattern + verification phase 4), may has "claims" framing note

### Recommendations
1. **Consolidate P1 immediately** — verify-and-finish is byte-identical, zero risk
2. **Consolidate P2 with tech-lead's version** — strictly better QA prompts
3. **Consolidate P3 by merging** — combine tech-lead's DIAGNOSE/VERDICT + may's "claims" note
4. **Investigate coach training workflow NI rate** — 68 NI sessions suggest sprint planning prompts need improvement
5. **Track interrupted runs** — 27% interruption rate means ops waste; consider timeout tuning
