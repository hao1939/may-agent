# EXP-124 Results: Structural Intervention for FM-1.3

**Status**: CONCLUDED — Inconclusive
**Date**: 2026-04-10
**Experimenter**: Coach

## Summary

The experiment tested whether adding mandatory directory-discovery instructions to a knowledge-base navigation task reduces FM-1.3 (path guessing) behaviors. Results are **inconclusive** due to high noise from systemic gym runner issues.

## Trial Results

### Baseline (knowledge-base-navigation, N=6)

| Trial | Product | Convention | Agent Status | Passed |
|-------|---------|------------|--------------|--------|
| B1    | 5/5     | 3/5        | completed    | ✅     |
| B2    | 0/5     | 3/5        | completed    | ❌     |
| B3    | 0/5     | 3/5        | error        | ❌     |
| B4    | 0/5     | 3/5        | completed    | ❌     |
| B5    | 5/5     | 3/5        | completed    | ✅     |
| B6    | 0/5     | 3/5        | error        | ❌     |

**Pass rate**: 2/6 (33%)

### Treatment (knowledge-base-navigation-discovery, N=8)

| Trial | Product | Convention | Agent Status | Passed |
|-------|---------|------------|--------------|--------|
| T1    | 3/5     | 3/5        | completed    | ✅     |
| T2    | 0/5     | 3/5        | error        | ❌     |
| T3    | 0/5     | 3/5        | error        | ❌     |
| T4    | 0/5     | 3/5        | completed    | ❌     |
| T5    | 0/5     | 3/5        | completed    | ❌     |
| T7    | 0/5     | 3/5        | error        | ❌     |
| T8    | 5/5     | 3/5        | completed    | ✅     |
| T9    | 0/5     | 3/5        | completed    | ❌     |

**Pass rate**: 2/8 (25%)

## Key Findings

### 1. Results Are Inconclusive
- Baseline pass rate: 33% vs Treatment pass rate: 25%
- Difference is not statistically significant (Fisher exact p ≈ 1.0)
- The dominant failure mode is NOT path-guessing — it's the agent failing to produce output files at all

### 2. Systemic Gym Runner Issues (Blocking Signal)

Three issues prevent meaningful FM-1.3 measurement:

**A. File placement bug**: The agent sometimes writes output files to the scenario source directory (`/app/agents/gym/scenarios/.../environment/`) instead of the tmpDir. The `syncNewFilesFromRoot` function only checks PROJECT_ROOT top-level files, not recursively. This causes false negatives.

**B. Empty transcripts**: All transcripts contain only a 1-line JSON summary (e.g., `{"sessionId":"...","status":"success"}`). Zero tool calls are ever parsed. The JSONL session data is never appended, likely because `gymStateDir` gets cleaned up before or the session format doesn't contain tool-call-level data. Convention checks that look for tool calls always find 0.

**C. High base failure rate**: Both baseline and treatment fail ~67-75% of the time due to the agent simply not producing synthesis.md. This noise overwhelms any signal from the discovery intervention.

### 3. When Agent Succeeds, Quality Is High
In the trials where the agent DID produce output (checked via misplaced files in source dirs), the synthesis quality was excellent: complete nav-maps, accurate hypotheses summaries, FM-1.3 details, and cross-reference checks. This suggests the task content itself is well-constructed.

### 4. Convention Scores Are Meaningless
All trials (both conditions) get exactly 3/5 convention because:
- `nav-total-tool-calls-under-25` → always passes (0 < 25)
- `nav-targeted-file-reads` → always passes (0 ≤ 12)
- `nav-no-path-guessing-errors` → always passes (0 ≤ 1)
- `nav-uses-ls-or-find-first` → always fails (0 ls/find detected)
- `nav-finds-index-early` → always fails (no INDEX.md in transcript)

## Recommendations

### Before re-running EXP-124:
1. **Fix transcript capture**: The gym runner needs to capture actual tool calls from agent sessions, not just the 1-line summary JSON. Investigate why JSONL session data isn't being appended.
2. **Fix file placement**: `syncNewFilesFromRoot` should also check recursively for files written inside the project tree, or the agent binary should be truly sandboxed to the workDir.
3. **Increase reliability**: The ~33% base success rate makes experiments require very large N (>30 per arm) to detect effects. Root-cause the failures.

### Alternative approach:
Consider testing the FM-1.3 intervention via direct agent observation (single task sessions with transcript inspection) rather than the gym runner.

## Scenario Artifacts

- Treatment scenario: `agents/gym/scenarios/knowledge-base-navigation-discovery/`
  - `scenario.json` — workflow:false, single-phase
  - `task.md` — adds mandatory directory discovery step
  - `success_criteria.js` — inherited from baseline
  - `environment/` — copied from baseline
- Lab fork doc: `agents/.lab/bob-fm13-discovery/README.md`
