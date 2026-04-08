# EXP-093: Few-Shot Skill Conversion Sprint 3 — Verify-After-Edit Discipline

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: H-091 (P(H)=0.99) — matched few-shot examples improve process discipline skills
**Prior results**: EXP-090 (Sprint 1: judgment skills, 0%→100%), EXP-091 (Sprint 2: process discipline, 0%→100%)

## Motivation

Sprint 1 (EXP-090) and Sprint 2 (EXP-091) demonstrated that domain-matched few-shot worked examples produce dramatic improvements (0%→100%) for both judgment skills and process discipline skills. The conversion plan identifies **read-before-edit (#3)** and **verify-before-finish (#4)** as the next targets.

However, analysis reveals a critical constraint:
- **read-before-edit scenario**: 91% baseline (10/11 checks pass). The failing check is C2.3 (verify-after-edit), not C1.1 (read-before-edit). C1.1 is at ceiling.
- **verify-before-finish scenario**: 100% baseline (7/7). Absolute ceiling.

Both target scenarios are at or near ceiling, making improvement measurement impossible. But the underlying **verify-after-edit behavior** (C2.3) is the system's #1 process discipline gap:
- **convention-verify-edit**: 0% scenario pass rate (n=3) despite 80% product correctness
- **C1.3 system-wide**: 71% despite verify-after-edit skill deployed to ALL 8 agents
- **Read-before-edit C2.3**: The single failing check in the 10/11 baseline

This experiment pivots to target the **actual behavioral gap** (verify-after-edit) rather than the already-solved behaviors (read-before-edit C1.1, verify-before-finish). This is a more rigorous test of H-091 because verify-after-edit has proven resistant to text-rule intervention (skill deployed system-wide, still only 71%).

## Design

### ARM 1: convention-verify-edit (Primary Target)

**Scenario**: Agent edits `config.json` (set timeout=5000, retries=3). File has trailing comma trap. Scored on product (correct JSON, correct values, fields preserved) AND behavioral conventions (C2.3: verify after edit, C3: explicit validation).

**Why this scenario**: 0% baseline scenario pass rate despite 80% product correctness. The agent CAN do the task but doesn't follow verify-after-edit convention. This is the purest test of whether few-shot changes behavioral discipline.

| Condition | Scenario Variant | N | Description |
|-----------|-----------------|---|-------------|
| Control | convention-verify-edit | 5 | Base scenario, no few-shot |
| Treatment | convention-verify-edit-fewshot | 5 | Few-shot injected context showing read→edit→verify→validate pattern |

**Primary metric**: Scenario pass rate (all checks pass)
**Secondary metrics**: C2.3 pass rate, C3 pass rate, product pass rate (should remain ≥80%)

### ARM 2: read-before-edit (Secondary Target)

**Scenario**: Agent fixes 3 bugs across 3 files (validator.js, formatter.js, parser.js). Task description quotes slightly wrong whitespace/line numbers to trap agents that don't read first. Scored on product (all 3 bugs fixed, content preserved) AND conventions (C1: read-before-edit per file, C2.3: verify-after-edit ≥2/3 files).

**Why this scenario**: 91% baseline (10/11). The single failing check is C2.3 (verify-after-edit). The few-shot should push C2.3 to pass, achieving 100%.

| Condition | Scenario Variant | N | Description |
|-----------|-----------------|---|-------------|
| Control | read-before-edit | 3 | Base scenario, no few-shot |
| Treatment | read-before-edit-fewshot | 3 | Few-shot injected context showing read→edit→verify pattern |

**Primary metric**: C2.3 pass rate (verify-after-edit)
**Secondary metric**: Scenario pass rate (predict: 91%→100%)

### Total Runs: 16

| Arm | Control | Treatment | Total |
|-----|---------|-----------|-------|
| ARM 1 (convention-verify-edit) | 5 | 5 | 10 |
| ARM 2 (read-before-edit) | 3 | 3 | 6 |
| **Grand Total** | **8** | **8** | **16** |

## Few-Shot Design

### ARM 1 Few-Shot: `convention-verify-edit-fewshot/injected_context.md`

Shows a worked example of an engineer editing a JSON config file with a deliberate verify-after-edit pattern:
1. **Read the file first** — see the actual content (including any formatting issues)
2. **Edit with exact text** — use what was read, not what was described
3. **Read back after edit** — verify the edit landed correctly
4. **Validate structurally** — run `node -e "JSON.parse(...)"` to confirm valid JSON
5. **Confirm values** — check specific fields have correct values

The example should involve a DIFFERENT config file (not config.json with timeout/retries) to avoid giving away the answer. Use something like `settings.yaml` → `settings.json` migration or `package.json` version bump with validation.

### ARM 2 Few-Shot: `read-before-edit-fewshot/injected_context.md`

Shows a worked example of an engineer fixing multiple bugs across files with the full read→edit→verify cycle:
1. **Read each file before editing** — find exact text to match
2. **Edit with precision** — use copied text from read output
3. **Read back each file after editing** — confirm fix applied correctly
4. **Run any available tests** — if test files exist, run them

The example should involve DIFFERENT files/bugs but the same pattern of multi-file editing with per-file verification.

## Success Criteria

### ARM 1 (convention-verify-edit)

| Metric | Control (predicted) | Treatment (predicted) | Required Δ |
|--------|--------------------|-----------------------|------------|
| Scenario pass rate | 0% (from EXP-025) | ≥60% | ≥+60pp |
| C2.3 pass rate | 0% | ≥80% | ≥+60pp |
| C3 validation pass | 0% | ≥60% | ≥+40pp |
| Product pass rate | ≥80% | ≥80% | No regression |

### ARM 2 (read-before-edit)

| Metric | Control (predicted) | Treatment (predicted) | Required Δ |
|--------|--------------------|-----------------------|------------|
| C2.3 pass rate | ~33% (1/3) | ≥67% (2/3) | ≥+33pp |
| Scenario pass rate | ~91% | 100% | ≥+9pp |
| C1.1 pass rate | ≥90% | ≥90% | No regression |

### Overall H-091 Update

- If ARM 1 treatment ≥60% AND ARM 2 C2.3 improves: **Strong support** — P(H)→0.995
- If ARM 1 treatment ≥40% AND ARM 2 unchanged: **Moderate support** — P(H) stays 0.99
- If ARM 1 treatment <20%: **Potential boundary found** — verify-after-edit may require workflow enforcement, not just few-shot (update KE-059 taxonomy)

## Scenario Creation Required

Two new scenario variants must be created:

### 1. `convention-verify-edit-fewshot`

```
agents/gym/scenarios/convention-verify-edit-fewshot/
├── environment/          # Copy from convention-verify-edit
│   └── config.json       # Same buggy config with trailing comma
├── injected_context.md   # NEW: Few-shot worked example
├── package.json          # Copy
├── scenario.json         # Modified: add fewshot tag, injected_context reference
├── success_criteria.js   # Copy from convention-verify-edit (same scoring)
└── task.md               # Same task, prepended with injected_context reference
```

### 2. `read-before-edit-fewshot`

```
agents/gym/scenarios/read-before-edit-fewshot/
├── environment/          # Copy from read-before-edit
│   └── src/              # Same 3 buggy files
├── injected_context.md   # NEW: Few-shot worked example
├── package.json          # Copy
├── scenario.json         # Modified: add fewshot tag
├── success_criteria.js   # Copy from read-before-edit (same scoring)
└── task.md               # Same task, prepended with injected_context reference
```

## Execution Plan

1. **Create scenario variants** — copy base scenarios, add `injected_context.md` files
2. **Run ARM 1 Control** — 5× convention-verify-edit (collect fresh baselines)
3. **Run ARM 1 Treatment** — 5× convention-verify-edit-fewshot
4. **Run ARM 2 Control** — 3× read-before-edit (fresh baselines)
5. **Run ARM 2 Treatment** — 3× read-before-edit-fewshot
6. **Score all runs** — extract per-check pass/fail from each session
7. **Analyze** — compute pass rates, effect sizes, significance

## Risk Factors

1. **Convention-verify-edit may have improved since EXP-025**: If baseline is no longer 0%, the effect will appear smaller. Mitigated by running fresh N=5 control.
2. **Read-before-edit C2.3 is a single binary check**: With N=3, we can't get fine-grained measurement. Accept coarser signal.
3. **Scoring reliability**: Convention-verify-edit's C2.3 check relies on transcript parsing. Must ensure the gym runner produces proper transcripts.
4. **The 80% product baseline for convention-verify-edit** might have changed — running fresh controls addresses this.

## Connection to Sprint Plan

| Sprint | Skills | Status | Effect |
|--------|--------|--------|--------|
| Sprint 1 (EXP-090) | know-when-blocked, evidence-over-narrative | ✅ COMPLETE | Both 0%→100% |
| Sprint 2 (EXP-091) | investigate-and-fix (reproduce-first) | ✅ COMPLETE | 0%→100% |
| **Sprint 3 (EXP-093)** | **verify-after-edit (via read-before-edit + convention-verify-edit)** | **DESIGNED** | **Predicted: 0%→60%+** |
| Sprint 4 (future) | Remaining skills from conversion plan | PLANNED | — |

## Key Difference from Sprints 1-2

Previous sprints targeted skills with 0% baseline where the agent made the **wrong judgment call**. Sprint 3 targets a skill where the agent makes the right product decision but **skips a behavioral step**. This is fundamentally different:
- Sprints 1-2: "Agent doesn't know WHAT to do" → few-shot teaches the decision
- Sprint 3: "Agent knows what to do but doesn't bother to VERIFY" → few-shot teaches the discipline habit

If few-shot works here, it extends H-091 from judgment gaps to **discipline gaps** — a much broader domain. If it fails, we've found the boundary: few-shot works for judgment but not for behavioral habits (which need workflow enforcement).
