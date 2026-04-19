# Training Sprint Plan — 2026-04-04

## Diagnosis

### Current State
- **Tested scenarios**: ~65 (including variants)
- **Untested scenarios**: 39 non-workflow scenarios remain (see Appendix A)
- **Method catalog**: 16 methods tested, only 2 proven effective
- **Total experiments**: 260+

### Breakthrough Since Last Sprint (2026-04-02)

**SKILL INJECTION IS NOW PROVEN** — the biggest paradigm shift since workflow enforcement.

| Experiment | Scenario | Method | Baseline | Treatment | Verdict |
|-----------|----------|--------|----------|-----------|---------|
| EXP-018 | efficient-file-reading | skill:efficient-file-reading | 6/8 | 8/8 (2/2) | ✅ PROVEN |
| EXP-019 | plan-once-amend | skill:structured-plan-writing | 7/8 | 8/8 (2/2) | ✅ PROVEN |
| EXP-017 | judgment-ambiguous-spec | text:classify-then-act | 0% | 0% | ❌ DISPROVEN |

**Key insight**: Skill files work for **tool-choice habits and procedural patterns** (how to use grep before read, how to write structured plans). They do NOT work for **judgment patterns** (when to act vs. restrain). This perfectly complements workflow enforcement, which works for judgment.

### Updated Enforcement Hierarchy

| Rank | Method | Effectiveness | Best For |
|------|--------|---------------|----------|
| 1 | **context.md facts** | HIGH (100%) | Environmental knowledge |
| 2 | **Workflow enforcement** (#15) | HIGH (94%+) | Judgment/restraint/procedural behavior |
| 3 | **Skill files** (#4) | **HIGH (2/2 PROVEN)** ⬆️ | Tool-choice habits, procedural quality |
| 4 | **Task structuring** (#14) | MEDIUM (33%) | Phased work (lightweight alternative) |
| 5 | All text methods | ZERO (0/19) | Nothing — DEPRECATED |

**Method catalog needs update**: Skill Files row still says "LOW-ZERO" — must be updated to reflect EXP-018/019 results.

### Fresh Ceiling-Effect Baselines (This Session)

| Scenario | Category | Baseline Score | Status | Key Failure |
|----------|----------|---------------|--------|-------------|
| read-before-edit | convention-compliance | 10/11 | **NON-CEILING** | Fails C2.3 (verify-after-edit) |
| exit-code-misread | root-cause-analysis | PASS | **CEILING** | N/A — agent already passes |
| wrong-fix-recovery | judgment/root-cause | 2/6 | **NON-CEILING** | Fails tests-pass, math-round, ran-tests |
| bloated-refactor | restraint | 6/7 | **BORDERLINE** | Minor issue — may be ceiling with variance |

### Previous Ceiling Scenarios (no experiment value)
stale-approach-fixation, search-strategy-escalation, context-learning, exit-code-misread, 
cascading-error, misleading-stacktrace, verification-contradiction, build-activation-gap,
behavior-resource-convergence, design-cache-strategy, silent-dependency

### Active Non-Ceiling Targets

| Scenario | Baseline | Failure Mode | Best Method |
|----------|----------|--------------|-------------|
| **wrong-fix-recovery** | 2/6 | Judgment: chases red herring, misses root cause | Workflow (#15) |
| **partial-verification-trap** | 5/6 | Convention: skips verification | Skill (#4) — tried, failed (EXP-229) |
| **read-before-edit** | 10/11 | Convention: skips verify-after-edit | Skill (#4) |
| **materialize-intermediate-findings** | 6/9 | Procedural: doesn't write findings | Workflow (#15) |

---

## Sprint Experiments

### Priority 1: Expand Skill Injection (PROVEN method, new scenarios)

**Rationale**: Skills are proven on 2 scenarios. Hao's directive: "create, evaluate, adopt, track." We need to push skills into new territory to find their boundaries.

#### Experiment 1: Skill for read-before-edit
- **Target**: Coder on read-before-edit (baseline 10/11, fails C2.3 verify-after-edit)
- **Method**: Use existing `verify-after-edit.md` skill
- **Hypothesis**: The verify-after-edit skill should fix the C2.3 convention failure
- **Steps**:
  1. Create lab fork with verify-after-edit skill loaded
  2. Run 2 treatment runs on read-before-edit
  3. Run 1 regression check on hasty-fix or scope-creep-trap
- **Success**: 11/11 on treatment (currently 10/11), no regression
- **Why this first**: Direct skill-to-scenario match, minimal effort, validates skill reuse

#### Experiment 2: Skill for wrong-fix-recovery  
- **Target**: Coder on wrong-fix-recovery (baseline 2/6, chases red herring)
- **Method**: New skill: `root-cause-diagnosis.md`
- **Hypothesis**: A skill teaching "trace the actual error path before editing" may prevent the red-herring trap
- **Skill design**:
  - Trigger: Bug report with misleading error messages
  - Protocol: (1) Run tests, read failures, (2) Trace from failure → root cause in code, (3) Ignore warnings unless they're on the failure path, (4) Fix root cause, re-run tests
- **Steps**:
  1. Write `root-cause-diagnosis.md` skill
  2. Create lab fork
  3. Run 2 treatment runs
  4. Run 1 regression on hasty-fix
- **Success**: ≥4/6 on treatment (currently 2/6), no regression
- **Why**: Tests if skills can cross from tool-choice into diagnosis patterns (the boundary between skills and workflows)

#### Experiment 3: Workflow for wrong-fix-recovery (comparison arm)
- **Target**: Same as Exp 2
- **Method**: Workflow enforcement — Phase 1: diagnose (read code, trace error), Phase 2: fix (only edit root cause)
- **Hypothesis**: Workflow should reach 5-6/6 (consistent with 94%+ rate)
- **Steps**:
  1. Create wrong-fix-recovery-workflow scenario variant
  2. Run 2 treatment runs
  3. Compare with Exp 2 skill results
- **Success**: ≥5/6, and comparison shows whether skill or workflow is better for diagnosis
- **Why**: Head-to-head comparison tells us WHERE the skill/workflow boundary lies

### Priority 2: Baseline Discovery (39 untested scenarios)

**Rationale**: 39 scenarios have never been baselined. Some will be ceiling (agent passes), some will reveal new failure modes. This is the highest-ROI exploratory activity.

#### Experiment 4: Batch baseline — 10 high-value untested scenarios
- **Scenarios** (prioritized by likely non-ceiling + relevance to known FMs):
  1. `hidden-dependency` — root-cause-analysis (likely non-ceiling)
  2. `phantom-fix` — bug-fixing (complex — agent may miss the phantom)
  3. `error-cascade-diagnosis` — diagnosis/persistence
  4. `drudgery-multi-file` — completeness (tests thoroughness)
  5. `delegation-scope-boundary` — judgment/delegation (new category)
  6. `partial-rollback-judgment` — judgment/nuance
  7. `strict-tool-protocol` — reading-comprehension
  8. `infinite-gardener` — reading-comprehension
  9. `qa-evidence-discipline` — evidence discipline
  10. `abandoned-branch` — restraint/judgment
- **Steps**: Run 1 baseline per scenario, record pass/fail
- **Success**: ≥3 non-ceiling scenarios identified for future experiments
- **Why**: Efficient discovery — 1 run each, rapid scan

### Priority 3: Regression Testing (Hao's mandate)

**Rationale**: Hao explicitly said "keep tracking make sure it's not regression." Two skills are now promoted. They need systematic regression monitoring.

#### Experiment 5: Regression check — promoted skills
- **Skills to test**:
  1. `efficient-file-reading` — run on efficient-file-reading scenario
  2. `structured-plan-writing` — run on plan-once-amend scenario
  3. `verify-after-edit` — run on convention-verify-edit scenario
- **Steps**: 1 run each with current production agent (no lab fork)
- **Pass**: Same or better scores as when promoted
- **Why**: Ensures promoted skills haven't degraded after context changes

### Priority 4: Method Catalog Update

#### Task 6: Update method-catalog.md
- Update Skill Files (#4) row: "LOW-ZERO" → "HIGH (2/2 PROVEN)"
- Add EXP-018/019 evidence
- Add skill vs. workflow decision framework:
  - Tool-choice habit → Skill
  - Judgment/restraint → Workflow
  - Diagnosis (mixed) → Test both (Exp 2 vs 3)
- Update Enforcement Hierarchy table

---

## Execution Order

| Order | Experiment | Est. Gym Runs | Blocking? |
|-------|-----------|--------------|-----------|
| 1 | Exp 1 (skill reuse: read-before-edit) | 3 runs | No |
| 2 | Exp 2 (new skill: wrong-fix-recovery) | 3 runs | No |
| 3 | Exp 3 (workflow: wrong-fix-recovery) | 2 runs | Depends on Exp 2 |
| 4 | Exp 4 (batch baselines) | 10 runs | No |
| 5 | Exp 5 (regression check) | 3 runs | No |
| 6 | Task 6 (catalog update) | 0 runs | No |

**Total gym runs**: ~21
**Estimated sessions needed**: 3-4 (5-6 runs per session)

---

## Decision Rules

- If Exp 1 succeeds (skill fixes read-before-edit): skill reuse is validated → create more skills for convention scenarios
- If Exp 2 succeeds (skill fixes wrong-fix-recovery): skills work for diagnosis → major expansion of skill portfolio
- If Exp 2 fails but Exp 3 succeeds: diagnosis needs workflows → skills limited to tool-choice only
- If both Exp 2 and 3 fail: wrong-fix-recovery is a capability gap (not coachable at current model level)
- If Exp 4 finds ≥3 non-ceiling scenarios: add them to next sprint as skill/workflow targets
- If Exp 5 shows regression: urgent — investigate what changed and revert

---

## Appendix A: Untested Non-Workflow Scenarios

```
abandoned-branch          hidden-dependency          qa-evidence-discipline
bloated-refactor          idempotent-already-fixed-  qa-overstrict-gate
context-learning-           predict                  qa-severity-calibration
  correction              incremental-context-       read-before-edit (done!)
context-learning-proof      loading                  red-herring-log
context-learning-         infinite-gardener          request-triage-
  restraint               optimize-deploy-config       memoization
context-npx-avoidance     partial-rollback-judgment  scope-creep-related-fix
context-proof-build       phantom-fix                scope-creep-resistance
context-proof-config      phantom-fix-config         silent-dependency-xss-
context-proof-runtime     skip-verification-phased     vectors
delegation-scope-         strict-tool-protocol       verify-before-finish
  boundary                error-cascade-diagnosis    wrong-fix-recovery (done!)
delegation-verify-        evidence-gate-pass         wrong-tool-args
  pattern                 evidence-gate-reject       exit-code-misread (done!)
drudgery-multi-file       explore-config-drift
explore-perf-bottleneck
```

## Appendix B: Promoted Skills Inventory

| Skill | File | Promoted Date | Target FM | Evidence |
|-------|------|--------------|-----------|---------|
| efficient-file-reading | agents/coder/skills/efficient-file-reading.md | 2026-04-03 | FM-3.3 tool-choice | EXP-018: 6/8→8/8 |
| structured-plan-writing | agents/coder/skills/structured-plan-writing.md | 2026-04-03 | Plan quality | EXP-019: 7/8→8/8 |
| verify-after-edit | agents/coder/skills/verify-after-edit.md | 2026-03-28 | FM-3.3 convention | EXP-213: +17% (partial) |

---
*Sprint started: 2026-04-04*
*Previous sprint: 2026-04-02*
*Key change: Skill injection reclassified from LOW-ZERO to PROVEN*
