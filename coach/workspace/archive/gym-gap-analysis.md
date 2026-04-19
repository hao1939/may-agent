# Gym Scenario Coverage vs FM Taxonomy — Gap Analysis

**Author**: Coach  
**Date**: 2026-03-25  
**Request**: req:750b8b63 (from Bob)  
**Data source**: 87 scenarios in `agents/gym/scenarios/`, FM codes from `agents/*/ERROR_LOG.jsonl`

---

## Method

1. Enumerated all 18 FM codes observed in production error logs (FM-1.1 through FM-5.3).
2. For each scenario, checked explicit `targets` field in `scenario.json` and inferred FM coverage from scenario name, tags, and task description.
3. Classified coverage as: **Explicit** (has FM code in targets), **Implicit** (scenario tests the behavior but doesn't tag it), or **None**.

---

## FM Code Coverage Matrix

### FM-1.x — Efficiency / Goal Management

| FM Code | Description (inferred) | Explicit Scenarios | Implicit Scenarios | Coverage |
|---------|----------------------|-------------------|-------------------|----------|
| **FM-1.1** | Goal Drift / Wasted Search | 0 | `stale-approach-fixation`, `behavior-resource-convergence`, `search-strategy-escalation` | ⚠️ Implicit only |
| **FM-1.2** | Minor Waste / Tool Output Misinterpretation | `conflicting-evidence`, `red-herring-investigation` | `efficient-file-reading`, `incremental-context-loading` | ✅ 2 explicit + 2 implicit |
| **FM-1.3** | Error Recovery Gaps / Looping / Obstacle Pivot Failure | 0 | `error-recovery-broken-config`, `convention-retry-pivot`, `tool-confusion-recovery`, `cascading-error` | ⚠️ Implicit only |
| **FM-1.4** | Dead End No Pivot / Ghost Deliverables / Evidence Handling | 0 | `error-cascade-diagnosis`, `abandoned-branch` | 🔴 Weak — only implicit, low count |

### FM-2.x — Instruction Compliance / Tool Discipline

| FM Code | Description (inferred) | Explicit Scenarios | Implicit Scenarios | Coverage |
|---------|----------------------|-------------------|-------------------|----------|
| **FM-2.1** | Tool Misuse / Hallucination / Path Guessing / Over-strict Gate | `qa-overstrict-gate`, `optimize-deploy-config` | `wrong-tool-args`, `strict-tool-protocol`, `hasty-fix`, `exit-code-misread`, `qa-severity-calibration` | ✅ 2 explicit + 5 implicit |
| **FM-2.2** | Instruction Noncompliance / Scope Drift / Scope Creep | `conflicting-evidence-workflow`, `exit-code-misread`, `red-herring-investigation` | `scope-creep-resistance`, `scope-creep-trap`, `spec-adherence-multi-step`, `judgment-ambiguous-spec`, `sycophants-dilemma` | ✅ 3 explicit + 5 implicit |
| **FM-2.3** | Unverified Claim / Spec Literalism | 0 | `qa-severity-calibration` (description mentions FM-2.3 SPEC_LITERALISM), `verify-checksum-trap` | ⚠️ Implicit only, thin |
| **FM-2.4** | Context Misread / Exit Code Semantics | `conflicting-evidence`, `conflicting-evidence-workflow`, `exit-code-misread` | `misleading-stacktrace`, `red-herring-log` | ✅ 3 explicit + 2 implicit |
| **FM-2.5** | (Unknown — rare in logs) | 0 | 0 | 🔴 **No coverage** |
| **FM-2.6** | Integrity / Destructive Action | 0 | `judgment-destructive-trap`, `shutdown-threat`, `judgment-security-legit` | ⚠️ Implicit only |

### FM-3.x — Verification / Process Compliance

| FM Code | Description (inferred) | Explicit Scenarios | Implicit Scenarios | Coverage |
|---------|----------------------|-------------------|-------------------|----------|
| **FM-3.1** | Tool Schema Error / Unrecovered Tool Error | 0 | `wrong-tool-args`, `strict-tool-protocol`, `tool-confusion-recovery` | ⚠️ Implicit only |
| **FM-3.2** | Path Assumption / Misinterpreted Verification | 0 | `wrong-directory`, `phantom-fix`, `phantom-fix-config` | ⚠️ Implicit only |
| **FM-3.3** | Verification Gap / Finish Gate Failure / Process Noncompliance | `regression-from-fix`, `optimize-deploy-config` | `skip-verification`, `skip-verification-open`, `skip-verification-phased`, `convention-verify-edit`, `convention-verify-multi-edit`, `investigate-fix-pattern` | ✅ 2 explicit + 6 implicit |
| **FM-3.4** | (Unknown — rare in logs) | 0 | 0 | 🔴 **No coverage** |

### FM-4.x — Delegation / Coordination

| FM Code | Description (inferred) | Explicit Scenarios | Implicit Scenarios | Coverage |
|---------|----------------------|-------------------|-------------------|----------|
| **FM-4.1** | Delegation Failure | 0 | `delegation-scope-boundary`, `delegation-verify-pattern` | ⚠️ Implicit only, 2 scenarios |
| **FM-4.2** | (Unknown — rare) | 0 | 0 | 🔴 **No coverage** |

### FM-5.x — Meta / System-Level

| FM Code | Description (inferred) | Explicit Scenarios | Implicit Scenarios | Coverage |
|---------|----------------------|-------------------|-------------------|----------|
| **FM-5.2** | (Unknown — rare) | 0 | 0 | 🔴 **No coverage** |
| **FM-5.3** | (Unknown — rare) | 0 | 0 | 🔴 **No coverage** |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total FM codes in taxonomy | 18 |
| FM codes with ≥1 explicit scenario | **6** (FM-1.2, FM-2.1, FM-2.2, FM-2.4, FM-3.3, FM-2.1) |
| FM codes with only implicit coverage | **7** (FM-1.1, FM-1.3, FM-2.3, FM-2.6, FM-3.1, FM-3.2, FM-4.1) |
| FM codes with **zero** coverage | **5** (FM-2.5, FM-3.4, FM-4.2, FM-5.2, FM-5.3) |
| Scenarios with explicit FM targets | **10** (out of 87) — only **11.5%** |

---

## Top Coverage Gaps (Prioritized by Production Error Frequency)

### 🔴 Priority 1 — High-frequency FM codes with no explicit scenarios

1. **FM-1.1 (Goal Drift / Wasted Search)** — appears frequently in coder + coach error logs. Only implicit coverage via `stale-approach-fixation`. **Need:** dedicated scenario where agent must recognize a dead-end search and pivot strategy within N tool calls.

2. **FM-1.3 (Error Recovery / Looping)** — coach and coder both show this pattern. **Need:** scenario that presents a tool error mid-task and checks the agent pivots rather than retrying the same failing command.

3. **FM-1.4 (Dead End No Pivot)** — coach shows this pattern repeatedly. **Need:** scenario where the primary path is blocked (ENOENT, permission denied) and agent must discover an alternative path.

4. **FM-3.1 (Tool Schema Error)** — coach shows this pattern. **Need:** scenario that tempts agents to use wrong tool parameters and checks they recover.

5. **FM-3.2 (Misinterpreted Verification)** — coach shows this. **Need:** scenario where `diff` or `grep` exit code 1 must be correctly interpreted as "differences found" or "no match" rather than "command failed."

### ⚠️ Priority 2 — Moderate-frequency, implicit only

6. **FM-2.3 (Unverified Claim / Spec Literalism)** — only 1 implicit scenario. **Need:** scenario where agent must distinguish spec-letter from spec-intent.

7. **FM-2.6 (Integrity)** — 3 implicit scenarios exist but none explicitly tag FM-2.6. **Need:** at minimum, add explicit `targets` to existing scenarios.

8. **FM-4.1 (Delegation)** — 2 implicit scenarios. **Need:** scenario where agent must decide whether to delegate vs do inline, with clear cost tradeoffs.

### ❓ Priority 3 — Unknown/rare FM codes with zero coverage

9. **FM-2.5, FM-3.4, FM-4.2, FM-5.2, FM-5.3** — These appear in error logs but I don't have clear definitions. **Action needed:** define what these codes mean, then assess whether scenarios exist or are needed.

---

## Recommendations

### Quick wins (low effort, high value)
1. **Add `targets` fields to existing scenarios** — ~70 scenarios lack explicit FM targets. Adding them improves discoverability and enables automated gap detection. Estimated: 30 min of batch editing.
2. **Tag existing integrity scenarios** with FM-2.6 (`judgment-destructive-trap`, `shutdown-threat`, `judgment-security-legit`).
3. **Tag existing error-recovery scenarios** with FM-1.3 (`error-recovery-broken-config`, `convention-retry-pivot`, `tool-confusion-recovery`).

### New scenario development needed
4. **FM-1.1 scenario**: "Search Strategy Failure" — agent given a task where naive grep returns 500+ results, must pivot to targeted search. (Note: `search-strategy-escalation` exists but needs explicit FM-1.1 targeting.)
5. **FM-1.4 scenario**: "Blocked Primary Path" — target file doesn't exist at expected location, agent must `ls`/`find` to locate it.
6. **FM-3.1 scenario**: "Tool Parameter Trap" — task description subtly suggests wrong tool args, checks agent validates schema.
7. **FM-3.2 scenario**: "Exit Code Semantics" — `diff` returns exit 1 (differences found), agent must not treat as failure. (Note: `exit-code-misread` is close but tagged FM-2.2/2.4, not FM-3.2.)

### Structural improvements
8. **Formalize FM taxonomy** — Create `agents/shared/knowledge/fm-taxonomy.md` with definitions for all 18 FM codes. Currently, FM code meanings are scattered and some (FM-2.5, FM-3.4, FM-4.2, FM-5.x) are undefined.
9. **Auto-gap-detection script** — Build a script that reads all `scenario.json` targets and compares against the FM taxonomy to surface coverage gaps automatically.

---

## Scenario-to-FM Quick Reference (Explicit Only)

| Scenario | FM Targets |
|----------|-----------|
| conflicting-evidence | FM-1.2, FM-2.4 |
| conflicting-evidence-workflow | FM-2.2, FM-2.4 |
| exit-code-misread | FM-2.2, FM-2.4 |
| optimize-deploy-config | FM-2.1, FM-3.3 |
| qa-overstrict-gate | FM-2.1 |
| qa-overstrict-gate-workflow | FM-2.1 |
| red-herring-investigation | FM-1.2, FM-2.2 |
| regression-from-fix | FM-3.3 |
| regression-from-fix-workflow | FM-3.3 |
