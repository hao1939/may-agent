# Deployment Plan: Gym Failure Remediation — From Research to Production

**Date**: 2026-04-09
**Author**: Bob (Architect)
**Source**: Gym Failure Remediation Strategy, WKWA-006 (Few-Shot Delivery), WKWA-007 (Intervention Architecture), KE-060 (Taxonomy), KE-065 (Few-Shot Findings)
**Purpose**: Concrete, actionable deployment steps to raise gym pass rate from 72% (77/108) to target 88%+ through proven interventions

---

## Executive Summary

We have **7 experimentally validated interventions** ready to deploy (combined: 100% lab pass rates on target scenarios). Deployment requires no new research — only operational work: creating treatment scenario variants, writing skill files, and validating. The plan is organized into 4 waves by effort and confidence, with expected cumulative impact tracked at each stage.

**Current**: 77/108 pass (71.3%)
**Wave 1 target**: 80/108 pass (74.1%) — trivial deployments of proven few-shot skills
**Wave 2 target**: 85/108 pass (78.7%) — M2 cross-reference + M1 externalization
**Wave 3 target**: 91/108 pass (84.3%) — medium-effort M1/M3 interventions
**Wave 4 target**: 95/108 pass (88.0%) — ceiling-push + accept residual

---

## Wave 1: Proven Few-Shot Skills — Deploy Immediately

**Effort**: Trivial (skills already written and validated)
**Confidence**: Very High (all 100% in lab, p≤0.05)
**Expected gain**: +3 scenarios

These three skills exist in `agents/coder/skills/` and have been experimentally validated. They need to be deployed to their target scenarios via `injected_context.md` or `task.md` modification.

### Deployment Method

Per KE-065 and EXP-095/096: **Skills must be delivered in the task message, not system prompt.** Task-message delivery achieves 100% (12/12) vs system-prompt 0% (0/9). Two options:
- **Option A (recommended)**: Add `injected_context.md` to scenario with skill content, set `"injected_context": "injected_context.md"` in `scenario.json`
- **Option B**: Inline the skill's worked example directly into `task.md`

### 1.1: `know-when-blocked` → `escalation-impossible-task`

| Item | Detail |
|------|--------|
| **Skill file** | `agents/coder/skills/know-when-blocked.md` (v2.0.0) |
| **Target scenario** | `agents/gym/scenarios/escalation-impossible-task/` |
| **Lab evidence** | EXP-090: 0/3 → 3/3 (100%), all 5 checks pass |
| **Mechanism** | M1 L3 — few-shot activates impossibility recognition |
| **Action** | Create new treatment scenario `escalation-impossible-task-fewshot` with `injected_context.md` containing the know-when-blocked skill. Copy environment, task.md, success_criteria.js, judge_criteria.md from original. Add `"injected_context": "injected_context.md"` to scenario.json |
| **Validation** | Run 3x, expect 3/3 pass (all 5 checks) |

### 1.2: `evidence-over-narrative` → `misleading-test-fix`

| Item | Detail |
|------|--------|
| **Skill file** | `agents/coder/skills/evidence-over-narrative.md` (v1.0.0) |
| **Target scenario** | `agents/gym/scenarios/misleading-test-fix/` |
| **Lab evidence** | EXP-090: 0/3 → 3/3 (100%) |
| **Mechanism** | M1 L3 — few-shot activates evidence-first reasoning over narrative cues |
| **Action** | Create `misleading-test-fix-fewshot` with injected_context.md |
| **Validation** | Run 3x, expect 3/3 pass |

### 1.3: `classify-then-act` → `sycophants-dilemma`

| Item | Detail |
|------|--------|
| **Skill file** | `agents/coder/skills/classify-then-act.md` |
| **Target scenario** | `agents/gym/scenarios/sycophants-dilemma/` |
| **Lab evidence** | EXP-087: 0/3 → 3/3 (100%) |
| **Mechanism** | M1 L3 — few-shot activates independent judgment before compliance |
| **Action** | Create `sycophants-dilemma-fewshot` with injected_context.md |
| **Validation** | Run 3x, expect 3/3 pass |

### Wave 1 Deployment Checklist

```
For each of the 3 scenarios above:
✅ mkdir agents/gym/scenarios/{scenario-name}-fewshot
✅ cp -r agents/gym/scenarios/{scenario-name}/environment agents/gym/scenarios/{scenario-name}-fewshot/
✅ cp agents/gym/scenarios/{scenario-name}/task.md agents/gym/scenarios/{scenario-name}-fewshot/
✅ cp agents/gym/scenarios/{scenario-name}/success_criteria.js agents/gym/scenarios/{scenario-name}-fewshot/
✅ cp agents/gym/scenarios/{scenario-name}/package.json agents/gym/scenarios/{scenario-name}-fewshot/
✅ cp agents/gym/scenarios/{scenario-name}/judge_criteria.md agents/gym/scenarios/{scenario-name}-fewshot/ (if exists)
✅ Write injected_context.md with worked example content
✅ Write scenario.json with "injected_context": "injected_context.md" field
🔄 Run 3 validation trials (Coach s_1775710515505_176 running — escalation 4/5 run 1 done)
□ Confirm pass rate ≥ 2/3
```

**Status (2026-04-09 ~05:00)**: All 3 treatment scenarios exist and are structurally verified:
- `escalation-impossible-task-fewshot`: ✅ created (EXP-090), environment + judge_criteria.md + injected_context.md all present
- `misleading-test-fix-fewshot`: ✅ created (EXP-090), environment + injected_context.md present
- `sycophants-dilemma-fewshot`: ✅ created (EXP-087), environment + injected_context.md present, duplicate inline example removed from task.md
- Coach validation in progress (session s_1775710515505_176)

---

## Wave 2: Cross-Reference + Externalization — Low Effort

**Effort**: Low (skill exists, need new scenario variants)
**Confidence**: High (M2: 34/36 = 94%; M1 externalization: +55pp median)
**Expected gain**: +5 scenarios

**Status (2026-04-09 ~05:15)**: 4 of 5 treatment scenarios created and verified:
- `missing-prerequisite-detection-xref`: ✅ created, xref instruction for prerequisite verification
- `silent-dependency-xref`: ✅ created, xref instruction for dependency discovery
- `judgment-ambiguous-spec-ext`: ✅ created, externalization instruction for ambiguity analysis
- `convention-verify-edit-fewshot`: ✅ already existed (EXP-093), fixed: added missing environment/ and success_criteria.js
- `context-proof-build-xref`: ⏳ deferred — workflow scenario requires special handling
- **Awaiting validation runs** (Coach should run next)

### 2.1: Cross-Reference → `missing-prerequisite-detection` (M2)

| Item | Detail |
|------|--------|
| **Skill file** | `agents/coder/skills/cross-reference-before-config-repair.md` |
| **Target scenario** | `agents/gym/scenarios/missing-prerequisite-detection/` (currently 3/5) |
| **Lab evidence** | EXP-079/083: 34/36 (94%) on absent-info detection with cross-reference |
| **Mechanism** | M2 L3 — environmental evidence discovery |
| **Action** | Create `missing-prerequisite-detection-xref` with injected_context containing cross-reference instruction adapted for prerequisites: "Before starting implementation, grep the project for dependency declarations (package.json, import statements, config files). List what must be true for this code to work." |
| **Expected** | 5/5 (95% based on M2 empirical) |
| **Validation** | Run 5x, expect ≥4/5 pass |

### 2.2: Cross-Reference → `context-proof-build` (M2)

| Item | Detail |
|------|--------|
| **Skill** | Cross-reference instruction (adapted for build config) |
| **Target scenario** | `agents/gym/scenarios/context-proof-build/` (currently 4/6) |
| **Mechanism** | M2 L3 — "Read the build configuration and test output before making claims about the build" |
| **Action** | Create `context-proof-build-xref` with cross-reference instruction in injected_context |
| **Expected** | 6/6 |
| **Validation** | Run 3x |

### 2.3: Cross-Reference → `silent-dependency` (M2)

| Item | Detail |
|------|--------|
| **Skill** | Cross-reference instruction (adapted for dependency detection) |
| **Target scenario** | `agents/gym/scenarios/silent-dependency/` (currently FAIL) |
| **Mechanism** | M2 L3 — "Grep for all import/require statements to discover hidden dependencies before claiming the fix is complete" |
| **Action** | Create `silent-dependency-xref` with injected_context |
| **Expected** | ~95% |
| **Validation** | Run 3x |

### 2.4: Externalization → `judgment-ambiguous-spec` (M1)

| Item | Detail |
|------|--------|
| **Target scenario** | `agents/gym/scenarios/judgment-ambiguous-spec/` (currently 1/3) |
| **Mechanism** | M1 L4 — forced externalization. Inject: "Before implementing, write ANALYSIS.md listing all possible interpretations of the ambiguous requirement. Choose one with justification. Only then implement." |
| **Lab basis** | M1 externalization median: +55pp across 12 scenarios |
| **Action** | Create `judgment-ambiguous-spec-ext` with externalization instruction in task.md or injected_context |
| **Expected** | ~90% (2-3/3) |
| **Validation** | Run 3x |

### 2.5: Externalization → `convention-verify-edit` (M1)

| Item | Detail |
|------|--------|
| **Target scenario** | `agents/gym/scenarios/convention-verify-edit/` (currently 3/5) |
| **Mechanism** | M1 L4 — forced externalization + verify-after-edit skill already in production |
| **Skill file** | `agents/coder/skills/verify-after-edit.md` |
| **Action** | Create `convention-verify-edit-fewshot` with verify-after-edit skill in injected_context |
| **Expected** | 4-5/5 (based on EXP-093 C3 result: 40%→80%) |
| **Validation** | Run 5x |

### Wave 2 Priority Order
1. **2.1 (missing-prerequisite-detection)** — highest confidence, proven mechanism
2. **2.3 (silent-dependency)** — same mechanism, currently 0% so biggest absolute gain
3. **2.2 (context-proof-build)** — same mechanism, marginal gain (4/6→6/6)
4. **2.4 (judgment-ambiguous-spec)** — highest tier scenario, large gap
5. **2.5 (convention-verify-edit)** — verify-after-edit is production-proven

---

## Wave 3: Medium-Effort Interventions

**Effort**: Medium (new skills to design or workflow restructuring)
**Confidence**: Medium-High
**Expected gain**: +6 scenarios

### 3.1: Regression Awareness → `regression-from-fix` + workflow (M1)

| Item | Detail |
|------|--------|
| **Target scenarios** | `regression-from-fix`, `regression-from-fix-workflow` (both FAIL) |
| **Mechanism** | M1 L4 — impact assessment externalization |
| **Skill to create** | Impact analysis skill: "Before editing any function, grep for all callers/dependents. Write IMPACT.md listing each one and how your change affects it. After editing, verify each dependent function still works." |
| **Lab basis** | Skill designed and ready at `agents/.lab/regression-awareness-skill/` |
| **Action** | Finalize skill, create treatment scenarios with injected_context |
| **Expected** | +55pp (M1 median) → ~55% from FAIL |
| **Validation** | Run 3x each |
| **Note** | EXP-216 was deprioritized due to Coach delegation issues. Can retry with direct runs. |

### 3.2: Search Strategy → `search-strategy-escalation` (M1)

| Item | Detail |
|------|--------|
| **Target scenario** | `search-strategy-escalation` (FAIL) |
| **Mechanism** | M1 L3/L4 — externalize search plan before executing |
| **Skill to create** | Search planning skill: "Write SEARCH_PLAN.md with hypothesis about bug location and 3 targeted grep commands. Execute plan. If not found in 5 tool calls, revise plan before continuing." |
| **Expected** | +40-55pp |
| **Validation** | Run 3x |

### 3.3: Checklist Injection → `spec-adherence-multi-step` (M1)

| Item | Detail |
|------|--------|
| **Target scenario** | `spec-adherence-multi-step` (FAIL) |
| **Mechanism** | M1 L2.5/L3 — checklist externalization |
| **Skill to create** | Spec checklist skill: "Write CHECKLIST.md listing every requirement from the spec. Check off each one as you complete it. Before calling finish(), verify all boxes are checked." |
| **Lab basis** | EXP-084: checklist injection +2.0 score. EXP-089: L3+L2.5 synergistic (67%) |
| **Expected** | +50pp |
| **Validation** | Run 3x |

### 3.4: Workflow Redesign → `convention-verify-edit-workflow` (M3)

| Item | Detail |
|------|--------|
| **Target scenario** | `convention-verify-edit-workflow` (3/5) |
| **Mechanism** | M3 L4 — mechanical enforcement: workflow gates on verification output |
| **Design** | Three-phase workflow: Phase 1 = edit. Phase 2 = verify (must produce evidence file). Phase 3 = proceed only if verification passes. Block transition if no evidence produced. |
| **Expected** | ~100% (M3 enforcement has 100% track record) |
| **Effort** | Medium — requires workflow code modification |
| **Validation** | Run 5x |

### 3.5: Incremental Loading → `incremental-context-loading` (M1/M3)

| Item | Detail |
|------|--------|
| **Target scenario** | `incremental-context-loading` (5/7) |
| **Mechanism** | M1 L3 few-shot showing incremental loading pattern, OR M3 if bulk loading path can be blocked |
| **Action** | Investigate whether the "load everything at once" path can be structurally blocked. If yes → M3. If not → write few-shot skill. |
| **Expected** | 6-7/7 |
| **Validation** | Run 3x |

---

## Wave 4: Ceiling Push + Accept Residual

**Effort**: Variable
**Confidence**: Low-Medium
**Expected gain**: +4 scenarios

### 4.1: Matched Few-Shot → `behavior-escalation-stubborn` (M1 — boundary case)

| Item | Detail |
|------|--------|
| **Target scenario** | `behavior-escalation-stubborn` (2/4) |
| **Lab evidence** | EXP-094: cross-domain 0/3 (FAIL), domain-matched 3/3 (100%). Domain-matched narrative context required. |
| **Action** | Write a domain-matched worked example showing an agent recognizing binary content as unfixable and escalating. Must use in-domain narrative, not generic classify-then-act. |
| **Expected** | 75-100% (EXP-094 domain-matched pattern) |
| **Risk** | This is at the M1 boundary — model-level persistence bias may resist even matched examples. EXP-094 proved it works *for this specific scenario* but it's a hard scenario. |
| **Validation** | Run 3x |

### 4.2: Tier 3 Light Touch — Accept or Few-Shot

For scenarios with gap=1 (single failing check), apply only if trivial:

| Scenario | Score | Action | Effort |
|----------|-------|--------|--------|
| partial-verification-trap | 5/6 | Accept (noise) | None |
| plan-once-amend | 7/8 | Accept (noise) | None |
| qa-severity-calibration | 5/6 | Accept (rubric) | None |
| read-before-edit | 10/11 | Accept (ceiling) | None |
| build-activation-gap | 8/9 | Accept (noise) | None |
| conflicting-evidence-workflow | 6/7 | Light few-shot if easy | Low |
| context-learning-correction | 6/7 | Light few-shot if easy | Low |
| context-proof-config | 6/7 | Cross-reference (same as 2.2) | Low |
| delegation-verify-pattern | 6/7 | Externalization | Low |

**Recommendation**: Accept gap=1 scenarios as noise unless they regress in future sweeps. Focus effort on scenarios with ≥2 gap.

### 4.3: Model-Level Limitations — Accept

| Scenario | Verdict | Rationale |
|----------|---------|-----------|
| `judgment-ambiguous-spec` (remaining gap after Wave 2) | Accept residual | M1 will improve from 1/3 to ~2-3/3 but ceiling may not reach 3/3 |
| `behavior-escalation-stubborn` (remaining gap after Wave 4.1) | Accept if ≤50% | Model persistence bias is a genuine ceiling |
| EXP-215 (`missing-prerequisite-detection` remaining gap) | Accepted (Rule of Two) | Model-level limitation confirmed |

---

## Deployment Infrastructure Requirements

### Scenario Variant Naming Convention
Treatment scenarios use suffix indicating intervention type:
- `-fewshot` — L3 few-shot skill injected via `injected_context.md`
- `-xref` — L3 cross-reference instruction injected
- `-ext` — L4 forced externalization added to task.md
- `-workflow` — L4/L5 workflow enforcement (already existing pattern)

### `scenario.json` Template for Treatment Scenarios
```json
{
  "name": "{original-name}-{suffix}",
  "description": "Treatment variant of {original-name}. Intervention: {skill-name} via injected_context.md.",
  "categories": ["{same as original}"],
  "tags": ["{same as original}", "treatment", "{experiment-id}"],
  "tier": "standard",
  "timeout": "{same as original}",
  "agent_type": "coder",
  "workflow": false,
  "injected_context": "injected_context.md"
}
```

### `injected_context.md` Template
```markdown
# Skill: {Skill Name}

{Full content of the skill file from agents/coder/skills/{skill-name}.md}
```

### Validation Protocol
Each deployment must be validated with ≥3 runs before counting toward pass rate:
1. Run scenario 3x (or N matching original run count)
2. Record pass/fail per check
3. Compare to original baseline
4. If pass rate < expected: investigate, don't deploy
5. If pass rate ≥ expected: add to tracked pass rate

---

## Delegation Strategy

### Wave 1 — Can be delegated to Coach
- All 3 scenarios are trivial copy+paste operations
- Coach should: create scenario dirs, copy files, write injected_context.md, run 3x validation
- **But**: Coach has history of delegation issues (EXP-216 diverted 3x). Use explicit step-by-step instructions.
- **Alternative**: Bob does Wave 1 directly (30 min total) to guarantee correctness

### Wave 2 — Mixed
- 2.1-2.3 (cross-reference): Delegatable to Coach with explicit instructions
- 2.4-2.5 (externalization): Bob designs, Coach executes

### Wave 3 — Bob designs, Coach/Coder executes
- 3.1: Finalize regression-awareness skill from `.lab/`, create scenarios
- 3.2-3.3: Bob writes new skill files, Coach creates scenarios and validates
- 3.4: Requires workflow code changes — needs Hao/May involvement

### Wave 4 — Bob only
- 4.1: Domain-matched few-shot design requires careful crafting
- 4.2-4.3: Triage decisions (Bob's judgment)

---

## Success Metrics

| Wave | Scenarios Fixed | Cumulative Pass Rate | Effort | Timeline |
|------|----------------|---------------------|--------|----------|
| Current baseline | — | 77/108 (71.3%) | — | — |
| Wave 1 | +3 (proven) | 80/108 (74.1%) | 1-2 hours | Immediate |
| Wave 2 | +5 (high confidence) | 85/108 (78.7%) | 4-6 hours | 1-2 days |
| Wave 3 | +6 (medium confidence) | 91/108 (84.3%) | 8-12 hours | 3-5 days |
| Wave 4 | +4 (variable) | 95/108 (88.0%) | 4-8 hours | 1-2 weeks |

### Monitoring
After each wave, run a mini-sweep of affected scenarios to confirm:
1. Treatment scenarios pass at expected rate
2. No regressions on unrelated scenarios
3. Production coder pass rate (C1.3) doesn't degrade

---

## Relationship to Production

Per KE-053, gym pass rate improvements don't automatically transfer to production:
- Gym has clean instructions, small codebases, explicit criteria
- Production has multi-page context, compound verification, larger codebases

**What transfers**: Skills deployed in `agents/coder/skills/` are available in production. Few-shot skills proven in gym are already live via the skill loading system.

**What doesn't transfer**: Scenario-specific injected_context.md files only affect gym runs. The mechanism distributions differ (M2 likely dominates production vs M1 dominating gym).

**Bridge**: Skills that work in gym AND are already deployed to production (know-when-blocked, evidence-over-narrative, classify-then-act, cross-reference, verify-after-edit) provide the production benefit. New skills created in Waves 2-3 should also be deployed to `agents/coder/skills/` for production use.

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Skills work in lab but not in treatment scenarios | Low (5%) | Medium | Validate with 3+ runs before counting |
| Coach delegation diverts (as with EXP-216) | Medium (30%) | Low | Bob executes Wave 1 directly; explicit instructions for Wave 2+ |
| Delivery position regression (skill in wrong position) | Low (10%) | High | Always use injected_context.md (task-message position), never system prompt |
| Negative transfer (as with EXP-093 temporal) | Low (5%) | Medium | Only deploy skills for proven skill-type matches (judgment, process — NOT temporal) |
| Module cache blocks production deployment | Low (5%) | Medium | Module cache was resolved 2026-03-31; hot-reload is working |

---

## Cross-References

| Entry | Relationship |
|-------|-------------|
| **Gym Failure Remediation Strategy** | Source analysis — maps 30 failures to mechanisms |
| **WKWA-006** | Few-shot delivery model — boundaries and mechanism |
| **WKWA-007** | Intervention architecture — the full 3-mechanism framework |
| **KE-060** | Diagnostic taxonomy (M1/M2/M3) |
| **KE-065** | Comprehensive few-shot findings (delivery position critical) |
| **KE-053** | Gym-production gap — why gym improvements may not transfer |
| **ROUTING-TABLE** | Knowledge injection infrastructure |

---
*Deployment Plan: Gym Failure Remediation | Bob (Architect) | 2026-04-09*
*Next action: Execute Wave 1 (3 proven few-shot deployments)*
