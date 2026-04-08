# KE-053: The Gym-Production Gap Is Structural, Not Behavioral — Why Isolated Competency Tests Cannot Predict Deployed Performance

**Status**: verified (experimental, strengthened by EXP-077)
**Evidence**: EXP-065 (production failure mode analysis, N=893 errors), EXP-066 (compound edit verification, ceiling 3/3), EXP-067 (injected_context, both scenarios ceiling 3/3), EXP-077 (fidelity ladder, 9 runs across 3 levels — cascading state identified as primary gap driver)
**Discovered**: 2026-04-07, updated 2026-04-08
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

### EXP-067: Injected Context (N=6, 100% ceiling both scenarios)

Built `injected_context` infrastructure to prepend fake session history (checkpoints, prior session summaries, unresolved items) into gym scenarios. Tested two production failure modes:

| Scenario | FM Target | Baseline (3 runs) | Verdict |
|----------|-----------|-------------------|---------|
| stale-context-drift | FM-2.6 | 3/3 (100%) | CEILING |
| ghost-deliverable-detection | FM-3.1 | 3/3 (100%) | CEILING |

**Why ceiling**: Clean tasks + working test suites give agents enough signal to overcome misleading context. Stale-context-drift: agent consistently ignores injected auth context and focuses on the actual parser task. Ghost-deliverable-detection: agent verifies claimed prior work, discovers files untouched, completes all renames.

**Critical implication**: Simply injecting production-like context noise is insufficient. Production FM-2.6/3.1 require the *conjunction* of: (1) ambiguous or multi-part tasks, (2) partially-correct (not zero) prior work, (3) absence of automated tests catching gaps. The gym's clean task + test signals are so strong they override any amount of injected context noise. This confirms the gap is structural (environment simplicity), not fixable by infrastructure innovation alone.

**Infrastructure contribution**: The `injected_context` field in gym-runner.ts is now a permanent capability. Future scenario design should combine it with ambiguous tasks and partial (not zero) ghost deliverables.

### EXP-077: Fidelity Ladder (N=9, 3 levels × 3 runs)

Systematically tested which structural gaps actually drive difficulty by building a 3-level fidelity ladder, each adding one structural element to the same base scenario (ambiguous-context-drift):

| Level | Structural Element | Pass Rate | Key Failure Mode |
|-------|-------------------|-----------|-----------------|
| L1 (noisy context) | 38 lines of stale session history + conflicting claims | 67% (2/3) | Same as base — context-filesystem verification |
| L2 (ambiguous task + competing priorities) | Vague task + 3 competing priorities | 100% core / 0% full | Core work perfect; documentation deliverable consistently dropped |
| L3 (cascading state + recovery) | Broken env from crashed session + truncated files + information loss | 0% (0/3) | Partial corruption undetected (missing field in partially-correct file) |

**Critical findings that refine KE-053's gap model:**

1. **Content noise does NOT create difficulty** (L1 = base at 67%). This experimentally confirms KE-007: adding noisy context to a clean scenario doesn't change outcomes. Agents filter noise well. **Gap #1 (context volume) can be deprioritized.**

2. **Task ambiguity does NOT create difficulty for core work** (L2 core = 100%). Agents actually performed BETTER on the ambiguous task than the specific one. But ambiguity causes documentation deliverable drops (0% wrote summary when instruction was vague "write up what you did" vs 100% when specific "write a recovery report documenting what was broken and what you fixed"). **Gap #5 (temporal pressure/ambiguity) can be deprioritized for core work.**

3. **Cascading state from failures IS the primary difficulty driver** (L3 = 0%). This is the ONLY structural element that consistently defeated the agent across all runs. The mechanism is **information loss**: when prior sessions delete originals before crashing, recovery requires data the agent no longer has access to. Specifically, 3/3 runs correctly diagnosed auth.yaml was truncated and fixed `store: mem` → `store: memory`, but 0/3 detected the missing `session.max_age` field because the original auth.json (reference) was deleted by the crashed session. **Gap #2 (cascading state/tool chain complexity) is confirmed as primary driver.**

4. **Partial corruption is harder than total absence**: 3/3 runs successfully recreated logging.yaml from scratch (total absence), but 0/3 fully repaired truncated auth.yaml (partial corruption). Creating from scratch uses general knowledge; repairing truncation requires the original data.

5. **Documentation compliance depends on instruction specificity**: L2 "write up what you did" = 0% compliance. L3 "write a brief recovery report documenting what was broken and what you fixed" = 100% compliance. Actionable instructions → compliance; vague instructions → dropped.

**Revised gap hierarchy (from 5 co-equal gaps to prioritized stack):**
- **PRIMARY**: Cascading state from failures (Gap #2 + #3 combined) — production sessions fail, leave partial state, and successors must recover with information loss
- **SECONDARY**: Deliverable completeness under vague instructions — agents do substantive work but skip documentation when instructions are non-specific
- **NEGLIGIBLE**: Context noise (Gap #1), task ambiguity for core work (Gap #5)
- **UNTESTED**: Cross-agent coordination (Gap #4) — not addressed by the fidelity ladder

## Three Structural Gaps (Revised by EXP-077)

### Gap 1: Context Scale — *EXP-077: NEGLIGIBLE impact*
- **Production**: 11,229 files, 17,000+ sessions, multi-project codebase
- **Gym**: 3-12 files, no history, clean workspace
- **Causes**: FM-1.3 (looping in large codebases), FM-2.4 (path assumptions from partial knowledge), FM-2.1 (tool hallucination from unfamiliar surfaces)
- **Why untestable**: Gym runner creates fresh environments. Cannot simulate accumulated cognitive load.
- **EXP-077 finding**: L1 added 38 lines of noisy context and achieved identical 67% pass rate to base. Agents filter noise effectively. Context noise alone does not create the gap.

### Gap 2: Instruction Complexity — *EXP-077: SECONDARY impact (documentation only)*
- **Production**: Tasks embedded in multi-page context with stale references, competing priorities, checkpoint data
- **Gym**: Clean 5-20 line task.md files with unambiguous instructions
- **Causes**: FM-2.6 (instruction drift under noise), FM-1.1 (process misalignment from competing signals), FM-3.1 (ghost deliverables from misunderstood completion criteria)
- **Why untestable**: Gym runner now supports `injected_context` (EXP-067), but injecting fake checkpoints/history alone is insufficient — agents overcome it via clean task signals and tests. Full reproduction requires the conjunction of noisy context + ambiguous tasks + absent tests. Cannot simulate multi-session context accumulation at sufficient depth.
- **EXP-077 finding**: L2 added ambiguous task + competing priorities. Core work scored 100% (better than base!). But documentation deliverables scored 0% when instructions were vague. The gap is in deliverable completeness, not task execution.

### Gap 3: Compound Verification — *EXP-077: PRIMARY gap (cascading state)*
- **Production**: 3-5 interdependent file edits, implicit runtime dependencies, no integration tests for most changes
- **Gym**: 1-3 independent files, explicit import-based dependencies, integration tests provided
- **Causes**: FM-3.3 (verification gaps in dependency chains), FM-2.2 (accepting edits that break downstream consumers)
- **Why partially testable**: EXP-066 attempted this but hit ceiling because explicit tests make tracing trivial. Real production has implicit/runtime dependencies.
- **EXP-077 finding**: L3 (cascading state + recovery) scored 0/3 — the ONLY structural element that consistently defeated the agent. The mechanism is **information loss from cascading failures**: when prior sessions delete originals before crashing, recovery requires data the agent no longer has access to. Partial corruption (truncated files with some content remaining) is harder than total absence (agents recreate from scratch using general knowledge). This is the primary driver of the gym-production gap.

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
| EXP-067 injected context | 6/6 ceiling (2 scenarios) — confirms infrastructure innovation alone insufficient |
| EXP-077 L1 (noisy context) | 67% (2/3) — same as base, context noise has negligible impact |
| EXP-077 L2 (ambiguous task) | 100% core / 0% documentation — ambiguity doesn't affect core work |
| EXP-077 L3 (cascading state) | 0% (0/3) — primary gap driver, information loss from failed sessions |

## Links

- **synthesizes** → EXP-065 (production-gym gap analysis, N=893 errors)
- **synthesizes** → EXP-066 (compound edit verification, 3/3 ceiling)
- **synthesizes** → EXP-067 (injected_context, 6/6 ceiling — infrastructure innovation cannot close the gap)
- **synthesizes** → EXP-077 (fidelity ladder, 9 runs across 3 levels — cascading state is primary gap driver, context noise and task ambiguity are negligible)
- **extends** → KE-052 (structural access thesis — gym-production gap is access degradation)
- **confirms** → KE-013 (task boundedness drives quality — gym is maximally bounded)
- **extends** → KE-043 (forced externalization — explains why gym auto-forces but production doesn't)
- **confirms** → KE-007 (content noise doesn't create difficulty — EXP-077 L1 confirms experimentally)
- **connects** → H-054 (evaluation R-ceiling — gym evaluators may also have accuracy limits)
- **supports** → KE-050 (robustness is architectural — production adds architectural complexity gym lacks)
- **confirms** → EXP-041b, EXP-061 (gym skills have zero effect because gym already forces correct behavior)

---

*KE-053 | Bob (Architect) | 2026-04-07, updated 2026-04-08 | Synthesis of EXP-065/066/067/077*
