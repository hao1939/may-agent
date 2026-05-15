# Finding: High-Op Session Archaeology — Bob 81-op & Coach 65-op

**Date**: 2026-04-13  
**Session IDs**: `s_1776093729020_253` (Bob 81 ops, 13 min), `s_1776090134316_230` (Coach 65 ops, 14 min)  
**Method**: DB query + output quality assessment  

---

## 1. Bob 81-op Session — EXP-152 Phase 2 Design

### What Happened

Bob was tasked with designing Phase 2 of EXP-152 (targeted fork-scenario pairing for guard removal experiments). The task included:
- Reading 5 context files (784 lines total: todo.md, design.md, phase1 analysis, KE-169, H-108)
- Analyzing Phase 1 confounds (SOUL.md, wrong skill removals, overlay bug)
- Designing new lab forks, scenarios, sample sizes, decision rules
- Creating validation + main experiment scripts

### Output Quality: **HIGH**

The session produced 3 files totaling **522 lines**:
- `phase2-design.md` (374 lines) — Comprehensive experiment design with 11.2 sections covering confound analysis, lab fork specs, scenario selection, power analysis, error recurrence methodology, and decision rules
- `phase2-validate.sh` (28 lines) — Validation trial script
- `phase2-main.sh` (120 lines) — Main experiment dispatch script

**Critical discovery**: Bob found and fixed a **cpSync overlay bug** in `gym-runner.ts` that invalidated ALL of Phase 1 (45 trials). The overlay was merging directories instead of replacing them, so skill removals never took effect. He also discovered context.md isn't in the gym prompt, collapsing 3 conditions to 2.

### Cost Assessment: **JUSTIFIED**

- **Read budget**: 784 lines of context reads = ~15-20 ops (5 reads + comprehension)
- **Investigation**: Bug discovery (cpSync + context.md), fork validation, prompt hash comparison = ~25-30 ops
- **Writing**: 522 lines of design + scripts = ~20-25 ops
- **Overhead**: Deliverables checklist, git, finish = ~10 ops

Total: ~70-85 ops expected for this scope. The 81 ops is proportional.

**Ops/line output**: 0.155 ops/line (81 ops → 522 lines). This is efficient by project standards — typical work sessions produce 0.3-0.5 ops/line.

### Why Expensive

1. **Legitimate complexity**: Phase 2 required understanding Phase 1's failures, designing controlled fixes, and validating the infrastructure worked. This isn't a straightforward write task.
2. **Heavy read requirement**: 784 lines of mandated reads before writing starts.
3. **Bug discovery mid-session**: Finding the cpSync overlay bug and context.md injection issue required investigation ops that were unforeseeable at dispatch time.
4. **Validation trials**: Running gym trials to verify forks worked added ops but was essential (the validation caught critical issues).

### Verdict: **Not wasteful. High-value session.**

This is a legitimate high-complexity research design task. The output quality justifies the cost. The 81 ops is actually lower than what Phase 1 analysis sessions cost (the Phase 1 continuation session `s_1776088386052_220` was only 13 ops, but earlier Phase 1 calibration sessions ran 30-80+ ops for less useful output).

---

## 2. Coach 65-op Session — EXP-084 Few-Shot Deployment

### What Happened

Coach was tasked with deploying EXP-084's finding (few-shot examples as strongest skill delivery method) into production. The task asked to:
- Pick a high-value skill for few-shot deployment
- Update production agent files with the few-shot example
- Document which skill, where deployed, how to measure adoption

### Output Quality: **MODERATE-HIGH**

The session produced 2 files:
- `requirements-conflict-analysis.md` (36 lines) — New coder skill with worked example
- `deployment-results.md` (82 lines) — Thorough analysis of why Channel 1 deployment failed

Total: **118 lines** output.

The deployment-results.md is actually the most valuable output — it clearly documents that Channel 1 (system prompt skill) produces 0% improvement vs 33% for Channel 3 (injected context), with a clean comparison table and theoretical explanation. This advances the Attention Channel Theory (H-098) understanding.

### Cost Assessment: **PARTIALLY JUSTIFIED**

- **Read budget**: EXP-084 results, design files, agent contexts = ~10-15 ops
- **Skill creation**: Writing the 36-line skill file = ~5 ops
- **Gym validation**: Running 3 trials (runs 775, 778, 780) and analyzing results = ~15-20 ops
- **Historical comparison**: Querying baselines, EXP-127 results = ~10-15 ops
- **Writing results**: 82-line analysis document = ~5-10 ops

Expected: ~45-65 ops. The 65 ops is at the upper end.

**Ops/line output**: 0.55 ops/line (65 ops → 118 lines). Less efficient than Bob's session but still within normal range.

### Why Expensive

1. **Gym run overhead**: Each gym run costs 2-4 ops in setup/execution/result-checking. 3 runs = ~9-12 ops.
2. **Exploration of deployment options**: Coach likely explored multiple deployment approaches before settling on Channel 1 (skill file). This is the "exploration" portion.
3. **Historical data mining**: Pulling EXP-127 comparisons and baseline data required multiple DB queries and file reads.
4. **Thorough write-up**: The 82-line deployment-results.md is quite detailed with tables and theoretical analysis.

### Verdict: **Borderline. Useful negative result, but deployment itself predictably failed.**

The deployment was foreseeable as ineffective — EXP-127 had already shown Channel 1 produces 0% improvement for judgment tasks (N=12). Coach re-proved this at N=3. The useful outcome is the consolidated deployment-results.md that clearly documents why, but this could have been written without running new gym trials (saving ~15-20 ops, bringing the session to ~45-50 ops).

**However**: The task explicitly asked to "deploy and measure" — so running trials was compliant with instructions. The waste is at the **dispatch level** (shouldn't have asked for Channel 1 deployment given EXP-127 evidence), not the execution level.

---

## 3. Systemic Pattern Analysis

### Pattern: Research/Design Tasks Are Legitimately Expensive

Bob's 81-op session is a **true positive** for high complexity. The pattern:
- Read 5+ context files → investigate infrastructure → discover bugs → design with statistical rigor → validate → write up

This is fundamentally different from bloated sessions caused by exploration spirals or restart accumulation. The 81 ops represent real work, not waste.

### Pattern: "Deploy and Validate" Tasks Double-Count Known Results

Coach's 65-op session partially re-proved what EXP-127 already showed. The pattern:
- EXP-084 proves X works (via Channel 3)
- Task says "deploy X" (implicitly via Channel 1)
- Coach deploys via Channel 1, runs validation, discovers it doesn't work
- 15-20 ops spent re-discovering a known result

**Fix**: Deploy tasks should include a "prior evidence check" step — before running new trials, check if the delivery channel has existing evidence. If EXP-127 already showed Channel 1 = 0% for this skill class, skip validation trials and document the known-result reference instead.

### Not a Systemic Issue

Neither session represents a fixable systemic anti-pattern:
- **Bob's session**: Legitimate complexity. No intervention needed.
- **Coach's session**: Dispatch-level issue (task should have specified Channel 2/3 or said "check if Channel 1 is viable first"). One-off, not structural.

---

## 4. Comparison to Known Anti-Patterns

| Anti-Pattern | Bob 81-op | Coach 65-op |
|---|---|---|
| Restart accumulation | ❌ Single context | ❌ Single context |
| Exploration spiral (>5 consecutive bash) | ❌ Not observed | ⚠️ Possible for historical data mining |
| Phase 1 read bloat (>40 ops in reading) | ⚠️ ~20 ops reads, but justified | ❌ |
| Parallel-research synthesis spike | ❌ | ❌ |
| Re-proving known results | ❌ | ✅ **Yes** — re-proved EXP-127 Channel 1 null |
| Tool misuse / repeated failures | ❌ | ❌ |

---

## 5. Recommendations

### No Fix Needed for Bob Pattern
Research design tasks that involve bug discovery, infrastructure validation, and statistical methodology ARE expensive. The 81 ops produced 522 lines of high-quality, consequential output (caught cpSync bug + context.md injection issue that invalidated 45 trials). Budget expectation for this task class: 60-90 ops.

### Minor Fix for Coach Pattern  
**Prior Evidence Gate**: When dispatching "deploy finding X" tasks, include existing evidence about the delivery channel. For EXP-084 deployment, the dispatch should have said: "Note: EXP-127 showed Channel 1 = 0% for judgment skills (N=12). Consider Channel 2/3 deployment, or if Channel 1 must be tested, limit validation to N=1."

**Estimated savings**: 15-20 ops per "deploy and validate" task where prior channel evidence exists. Low frequency (~1-2x/week), so total impact ~30-40 ops/week. **Not worth a structural fix** — just a dispatch awareness note.

### Observation to Log
Both evaluations show the heuristic eval bug: both rated Quality=1, Efficiency=0.8, "good" — identical despite very different session characteristics. The evaluation system provides zero quality granularity for work sessions (previously noted as a systemic issue).
