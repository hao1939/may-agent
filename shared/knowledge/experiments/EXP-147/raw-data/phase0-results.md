# EXP-147 Track B — Phase 0 Results

**Date**: 2026-04-12
**Executor**: bob
**Status**: Phase 0 COMPLETE — mechanism validated, ready for Phase 1

---

## 1. Context Snapshots Created

| File | Size (bytes) | Token est. (~4c/tok) |
|------|-------------|---------------------|
| `context-full.md` | 3,574 | ~893 |
| `context-scoped.md` | 475 | ~119 |

**Reduction**: 87% fewer tokens in treatment condition (893 → 119).

## 2. Scenario Selection

All 8 candidate scenarios from the design verified to exist:

| # | Scenario | Category | Tags |
|---|----------|----------|------|
| 1 | `read-before-edit` | convention-compliance | behavior, edit-discipline |
| 2 | `convention-verify-edit` | convention-compliance | convention, c2.3 |
| 3 | `plan-once-amend` | efficiency | planning, amend |
| 4 | `hidden-dependency` | root-cause-analysis | debugging, dependency |
| 5 | `cascading-fix-trap-v2` | debugging | debugging, cascading-failure |
| 6 | `stale-approach-fixation` | judgment | behavior, pivoting |
| 7 | `misleading-stacktrace` | error-recovery | debugging, misdirection |
| 8 | `contradictory-requirements` | judgment | behavior, contradiction |

**Category coverage**: 6 unique categories (convention-compliance, efficiency, root-cause-analysis, debugging, error-recovery, judgment) — exceeds the ≥3 requirement.

**Baseline note**: gym_runs DB was empty (0 records), so no historical baselines available. This means we cannot compare to historical pass rates, but the A/B design (control vs treatment within-experiment) does not require them — each scenario serves as its own baseline.

## 3. Assignment Table

Generated using `SHA256(scenario + run_number + "EXP147B") mod 2`:

| Scenario | Control (full) | Treatment (scoped) | Total |
|----------|---------------|-------------------|-------|
| read-before-edit | 10 | 10 | 20 |
| convention-verify-edit | 12 | 8 | 20 |
| plan-once-amend | 10 | 10 | 20 |
| hidden-dependency | 10 | 10 | 20 |
| cascading-fix-trap-v2 | 10 | 10 | 20 |
| stale-approach-fixation | 10 | 10 | 20 |
| misleading-stacktrace | 12 | 8 | 20 |
| contradictory-requirements | 10 | 10 | 20 |
| **Total** | **84** | **76** | **160** |

Split: 52.5% control / 47.5% treatment (within acceptable range for SHA256 quasi-randomization).

## 4. Pilot Runs

### 4.1 Results

| Pilot | Scenario | Condition | Run# | Passed | Duration | DB Run ID | Key Failure |
|-------|----------|-----------|------|--------|----------|-----------|-------------|
| 1 | read-before-edit | scoped | 1 | ❌ | ~50s | 401 | C2.3 verify-after-edit |
| 2 | read-before-edit | full | 3 | ❌ | ~50s | 402 | C2.3 verify-after-edit |
| 3 | contradictory-requirements | full | 1 | ❌ | ~105s | 407 | analysis-exists, contradiction-identified, alternatives-proposed |
| 4 | contradictory-requirements | scoped | 3 | ❌ | ~105s | 409 | analysis-exists, contradiction-identified, alternatives-proposed |

### 4.2 Mechanism Validation

**Context swap works**: ✅
- Pilot script backs up `agents/bob/context.md`, copies condition-specific file, runs gym, restores original
- Verified file sizes during swap: scoped=475 bytes, full=3574 bytes
- After each run, context.md is restored to original (3574 bytes confirmed)

**Prompt hash caveat**: ⚠️
- `assembleEffectivePrompt()` in gym-runner.ts does NOT include `context.md` — only SOUL.md, common-sense.md, skills, env, tools
- Therefore `prompt_hash` is identical for both conditions (`65c63c77d8b8`)
- This is a **recording gap**, not a treatment failure
- The actual runtime prompt (built by `manager.ts:resolveSystemPrompt()`) DOES include `context.md` via the "What You Know (persistent context)" section
- The gym runner sets `AGENTS_ROOT` to the sandbox dir, and `context.md` is copied into the sandbox before the run starts

**Active recall**: ⚠️ Not controlled
- The design mentioned controlling active_recall as a covariate
- The pilot did not disable active_recall (no `DISABLE_ACTIVE_RECALL` env var exists)
- This is a confound — both conditions may receive active_recall injections from may.db
- **Mitigation**: Document as limitation. Active_recall content should be similar for both conditions since it's based on scenario/agent, not context.md content.

### 4.3 Pilot Assessment

All 4 pilots ran successfully without crashes, context corruption, or sandbox issues. The context-swap mechanism is reliable. No scenario substitutions needed.

**Pass rate in pilots**: 0/4 (both conditions failed on both scenarios). This is expected for a small sample and doesn't predict the main experiment outcome, especially since:
- `read-before-edit` failed on verify-after-edit (a specific sub-check), not the main task
- `contradictory-requirements` failed on externalization checks — a known hard scenario

## 5. Recommendations for Phase 1

1. **Proceed with all 8 scenarios** — all verified functional
2. **Batch size**: ~40-50 runs per session (2h budget ÷ ~2min/run = ~60 max, but budget some slack)
3. **Interleave conditions**: Process assignment table in scenario order, which naturally interleaves due to SHA256 randomization
4. **Track active_recall**: As noted, this is uncontrolled. Consider logging active_recall token count if feasible, but don't block on it.
5. **prompt_hash**: Cannot be used to verify treatment fidelity. Instead, verify by checking context.md file size during swap (as the pilot script already does).

## 6. Files Created

- `context-full.md` — frozen snapshot of agents/bob/context.md (3574 bytes)
- `context-scoped.md` — minimal context for treatment condition (475 bytes)
- `pilot-run.sh` — context-swap pilot runner script
- `phase0-results.md` — this file
