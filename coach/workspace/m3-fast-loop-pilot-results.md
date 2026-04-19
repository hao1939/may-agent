# M3: Fast Loop Pilot — mock-leak-trap Diagnosis

## Error Pattern
- **FM code**: FM-3.3 (Verification Failure) / Recognition bottleneck
- **Description**: Agent fixes `validateEmail` bug in source but never reads the test file carefully enough to notice a monkey-patched mock (`jest.mock` or manual override) that replaces `validateEmail` with a stub. Tests pass (because mock returns success), agent declares done. The real fix is never actually tested.
- **Pass rate**: 13% (5/38 runs)
- **Root cause**: Recognition failure — agent doesn't investigate test infrastructure before fixing code.

## Target Agent
- **coder** (the scenario uses `agent_type: coder`)

## Selected Method
- **#15 Workflow Enforcement** (from method-catalog.md)

## Why This Method
1. **Evidence**: Workflow enforcement is 94%+ effective across 12 scenarios (49/52), including `misleading-test-fix` which is the closest analog — both require "investigate before acting" to avoid being misled by test infrastructure.
2. **Recognition bottleneck**: The catalog's decision guide says diagnosis/recognition tasks are workflow territory. This is textbook recognition — the agent needs to READ and NOTICE the mock before fixing.
3. **Skill files won't work**: The intervention idea describes a "process skill" (read tests first, check for mocks). But the catalog shows skills only work for tool-choice/procedural habits (Method #4: 2/2 proven). This is a judgment/investigation task — the agent needs to be FORCED into a multi-phase workflow, not just reminded.
4. **Existing workflow scenario**: `mock-leak-trap-workflow` already exists with a 2-phase task (Phase 1: investigate + write ANALYSIS.md, Phase 2: fix). This follows KE-182 hard gate design rules.
5. **Key concern**: The workflow uses ANALYSIS.md as a gate artifact, which KE-180 warns against ("completion illusion"). However, the workflow's Phase 2 explicitly requires fixing BOTH source AND test issues, and the success criteria likely check for mock removal. The 2-phase structure with session boundary mitigates the illusion risk.

## Gym Scenarios to Test
1. **Baseline**: `mock-leak-trap` (existing 38 runs at 13%, run 5 more for fresh confirmation)
2. **Treatment**: `mock-leak-trap-workflow` (run 10 trials)

## What Specifically to Change
**Nothing to create** — the workflow scenario already exists (`agents/gym/scenarios/mock-leak-trap-workflow/`). It implements:
- Phase 1: Read source + test, trace call path, identify mocks, write ANALYSIS.md (no code edits)
- Phase 2: Fix source bug AND test infrastructure issues, verify fix works
- 6-minute timeout (2x baseline) to accommodate the investigation phase

### Execution Plan
```bash
# Fresh baseline (5 runs)
scripts/gym-batch.sh --scenarios mock-leak-trap --trials 5 --agent coder

# Treatment (10 runs)  
scripts/gym-batch.sh --scenarios mock-leak-trap-workflow --trials 10 --agent coder
```

### Success Criteria
- Treatment pass rate > 30% (more than double the 13% baseline)
- Expected: ~80-90% based on analogous `misleading-test-fix` results (5/8 → 11/11 with workflow)

### Risk: KE-180 Completion Illusion
The ANALYSIS.md gate is a report, not a solution artifact. Per KE-180, this risks agents writing analysis then feeling done. Mitigation: the 2-phase workflow structure forces Phase 2 execution. If results disappoint, redesign the gate to produce a FIXED_TESTS.md with corrected test code (solution artifact per KE-182).

---

## Trial Results (EXP-171)

### Setup Note
The `mock-leak-trap-workflow` scenario was missing its `environment/` directory (symlink to base scenario). Fixed by adding symlink. This is why earlier batch runs showed 0/10 — they errored before the agent could run.

### Baseline: mock-leak-trap
| Metric | Value |
|--------|-------|
| Total runs (all-time) | 48 |
| Passes | 5 |
| **Pass rate** | **10.4%** |
| Fresh batch (today, 5 runs) | 0/5 (0%) |

### Treatment: mock-leak-trap-workflow (2-phase investigate→fix)
| Trial | Passed | Duration |
|-------|--------|----------|
| 1 | ✅ | 258s |
| 2 | ✅ | 93s |
| 3 | ❌ | 47s |
| 4 | ❌ | 130s |
| 5 | ✅ | 66s |
| 6 | ❌ | 39s |
| 7 | ✅ | 135s |
| 8 | ❌ | 183s |
| 9 | ✅ | 202s |
| 10 | ✅ | 110s |

| Metric | Value |
|--------|-------|
| Passes | 6 |
| Fails | 4 |
| **Pass rate** | **60%** |

### Comparison
| Arm | Pass Rate | N | Delta |
|-----|-----------|---|-------|
| Baseline | 10.4% | 48 | — |
| Workflow | **60%** | 10 | **+50pp** |

### Statistical Significance
- Fisher's exact test (baseline 5/48 vs treatment 6/10): p ≈ 0.002
- The effect is highly significant — the workflow intervention produces a ~6x improvement.

### Conclusion
**The 2-phase workflow enforcement is highly effective.** Pass rate jumped from 10% → 60%, far exceeding the 30% success threshold.

The ANALYSIS.md gate (despite KE-180 concerns about completion illusion) works here because Phase 2 explicitly forces implementation. The 4 failures may still be addressable with a solution-artifact gate (FIXED_TESTS.md) per KE-182, but 60% is already a strong result.

### Key Finding
- **KE-180 risk was partially mitigated**: The 2-phase structure prevented full completion illusion, but 40% still failed — some agents may have written shallow analysis and then failed to properly fix the mock in Phase 2.
- **Workflow enforcement confirms KE-007**: This is now the 6th scenario where workflow enforcement produces dramatic improvement on recognition-bottleneck tasks.
