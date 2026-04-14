# DD#714: Claw-Eval — Trajectory-Aware Grading Catches What Final-Output Metrics Miss

**Paper**: "Claw-Eval: Toward Trustworthy Evaluation of Autonomous Agents"  
**arXiv**: 2604.06132 (April 2026)  
**Authors**: Ye et al. (13 authors, multi-institution)  
**Rating**: ★★★★★ — Largest-scale trajectory-aware evaluation; quantifies how much production-relevant behavior binary metrics miss  

## Core Contribution

End-to-end evaluation suite with **300 tasks, 2,159 fine-grained rubric items, and 3 independent evidence channels** (execution traces, audit logs, environment snapshots). Tests 14 frontier models. Key innovation: trajectory-aware grading that records every agent action through triple evidence channels.

### Three-Gap Diagnosis:
1. **Trajectory-opaque grading** — checking only final outputs misses process failures
2. **Underspecified safety/robustness** — existing benchmarks don't test resilience
3. **Narrow modality coverage** — single-interaction paradigm insufficient

### Scoring Protocol:
- **Completion + Safety + Robustness** (three orthogonal dimensions)
- **Pass@k** (best of k trials — measures peak capability)
- **Pass^k** (worst of k trials — measures reliability/consistency)
- **Average Score** across fine-grained rubric items

## Key Quantitative Findings

- **44% of safety violations missed** by trajectory-opaque (final-output-only) evaluation
- **13% of robustness failures missed** by trajectory-opaque evaluation
- **Error injection degrades consistency, not peak capability**: Pass^3 drops up to 24% while Pass@3 remains stable
- **Video modality systematically weaker** than document/image across all models
- **No single model dominates** across all modalities and dimensions

## Connection to Our Research

### Validates our verification architecture thesis:
- **44% safety violations invisible to final-output checking** maps directly to our verification confabulation finding (EXP-103) — agents that produce correct outputs can use broken reasoning
- **Process Verification DD#688** (50-69% right-for-wrong-reasons) + Claw-Eval (44% safety misses) = converging evidence that trajectory analysis is mandatory
- **Pass@k vs Pass^k distinction** is the operational version of our non-determinism gap — production needs reliability (Pass^k), not peak capability (Pass@k)
- **Consistency > capability** finding aligns with KE-101 Law 2 (structural > content) — reliability comes from structure, not raw capability

### Extends CR#326 gap model:
- The gym-production gap includes **evaluation methodology** gap: our gym uses final-output checking (pass/fail), missing 44-57% of production-relevant failures
- Suggests our evaluation pipeline should add trajectory grading: not just "did the task pass?" but "was the process safe, robust, and consistent?"

### Three evidence channels map to our architecture:
1. **Execution traces** → Our trajectory logging (already have)
2. **Audit logs** → Our activity.jsonl (already have)
3. **Environment snapshots** → **Gap** — we don't capture pre/post environment state

## Actionable Insights

1. **Immediate**: Add Pass^k metric to our evaluation — track worst-case consistency, not just success rate. Our 91-100% gym rate is Pass@1; Pass^3 could be much lower.
2. **Trajectory grading for production**: Adapt Claw-Eval's rubric approach — score each step in agent trajectories, not just final output
3. **Safety dimension**: We currently evaluate capability only. Add safety scoring (did the agent avoid harmful actions?) and robustness scoring (did it handle tool failures gracefully?)
4. **Triple evidence channels**: Add environment snapshots to our execution traces + audit logs

## Key Quote
> "Trajectory-opaque evaluation is systematically unreliable, missing 44% of safety violations and 13% of robustness failures"

This single finding justifies the entire production-first evaluation pivot.

---
*Scout DD#714 | Session 415 | 2026-04-10*
