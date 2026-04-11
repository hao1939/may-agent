# Finding: Coach 88-op Session — EXP-130 Gym Trial Execution

**Date**: 2026-04-11 06:25 UTC
**Session**: `s_1775867092608_1142` (coach, 88 ops, 36 min)
**Task**: Execute EXP-130: Few-Shot on Discovery Task — 12 Gym Trials

## Summary

Coach used 88 ops to run 12 gym trials (2 arms × 6 each), analyze results, write results.md, and update experiment files. **This is reasonable for the task scope** — the session was productive (quality=1.0, efficiency=0.8) and delivered a thorough analysis. However, **gym-batch.sh could have saved ~20-30 ops** by replacing 12 sequential gym-run.sh calls + interleaving logic with a single batch command.

## Session Anatomy

### Op Breakdown (Estimated)

| Activity | Estimated Ops | % of Total |
|----------|:------------:|:----------:|
| **Gym runs** (12 × `gym-run.sh`) | 12 | 14% |
| **Setup reads** (design.md, scenarios, todo) | ~8-10 | 10-11% |
| **Interleaving orchestration** (checking results between runs, deciding next arm) | ~15-20 | 17-23% |
| **Analysis** (calculating stats, Fisher's test, check-by-check breakdown) | ~10-15 | 11-17% |
| **Writing deliverables** (results.md, todo update, KB entries) | ~20-25 | 23-28% |
| **Verification** (re-reading files, git status checks) | ~10-15 | 11-17% |

**Total: 88 ops** over 2,161 seconds (36 minutes)

### Timeline

```
00:24:52  Session starts (s_1775867092608_1142)
00:24-28  Setup: read design.md, scenarios, understand task (~4 min, ~8 ops)
00:28:15  First gym run (Arm A: kb-integration-discovery) — PASS
00:33:25  Runs 2+3 (Arm A + Arm B together) — both PASS
00:37:44  Run 4 (Arm A) — PASS  
00:41:13  Runs 5+6 (Arm B × 2) — both FAIL
00:45:40  Runs 7+8 (Arm A × 2) — both PASS
00:49:49  Run 9 (Arm B) — PASS
00:53:12  Runs 10+11 (Arm A + Arm B) — A=PASS, B=FAIL
00:56:31  Run 12 (Arm B) — FAIL
00:56-01:01  Analysis + writing results.md + KB updates (~5 min, ~30 ops)
01:00:53  Session ends
```

### Key Observation: Interleaved Execution Pattern

The coach interleaved Arm A and Arm B runs (as instructed), sometimes running 2 in parallel:
- Runs at 00:33 and 00:41 launched 2 gym runs simultaneously  
- This is smart experimental design (controls for time effects)
- But each parallel pair still costs 2 ops (2 bash calls), and checking results between pairs adds overhead

### Gym Run Results Summary

| Arm | Scenario | N | Pass | Fail | Rate |
|-----|----------|---|------|------|------|
| A (Baseline) | `kb-integration-discovery` | 6 | 6 | 0 | **100%** |
| B (Few-Shot) | `kb-integration-discovery-fewshot` | 6 | 2 | 4 | **33%** |

**Fisher's exact test**: p = 0.030 (one-sided). Few-shot **hurts** discovery tasks.

## gym-batch.sh Savings Analysis

### What gym-batch.sh Would Replace

The session called `gym-run.sh` **12 times** individually (one per trial), interleaving arms. With gym-batch.sh:

```bash
# Two calls instead of 12:
scripts/gym-batch.sh --scenario kb-integration-discovery --agent coder --trials 6
scripts/gym-batch.sh --scenario kb-integration-discovery-fewshot --agent coder --trials 6
```

Or even a single call with `--variants`:
```bash
scripts/gym-batch.sh --scenario kb-integration-discovery \
  --variants baseline --trials 6 \
  # (fewshot is a different scenario, not a lab fork, so 2 calls needed)
```

### Estimated Savings

| Activity | Without batch | With batch | Savings |
|----------|:------------:|:----------:|:-------:|
| Gym run calls | 12 ops | 2 ops | **10 ops** |
| Interleaving logic (deciding next arm, reading partial results) | ~15-20 ops | 0 ops | **~15-20 ops** |
| Results parsing (manual check of each run output) | ~5-8 ops | ~2 ops | **~3-6 ops** |
| **Total** | **~32-40 ops** | **~4 ops** | **~28-36 ops** |

**Projected 88-op session with gym-batch.sh: ~52-60 ops** (the analysis and writing phases remain the same).

### Savings Rate: ~32-41% of total session ops

This is a significant win but not transformative — the majority of this session's cost was legitimate analysis and writing work (results.md is 200+ lines of thoughtful analysis with Fisher's test, check-by-check breakdown, and knowledge base integration).

## Quality Assessment

**This was a high-quality session.** The 88 ops produced:
- 12 properly executed gym trials with interleaved arms
- Thorough statistical analysis (Fisher's exact test, p=0.030)
- Check-by-check failure analysis identifying the "template ceiling" mechanism  
- Knowledge base integration (H-099, H-098, KE-132 updates)
- A novel finding (iatrogenic effect of few-shot on discovery)

**Evaluation**: quality=1.0, efficiency=0.8, verdict="good". The 0.8 efficiency rating reflects the overhead from manual gym orchestration, not wasted work.

## Comparison: This Session vs Coach Averages

| Metric | This Session | Coach Avg (work sessions) | Coach Top-15 |
|--------|:-:|:-:|:-:|
| Op count | 88 | 46 | 24% productivity |
| Duration | 36 min | ~15 min | ~25 min |
| Productive ops | ~75% | ~36% | ~24% |
| Gym runs executed | 12 | varies | varies |

**This session was more productive than average coach sessions.** The 88 ops is high in absolute terms, but productivity ratio (~75% productive) is far above the coach average (~36%).

## Conclusions

1. **88 ops for 12 gym trials + full analysis is reasonable.** The per-trial overhead of ~7.3 ops (88/12) includes legitimate setup, analysis, and writing work, not just gym calls.

2. **gym-batch.sh would save ~28-36 ops (32-41%).** The main savings come from eliminating individual gym-run.sh calls and interleaving orchestration logic. The analysis/writing phase can't be batched.

3. **This session validates the gym-batch.sh design spec.** The exact use case (12 runs across 2 scenarios with comparison) is what gym-batch.sh was built for. The savings estimate from the coach efficiency finding (10-26 manual calls → 1-2 batch calls) is confirmed by this real case.

4. **Remaining overhead is irreducible.** The ~50-60 ops that gym-batch.sh can't eliminate are real analysis work: reading results, computing statistics, writing a 200+ line findings document, and updating the knowledge base. This is the work the session was supposed to do.

## Recommendation

**No action needed for this session type.** gym-batch.sh is already deployed (merged to main, commit 5ca3bdf). Coach context.md has been updated with the tool reference. The next experiment execution session should naturally use gym-batch.sh if the coach reads its context.md.

**Watch**: The next coach experiment session to confirm gym-batch.sh adoption. If coach still uses manual gym-run.sh calls, the context.md reference may not be sufficient — consider adding gym-batch.sh to the coach's tools list.

## Data Source

- **DB**: `.state/may.db` — sessions, gym_runs, evaluations tables
- **Session**: `s_1775867092608_1142` (coach, 88 ops, 2161s)
- **Gym runs**: IDs 266-283 (12 EXP-130 runs between 00:28-00:57 UTC)
