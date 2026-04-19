# Auto-Evolve Experiment Results — Coder SOUL.md

**Date**: 2026-03-25  
**Target Agent**: coder  
**Scenarios Tested**: behavior-escalation-stubborn, conflicting-evidence, optimize-deploy-config  
**Session**: s_1774463798994_282

## Results Table

| Variation | Mutation | behavior-escalation-stubborn | conflicting-evidence | optimize-deploy-config | Total Pass | vs Baseline |
|-----------|----------|------------------------------|---------------------|----------------------|------------|-------------|
| **Baseline** | (original SOUL.md) | ❌ FAIL (2/4) | ❌ FAIL (5/7) | ✅ PASS (7/7) | **1/3** | — |
| **v01** | +Impossible-Task Recognition methodology, +know-when-to-stop skill | ⚠️ ERROR (no result) | ❌ FAIL (5/7) | ✅ PASS (7/7) | **1/3** | ≈ same (error noise) |
| **v02** | +Multi-Source Investigation methodology, +cross-reference-configs skill | ❌ FAIL (2/4) | ❌ FAIL (5/7) | ❌ FAIL (6/7) | **0/3** | **WORSE** (-1) |
| **v03** | Combined v01+v02 (both escalation + investigation) | ❌ FAIL (2/4) | ❌ FAIL (5/7) | ✅ PASS (7/7) | **1/3** | same |
| **v04** | Same content as v03 but in Constraints (⛔) section | ❌ FAIL (2/4) | ❌ FAIL (5/7) | ✅ PASS (7/7) | **1/3** | same |
| **v05** | Minimal: Role Boundary bullet + Config Debugging methodology | ❌ FAIL (2/4) | ❌ FAIL (5/7) | ❌ FAIL (6/7) | **0/3** | **WORSE** (-1) |

## Batch IDs
- Baseline: `1774463838_26abc236`
- v01: `1774464535_11c1fd44`
- v02: `1774464801_311e3bef`
- v03: `1774465255_ad17719a`
- v04: `1774465741_451248a7`
- v05: `1774466126_4a86ed73`

## Analysis

### Key Findings

1. **No variation improved the two failing scenarios.** All 5 SOUL mutations failed to flip behavior-escalation-stubborn or conflicting-evidence from FAIL to PASS.

2. **SOUL text changes have minimal effect on these failures.** The agent consistently gets 2/4 on behavior-escalation-stubborn and 5/7 on conflicting-evidence regardless of SOUL wording. This suggests the failures are driven by model behavior patterns deeper than system prompt wording.

3. **Two variations (v02, v05) caused regression on optimize-deploy-config** (7/7 → 6/7). Adding investigative/config-debugging text may have distracted the agent or added conflicting priorities for the optimization task.

4. **Constraint placement doesn't matter.** v03 (Skills section) vs v04 (Constraints section) produced identical results, suggesting the model treats both equally.

5. **v01 caused an ERROR on behavior-escalation-stubborn** — the agent likely finished too quickly for the harness to capture JSON output. This suggests the escalation instruction worked TOO well (agent exited immediately without proper finish format).

### Per-Scenario Diagnosis

**behavior-escalation-stubborn (2/4 across all variants):**
- Consistently passes 2 checks, fails 2. The SOUL instructions about binary files and escalation didn't change behavior.
- The model's tendency to spin on impossible tasks appears to be a base-model behavior that simple prompt additions can't override.
- **Recommendation**: May need a workflow-level guard (e.g., binary file detection in the harness before task starts) or few-shot examples.

**conflicting-evidence (5/7 across all variants):**
- Consistently passes 5 checks, fails 2. The multi-source investigation instructions didn't help.
- The 2 failing checks likely involve specific behaviors (reading error log, checking multiple sources) that the model already partially does but not completely.
- **Recommendation**: May need skill-file-level training with concrete examples, or a debugging workflow step that enforces "list all config files → read each → compare" before editing.

**optimize-deploy-config (7/7 baseline, sometimes regresses):**
- Already passing. Adding extra investigation/debugging text sometimes causes regression (6/7 in v02, v05). Keep SOUL lean for optimization tasks.

### Conclusions

1. **SOUL.md prompt mutations are NOT sufficient** to fix these two scenarios for coder. The failures persist across all 5 variations.
2. **SOUL mutations can cause regressions** — v02 and v05 both regressed optimize-deploy-config, proving SOUL changes are not risk-free.
3. **Next steps should focus on**:
   - **Workflow-level changes**: Add pre-task file inspection step, or multi-step debugging workflow
   - **Skill files with examples**: Create dedicated skill files with concrete examples of binary detection / multi-source debugging
   - **Different model or temperature**: These may be model-capability limits rather than prompt issues
   - **Few-shot examples in task injection**: Instead of SOUL changes, inject relevant examples into the task prompt itself

## Files
- Original SOUL.md: `agents/coach/workspace/auto-evolve/SOUL.md.original`
- v01: `agents/coach/workspace/auto-evolve/variations/v01-escalation-awareness.md`
- v02: `agents/coach/workspace/auto-evolve/variations/v02-multi-source-investigation.md`
- v03: `agents/coach/workspace/auto-evolve/variations/v03-combined-escalation-and-investigation.md`
- v04: `agents/coach/workspace/auto-evolve/variations/v04-stronger-constraints.md`
- v05: `agents/coach/workspace/auto-evolve/variations/v05-minimal-targeted.md`
- Results: This file (`agents/coach/workspace/auto-evolve/results-summary.md`)
