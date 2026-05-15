# Finding: Coach 133-op EXP-154 Design Session Deep-Dive

**Session**: `s_1776117159825_421`  
**Task**: Design EXP-154: Process Skill Effectiveness on Medium-Baseline Scenarios  
**Op Count**: 149 tool calls (DB recorded 133, likely due to compaction boundary)  
**Duration**: 53 minutes  
**Status**: interrupted (aborted mid-Phase 4)  
**Date**: 2026-04-13  

## Executive Summary

This session consumed 149 ops (3.6× median of 41) to design and partially execute an experiment. The bloat is driven by **two full-pivot scenario restarts** (the first scenario was broken, the second had ceiling effects) and **deep bash discovery spirals**. ~55% of ops were avoidable waste. The session represents the "experiment design" failure mode: when the pre-conditions for an experiment are unstable, iterative discovery dominates productive work.

## Op Breakdown by Phase

| Phase | Ops | Description | Bash% | Productive Writes |
|-------|-----|-------------|-------|-------------------|
| **P1: Scenario Selection & Skill Design** (ops 1-46) | 46 | Query baselines, browse scenarios, read existing skills, design skill, write design doc | 83% | 7 (design.md, skill files) |
| **P2: First Scenario Attempt** (ops 47-75) | 29 | Run treatment on read-before-edit, discover scenario is broken (no bugs in env files!), fix scenario, re-run → now ceiling | 86% | 3 (env file fixes) |
| **P3: Pivot to New Scenario** (ops 76-107) | 32 | Search for new medium-baseline scenarios, analyze conflicting-evidence (now ceiling too), explore 4+ alternatives, settle on exp144-hidden-dep-decoupled, design new skill | 84% | 3 (new skill, context.md) |
| **P4: Second Treatment Run & Debugging** (ops 108-149) | 42 | Fight gym-batch.sh CLI, run 5 treatment trials, debug transcript format, try to understand why 9/10 fail | 90% | 3 (skill refinements) |

**Total**: 149 ops → 16 productive writes (11%), 128 bash (86%), 3 reads (2%), 2 checkpoints (1%)

## Waste Classification

### Category 1: Broken Scenario Discovery (29 ops — 19%)
- Ops 47-75: The `read-before-edit` scenario's environment files had **no bugs** — the scenario was structurally broken. Coach didn't discover this until after running 5 treatment trials and investigating the pass pattern.
- **Root cause**: No pre-validation that scenario environments contain the expected bugs.
- **Fix**: Scenario health-check script that validates environment files against success criteria before running trials.

### Category 2: Scenario Shopping Spiral (32 ops — 21%)
- Ops 76-107: After the first scenario failed, coach burned 32 ops browsing 6+ alternatives (conflicting-evidence, contradictory-requirements-combined, kb-discovery variants, wrong-fix-recovery, exp144-hidden-dep-decoupled).
- Each candidate required: query gym_runs DB → read scenario.json → read success_criteria.js → read task.md → query failure patterns.
- **Root cause**: No centralized "scenario health dashboard" showing current baselines, last-run dates, and known issues.
- **Fix**: A pre-computed scenario catalog (updated by gym-batch runs) showing: scenario name, baseline%, last tested, # runs, known issues. Coach could pick in 1 op instead of 32.

### Category 3: Tool CLI Discovery (8 ops — 5%)
- Ops 108-112: Coach tried 4 different `gym-batch.sh` invocations before finding the right syntax (`--variants` not `--lab`).
- **Root cause**: CLI arg names aren't memorable; `--help` output not consulted first.
- **Marginal**: Only 5% of ops, but recurring across sessions.

### Category 4: Transcript Parsing Struggle (10 ops — 7%)
- Ops 119-128: Five consecutive attempts to parse gym run transcripts using different approaches (python3, bun, various JSON strategies). All failed or produced incomplete results.
- **Root cause**: Transcript format isn't documented; agent discovers it ad-hoc each time.
- **Fix**: `scripts/gym-transcript-summary.sh <run-dir>` that outputs a tool-call summary.

### Category 5: Bash Streaks (Structural)
- Longest bash streaks: **33, 26, 25, 22, 10, 5, 3, 3**
- The 33-streak (ops 47-80) spans the entire broken-scenario-discovery and start of pivot.
- The 26-streak (ops 80-106) is the scenario shopping.
- Coach's bash:write ratio is 8:1 — vastly above the healthy 3:1 target.

## Waste Summary

| Category | Ops | % of Total | Avoidable? |
|----------|-----|------------|------------|
| Broken scenario discovery | 29 | 19% | Yes — scenario health check |
| Scenario shopping spiral | 32 | 21% | Mostly — scenario catalog |
| Tool CLI discovery | 8 | 5% | Partially — better --help |
| Transcript parsing | 10 | 7% | Yes — transcript summary tool |
| **Total waste** | **~79** | **53%** | |
| **Productive work** | **~70** | **47%** | |

## Comparison to Similar Sessions

| Metric | EXP-154 | Coach EXP median | Coach EXP mean |
|--------|---------|------------------|----------------|
| Op count | 149 | 41 | 48 |
| Multiple over median | 3.6× | 1× | 1.2× |
| Status | interrupted | varies | varies |
| First write position | op 34 | — | — |
| Bash streak max | 33 | — | — |

Coach EXP sessions >100 ops (top 12 of 268):
- 252 ops: EXP-070 Phase 2 (scenario redesign + FM-1.3)
- 188 ops: EXP-117 (Bob FM-2.6 investigation)
- 184 ops: Resume training (multi-experiment)
- 166 ops: EXP-123 (FM-3.3 investigation)
- 146 ops: EXP-070 (sub-goal density)
- 145 ops: EXP-144 pilot (10-session pilot)
- 136 ops: EXP-124 (gym trials)
- **133 ops: EXP-154 (this session)**

**Pattern**: All 100+ op sessions involve gym execution + discovery loops. Pure design sessions (no gym runs) average 35-55 ops. The combinaton of "design + run + discover problem + redesign + re-run" reliably exceeds 100 ops.

## Key Technique Observations

### 1. No Deliverables Checklist
The session lacks a DELIVERABLES_CHECKLIST.md — this was implemented after the session's design. Would have helped scope-gate: once design.md was written (op 34), a checklist would have enforced "stop designing, start running" earlier.

### 2. Late First Write (op 34)
33 ops of pure bash discovery before the first write. The lean session heuristic says "write within 5." Coach could have written a skeleton design.md at op 5 and filled it in, rather than completing all research first.

### 3. Gym-Batch Available But Under-Used
`scripts/gym-batch.sh` was available and eventually used (ops 108, 112, 137), but coach also ran individual `gym-run.sh` calls and spent ops understanding batch syntax. A "standard experiment run" pattern could help: always use gym-batch.sh with consistent args.

### 4. Missing Scenario Pre-Validation
The entire 29-op Phase 2 waste could have been prevented by a 1-op check: "does the scenario environment actually contain bugs?" This is a systemic issue — other experiment sessions likely hit the same pattern.

## Recommendations

### High Impact (would have saved 40-60 ops)
1. **Scenario health catalog**: Pre-computed table of scenario → baseline%, last_tested, known_issues. Updated automatically after gym runs. Coach reads 1 file instead of querying 6+ scenarios individually.
2. **Scenario pre-validation script**: `scripts/scenario-validate.sh <name>` that checks: environment files have expected content, success criteria runs, task.md exists. Run before any gym trials.

### Medium Impact (would have saved 10-20 ops)
3. **Gym transcript summary tool**: `scripts/gym-transcript-summary.sh <run-dir>` — outputs tool call sequence and key decisions. Eliminates transcript parsing struggle.
4. **Experiment design template**: Skeleton design.md written at op 1-3, filled in during research. Forces early writing.

### Low Impact (would have saved 5-10 ops)
5. **gym-batch.sh cheat sheet**: Standard invocation patterns in coach's context injection. Eliminates CLI discovery.

## Conclusion

EXP-154's 133-149 ops reflects **experiment infrastructure fragility** more than coach inefficiency. The core problem: scenarios decay (baselines shift, environment files break) and there's no fast way to discover current scenario health. Coach's research skill is strong — the 46-op Phase 1 produced a good design with correct skill selection. But the execution infrastructure (broken scenario, CLI confusion, transcript opacity) imposed a ~80 op tax.

This session type (design + execute experiment) has inherent complexity of ~60-70 ops when everything goes right. The extra ~80 ops came from infrastructure surprises. The recommended scenario catalog and pre-validation tools would bring this class of session down to 50-70 ops consistently.
