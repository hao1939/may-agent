# EXP-124 Results v2: Structural Intervention for FM-1.3 (Post-Runner-Fix)

**Status**: CONCLUDED — No Treatment Effect Detected  
**Date**: 2026-04-10  
**Experimenter**: Coach  
**Runner fix**: deepSnapshotDir + modified syncNewFilesFromRoot (syncs modified files, not just new files)

## Context

The original EXP-124 results were **inconclusive** because of a critical gym runner bug: the agent writes output files to PROJECT_ROOT (not workDir), and `syncNewFilesFromRoot` only synced NEW files — not files modified in directories that already existed. This caused ~67-75% false negatives (synthesis.md existed but wasn't copied to workDir for scoring).

The bug was fixed by adding `deepSnapshotDir()` to capture file mtimes before the agent runs, then comparing after to detect modified files. First post-fix trial scored 4/8 (vs 0/8 pre-fix).

This v2 re-runs the full experiment with the fixed runner.

---

## Trial Results

### Baseline (knowledge-base-navigation, N=6)

| Trial | Product | Convention | Agent Status | Duration | Passed |
|-------|---------|------------|--------------|----------|--------|
| B1    | 5/5     | 3/5        | completed    | 239.8s   | ✅     |
| B2    | 5/5     | 3/5        | completed    | 124.9s   | ✅     |
| B3    | 5/5     | 3/5        | completed    | 89.7s    | ✅     |
| B4    | 5/5     | 3/5        | completed    | 152.8s   | ✅     |
| B5    | 5/5     | 3/5        | completed    | 147.2s   | ✅     |
| B6    | 0/5     | 3/5        | error        | 300.2s   | ❌     |

**Baseline pass rate: 5/6 (83%)**  
**Baseline product (when completing): 5/5 (100%)**  
**Baseline mean duration: 175.8s (excluding B6 error: 150.9s)**

### Treatment (knowledge-base-navigation-discovery, N=6)

| Trial | Product | Convention | Agent Status | Duration | Passed |
|-------|---------|------------|--------------|----------|--------|
| T1    | 5/5     | 3/5        | completed    | 108.8s   | ✅     |
| T2    | 5/5     | 3/5        | completed    | 109.5s   | ✅     |
| T3    | 5/5     | 3/5        | completed    | 112.4s   | ✅     |
| T4    | 5/5     | 3/5        | completed    | 128.1s   | ✅     |
| T5    | 2/5     | 3/5        | completed    | 174.7s   | ❌     |
| T6    | 5/5     | 3/5        | completed    | 127.6s   | ✅     |

**Treatment pass rate: 5/6 (83%)**  
**Treatment product (when completing): 4.5/5 avg (5/5 in 5 trials, 2/5 in T5)**  
**Treatment mean duration: 126.9s (excluding T5: 117.3s)**

---

## Comparison

| Metric | Baseline | Treatment | Δ | p-value |
|--------|----------|-----------|---|---------|
| Overall pass rate | 5/6 (83%) | 5/6 (83%) | 0pp | 1.0 (Fisher exact) |
| Product score (avg) | 4.17/5 | 4.50/5 | +0.33 | NS |
| Convention score (all) | 3/5 | 3/5 | 0 | — |
| Completion rate | 5/6 (83%) | 6/6 (100%) | +17pp | NS |
| Mean duration (completed) | 150.9s | 126.9s | -24s (16% faster) | — |
| Agent error rate | 1/6 (17%) | 0/6 (0%) | -17pp | NS |

### Statistical Significance
Fisher exact test for pass rates: p = 1.0 (no significant difference).  
With N=6 per group, we have very low power to detect effects smaller than ~50pp.

---

## Key Findings

### 1. No Treatment Effect on Pass Rate
Both conditions achieve identical 83% (5/6) pass rates. The discovery intervention does not measurably improve outcomes on this scenario.

### 2. Baseline Is Now Very Strong (83% vs Pre-Fix 0%)
The pre-fix baseline was 0% (0/6 in v1, 0/3 in EXP-095). With the runner fix, baseline is 83%. **The dominant "failure" in v1 was the gym runner not capturing output files, not the agent failing.** Bob was actually succeeding most of the time — we just couldn't see it.

### 3. Convention Scores Are Still Uninformative
All 12 trials get exactly 3/5 convention because the transcript capture still only records a 1-line JSON summary (no tool call details). Convention checks that depend on transcript content (`nav-uses-ls-or-find-first`, `nav-finds-index-early`) always fail. The three checks that pass (`tool-calls-under-25`, `targeted-file-reads`, `no-path-guessing-errors`) pass vacuously because they detect 0 tool calls / 0 reads / 0 errors.

### 4. Treatment May Be Slightly Faster
Treatment completed trials average 117.3s vs baseline 150.9s (22% faster), but with high variance and small N, this is not statistically significant. If real, it could reflect the discovery instructions providing useful structure.

### 5. T5 Failure: Incomplete Content (Not Missing File)
T5 produced a synthesis.md but it was incomplete:
- Missing specific hypothesis IDs (RH-044, RH-048)
- FM-1.3 info had definition but lacked triggers and interventions
- Missing RKE-007 reference
This is a content quality failure, not a navigation failure.

### 6. B6 Failure: Agent Error (Timeout)
B6 had `agent_status: "error"` after 300.2s (the timeout). No synthesis.md was produced. This represents a genuine agent failure unrelated to path navigation.

---

## Comparison With Pre-Fix Results (v1)

| Metric | v1 Baseline | v2 Baseline | v1 Treatment | v2 Treatment |
|--------|-------------|-------------|--------------|--------------|
| Pass rate | 2/6 (33%) | 5/6 (83%) | 2/8 (25%) | 5/6 (83%) |
| Product (avg) | 1.67/5 | 4.17/5 | 1.00/5 | 4.50/5 |
| Convention | 3/5 (all) | 3/5 (all) | 3/5 (all) | 3/5 (all) |

The runner fix dramatically improved BOTH conditions equally, confirming the v1 results were dominated by the file-sync bug, not by any treatment effect.

---

## Implications

### For EXP-124 Hypothesis
**H-primary (discovery pre-phase reduces FM-1.3 by ≥50%): REJECTED**  
The baseline already achieves 83% — there's no room for a 50pp improvement. The scenario may be too easy for the current agent, or the discovery instructions are not needed for this task.

**H-secondary (no regression in task completion): SUPPORTED**  
Treatment shows no regression — identical pass rate, slightly better product scores, slightly faster completion.

**H-tertiary (path-guessing categories most reduced): UNTESTABLE**  
Transcript capture doesn't record tool calls, so we can't measure path-guessing errors per trial.

### For the Gym Runner
1. **File sync fix works**: 0%→83% improvement confirms the deepSnapshotDir fix is effective.
2. **Transcript capture still broken**: Only records 1-line JSON summary, no tool calls. Convention checks that depend on transcript content are useless. This needs a separate fix.
3. **Need a harder scenario**: 83% baseline means this scenario has ceiling effects. To test FM-1.3 interventions, need a scenario where baseline path-guessing actually causes failures.

### For FM-1.3 Research
The original EXP-124 premise was that Bob "fails most of the time" on this task due to path-guessing. With the runner fix, we see Bob actually succeeds 83% of the time. This means either:
- The scenario doesn't actually trigger FM-1.3 strongly enough
- Bob's existing `knowledge-base-navigation.md` skill IS working (contrary to the hypothesis)
- The single-phase design (no workflow) means the agent has enough tool budget to self-correct

**Next steps for FM-1.3 research**: Design a harder scenario with deeper nesting, more ambiguous paths, and stricter tool-call budgets that would actually cause path-guessing failures. Then re-test the discovery intervention.

---

## Remaining Issues

1. **Transcript capture**: Needs separate investigation (may require changes to how may-agent-bin outputs session data)
2. **Convention scoring is meaningless**: All 12 trials get exactly 3/5 because 2 checks always fail (no transcript data) and 3 always pass (0 < threshold). This provides zero discriminating information.
3. **Need harder scenario**: Current scenario has a ceiling effect at ~83% baseline.
