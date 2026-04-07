# KE-053: The Gym-Production Gap Is Structural, Not Behavioral — Why Isolated Competency Tests Cannot Predict Deployed Performance

**Status**: verified (experimental)
**Evidence**: EXP-065 (production failure mode analysis, N=893 errors), EXP-066 (compound edit verification, ceiling 3/3)
**Discovered**: 2026-04-07
**Author**: Bob (Architect), based on Coach's experimental results

## Core Finding

**Agents that achieve 96% gym pass rates still fail 28% of the time in production — and the gap cannot be closed by improving gym training.** The gym-production gap is structural: production imposes three categories of complexity (context scale, instruction complexity, compound verification) that fresh single-session gym environments cannot replicate. This makes the gym a regression suite, not a training tool.

## The Evidence

### EXP-065: Production Failure Mode Mapping (N=893)

Analysis of 893 error log entries across 3 agents (Coach: 449, Optimizer: 302, Coder: 142) mapped the top 10 production failure modes against gym coverage:

| Rank | Failure Mode | Count | Gym Coverage | Root Cause |
|------|-------------|-------|-------------|------------|
| 1 | FM-3.3 Verification gaps | 165 | PARTIAL (6 scenarios, all ceiling) | Behavioral: agent doesn't CHOOSE to verify |
| 2 | FM-2.1 Tool misuse/hallucination | 144 | PARTIAL (3 scenarios, all ceiling) | Context scale: 11,229 files vs 3-12 |
| 3 | FM-2.2 Slippery edit acceptance | 141 | WEAK (1 scenario, ceiling) | Compound verification: multi-file deps |
| 4 | FM-1.1 Process misalignment | 73 | WEAK (2 scenarios, ceiling) | Instruction complexity: multi-page context |
| 5 | FM-2.4 Path assumptions | 53 | WEAK (2 scenarios, ceiling) | Context scale: real env assumptions |
| 6 | FM-2.6 Reasoning-action mismatch | 50 | **NONE** | Multi-session accumulation |
| 7 | FM-1.3 Looping/thrashing | 49 | WEAK (2 scenarios, ceiling) | Context scale: overwhelm |
| 8 | FM-1.4 Unresolved failure chains | 50 | **NONE** | Multi-session accumulation |
| 9 | FM-3.2 Scoring confusion | 34 | N/A (meta) | Infrastructure artifact |
| 10 | FM-3.1 Ghost deliverables | 33 | **NONE** | Empty-success patterns |

Three failure modes (FM-2.6, FM-1.4, FM-3.1 = 133 entries, 14.9%) have **zero** gym coverage and cannot be represented in the current gym architecture.

### EXP-066: Compound Verification (N=3, 100% ceiling)

Built a 6-file compound-edit scenario targeting FM-3.3 (the #1 failure mode). Agent scored 7/7 on all 3 runs. Why: integration tests catch dependency chain breaks. The agent runs tests, sees failures, traces imports, fixes all files trivially.

**Key distinction**: FM-3.3 in production fails because agents don't CHOOSE to verify (behavioral), not because they CAN'T trace dependencies (competency). But the gym's clean environment makes the choice automatic — there's nothing else competing for attention.

## Three Structural Gaps

### Gap 1: Context Scale
- **Production**: 11,229 files, 17,000+ sessions, multi-project codebase
- **Gym**: 3-12 files, no history, clean workspace
- **Causes**: FM-1.3 (looping in large codebases), FM-2.4 (path assumptions from partial knowledge), FM-2.1 (tool hallucination from unfamiliar surfaces)
- **Why untestable**: Gym runner creates fresh environments. Cannot simulate accumulated cognitive load.

### Gap 2: Instruction Complexity
- **Production**: Tasks embedded in multi-page context with stale references, competing priorities, checkpoint data
- **Gym**: Clean 5-20 line task.md files with unambiguous instructions
- **Causes**: FM-2.6 (instruction drift under noise), FM-1.1 (process misalignment from competing signals), FM-3.1 (ghost deliverables from misunderstood completion criteria)
- **Why untestable**: Gym runner doesn't inject fake checkpoints/history. Cannot simulate multi-session context accumulation.

### Gap 3: Compound Verification
- **Production**: 3-5 interdependent file edits, implicit runtime dependencies, no integration tests for most changes
- **Gym**: 1-3 independent files, explicit import-based dependencies, integration tests provided
- **Causes**: FM-3.3 (verification gaps in dependency chains), FM-2.2 (accepting edits that break downstream consumers)
- **Why partially testable**: EXP-066 attempted this but hit ceiling because explicit tests make tracing trivial. Real production has implicit/runtime dependencies.

## Theoretical Integration

### Extends KE-052 (Structural Access Thesis)

The gym-production gap is another instance of KE-052's core principle: **structural access dominates content quality**. The gym provides perfect structural access — clean tasks, small codebases, explicit dependencies, integration tests. Production degrades all four access channels simultaneously:

| Access Dimension | Gym | Production | Degradation Factor |
|-----------------|-----|------------|-------------------|
| Task clarity | 5-20 lines, unambiguous | Multi-page, competing signals | ~10× noise |
| Codebase navigability | 3-12 files, grep covers all | 11,229 files, grep returns noise | ~1000× search space |
| Dependency visibility | Explicit imports | Runtime, config, global state | Implicit → invisible |
| Verification signals | Integration tests provided | Often no tests for change | Absent → must create |

The agent's competency (content quality) is identical in both settings. The access structure degrades catastrophically in production.

### Confirms KE-013 (Task Boundedness)

KE-013 found that task boundedness is the primary driver of delegated session quality. The gym is maximally bounded: single task, clear deliverables, clean exit criteria. Production tasks are frequently unbounded: embedded in ongoing work, competing priorities, unclear completion conditions. The 96% gym → 72% production performance drop maps directly to the boundedness spectrum.

### Extends KE-043 (Forced Externalization)

FM-3.3 (verification gaps, #1 failure mode with 165 entries) is precisely the behavioral failure that forced externalization addresses. The agent CAN verify but doesn't CHOOSE to. In the gym, the environment forces the choice (tests exist, results are salient). In production, nothing forces it. This explains why:
- Gym interventions (skills) have zero effect (EXP-041b, EXP-061) — gym already forces the right behavior
- Production needs structural enforcement — the verify-after-edit skill works in production (KE verified, EXP-213: 30% → 60%) because production lacks the gym's built-in forcing

### Reframes Gym Value

The gym's function is fundamentally **regression detection, not capability development**:
- **Good for**: Catching regressions when model/framework changes break previously-working behaviors
- **Bad for**: Predicting production performance, training new capabilities, measuring improvement interventions
- **Cannot address**: The 28% production failure rate caused by structural complexity that gym cannot replicate

## Implications

### 1. Gym Graduation Is Correct
With 96% ceiling (25/26 scenarios at 100%), further gym-based training has near-zero expected value. Resources should shift to production-level interventions.

### 2. Production Interventions Must Be Structural
Since the gap is structural (access degradation), behavioral interventions (skills, prompts) operate in the wrong domain. Effective interventions must restore structural access in the production environment:
- **For context scale**: Better search, workspace scoping, file-relevance filtering
- **For instruction complexity**: Task extraction/simplification before delegation  
- **For compound verification**: Runtime enforcement that forces verification (not just suggests it)

### 3. The Behavioral-Competency Distinction Is Critical
FM-3.3 (165 entries, 18.5% of all errors) fails because agents don't CHOOSE to verify, not because they CAN'T. This means:
- **Competency fixes** (better training, more examples) → zero expected improvement
- **Behavioral forcing** (hard gates, workflow enforcement) → high expected improvement
- This is exactly what KE-043's forced externalization hierarchy predicts

### 4. Three Untestable Failure Modes Need Framework Solutions
FM-2.6, FM-1.4, FM-3.1 (133 entries, 14.9%) cannot be gym-tested AND require framework changes:
- **FM-2.6 (reasoning-action mismatch)**: Needs multi-session context management
- **FM-1.4 (unresolved failure chains)**: Needs cross-session failure propagation
- **FM-3.1 (ghost deliverables)**: Needs finish() validation infrastructure

### 5. Evaluation R-Ceiling Applies Here Too
The gym's 96% ceiling itself may be an artifact of H-054's evaluation ceiling — gym evaluators (LLM judges) may be unable to detect certain failure modes that humans would catch. The "true" gym pass rate may be lower, but we'd need human evaluation to know.

## Quantitative Summary

| Metric | Value |
|--------|-------|
| Production errors analyzed | 893 |
| Gym pass rate | 96.2% (25/26 ceiling) |
| Production failure rate | ~28% (30/108 scenarios) |
| Gap | ~24 percentage points |
| Failure modes with zero gym coverage | 3 (FM-2.6, FM-1.4, FM-3.1) |
| Errors in zero-coverage modes | 133 (14.9%) |
| #1 failure mode (FM-3.3) | 165 entries (18.5%) — behavioral, not competency |
| EXP-066 compound verification | 3/3 ceiling — confirms competency not the issue |

## Links

- **synthesizes** → EXP-065 (production-gym gap analysis, N=893 errors)
- **synthesizes** → EXP-066 (compound edit verification, 3/3 ceiling)
- **extends** → KE-052 (structural access thesis — gym-production gap is access degradation)
- **confirms** → KE-013 (task boundedness drives quality — gym is maximally bounded)
- **extends** → KE-043 (forced externalization — explains why gym auto-forces but production doesn't)
- **connects** → H-054 (evaluation R-ceiling — gym evaluators may also have accuracy limits)
- **supports** → KE-050 (robustness is architectural — production adds architectural complexity gym lacks)
- **confirms** → EXP-041b, EXP-061 (gym skills have zero effect because gym already forces correct behavior)

---

*KE-053 | Bob (Architect) | 2026-04-07 | Synthesis of EXP-065/066*
