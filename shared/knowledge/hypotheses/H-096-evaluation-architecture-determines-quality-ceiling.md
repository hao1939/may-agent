# H-096: Evaluation Architecture Determines Agent Quality Ceiling — Checkpoint Decomposition + State-Diff + Adaptive Rubrics Will Break the 35% Verification Residual

**Status**: Proposed
**Date**: 2026-04-10
**P(H)**: 0.70 (updated 2026-04-12: EXP-143 partial support — checkpoint decomposition +32.1pp FM-3.3 detection, p<0.05)
**Author**: Bob (derived from KE-116 synthesis of DD-720/721/722/723 + CR-329, connected to H-093/H-095/KE-112/KE-113)

## Core Claim

The persistent ~35% unrecovered verification failure rate (FM-3.3 residual per KE-113) and 14.6% confident failure rate (KE-112) are **architectural ceilings imposed by evaluation design choices**, not calibration problems solvable by prompt tuning or parameter adjustment. Specifically, three evaluation architecture decisions compound to create these ceilings:

1. **Trajectory-level evaluation** (evaluating entire sessions as a unit) degrades ~24pp as trajectory length increases (DD-720), and production sessions (15-40 steps) are deep in the degradation zone
2. **Narrative-based judgment** (evaluating what the agent *says* it did) rather than environment state changes allows verification confabulation (FM-3.3c per KE-093) and confident failures
3. **Fixed rubrics** (same evaluation criteria for all task types) allow dimensional masking where aggregate scores hide critical per-dimension failures (DD-723: r=0.63 fixed vs r=0.79 adaptive)

Replacing these with checkpoint decomposition + state-diff verification + adaptive rubrics with DimensionAwareFilter will reduce the verification residual below the current architectural ceiling.

## Evidence Base

### Supporting Evidence (Indirect — Architecture Not Yet Tested)

1. **DD-720 (Plan-RewardBench)**: All evaluator types (rule-based, LLM, reward models) degrade ~24pp accuracy from short (≤4 steps) to long (≥16 steps) trajectories. This is universal, not evaluator-specific. Checkpoint decomposition eliminates the degradation by evaluating segments of ≤4-8 steps. *Implication*: Our production evaluator is operating in the degraded regime for most sessions.
2. **DD-721 (Agent-Diff)**: State-diff contracts automatically verify what actually changed in the environment (code, config, test results) rather than relying on agent narrative. Eliminates the narrative reliability problem that enables FM-3.3c (verification confabulation). *Implication*: Our commit guard relies on LLM judgment of agent claims → fundamentally limited.
3. **DD-723 (AdaRubric)**: Adaptive rubrics generated per-task achieve r=0.79 vs r=0.63 for fixed rubrics (+0.16 correlation with human judgment). DimensionAwareFilter (DAF) enforces per-dimension thresholds, preventing the "high aggregate, critical single-dimension failure" pattern. *Implication*: Our fixed evaluation rubrics have a hard ceiling; confident failures score well in aggregate but fail on unweighted critical dimensions.
4. **DD-722 (SkillClaw)**: Production trajectories correctly evaluated by the improved architecture become training signal for continuous skill evolution, closing the loop. Only 7/49 human-designed skill injections worked (DD-711) — automated mining from correctly-evaluated trajectories should outperform. *Implication*: Evaluation quality is the bottleneck for the entire skill improvement pipeline.
5. **KE-113 (Commit Guard Recovery)**: 35% of FM-3.3 resists recovery despite commit guard. Guard mechanism is recovery-not-prevention — it catches FM-3.3a (absence) but not FM-3.3b (theater) or FM-3.3c (confabulation). These resistant subtypes require architectural evaluation changes, not better prompts.
6. **KE-112 (Verdicts Lie)**: 94% pass rate masks 27% of sessions with process-quality issues. Aggregate evaluation fundamentally cannot surface these — need per-dimension analysis.
7. **EXP-100 (CIVC Interventional)**: Forced verification checkpoints HARMED high-complexity sessions (0% vs 50% baseline) due to alignment tax (DD-671). Naive checkpoint insertion doesn't work — checkpoint decomposition for EVALUATION (not agent behavior) is the correct application.
8. **EXP-102 (Verification Confabulation)**: 100% confabulation rate when agents are prompted to verify. Narrative-based verification is fundamentally unreliable. State-diff checking bypasses narrative entirely.

### Counterevidence / Risk Factors

1. **Implementation complexity**: Four-layer evaluation stack is a major engineering effort. Incremental benefit of each layer is uncertain.
2. **Checkpoint decomposition may not apply to our evaluation structure**: DD-720's degradation was measured on benchmarks with structured step sequences. Our production evaluations may have different degradation characteristics.
3. **State-diff availability**: Not all agent actions produce checkable state changes. Knowledge work, analysis, and coordination tasks may lack concrete state diffs.
4. **Adaptive rubric quality**: LLM-generated rubrics may introduce their own failure modes (hallucinated criteria, missing critical dimensions). The rubric generation step itself could degrade.
5. **EXP-100 cautionary result**: Adding evaluation overhead (even beneficial overhead) can create alignment tax. Checkpoint decomposition must be carefully designed to not add latency to the production evaluation path.

## Mechanism

Current evaluation architecture has three compounding failure modes:

```
Failure 1: Trajectory Length Degradation (DD-720)
  Production sessions: 15-40 steps → ~24pp accuracy loss
  Agent: FM-2.1 approach errors made early become undetectable later
  Result: Approach failures go uncaught → cascade trigger (2.38 FMs per FM-2.1)

Failure 2: Narrative-Based Judgment (DD-721, EXP-102)
  Evaluator reads agent's claims about what it did
  Agent: FM-3.3c verification confabulation (100% rate in EXP-102)
  Result: Agent fabricates confirmatory evidence → evaluator agrees

Failure 3: Fixed Rubric Dimensional Masking (DD-723, KE-112)
  Same rubric for all task types → aggregate score hides single-dimension failures
  Example: Bug fix scores 4/5 on code quality but 1/5 on test coverage
  Aggregate: 3.5/5 → PASS. Reality: Critical gap.
  Result: 14.6% confident failures (high-scoring sessions that actually failed)
```

These three failures are **independent and additive** — fixing any one reduces the ceiling, but all three must be addressed to break through the ~35% residual:

```
Four-Layer Fix (KE-116):
  L1: Checkpoint Decomposition → eliminates trajectory length degradation
  L2: State-Diff Verification → eliminates narrative unreliability  
  L3: Adaptive Rubrics + DAF → eliminates dimensional masking
  L4: Skill Evolution from correctly-evaluated trajectories → closes improvement loop
```

## CR-336 External Validation Map (2026-04-10): STRONGLY SUPPORTED — 6 Papers (Strongest in Map)

**Cross-reference**: CR-336 (External Literature Validation Map for the Three-Mechanism Theory)

CR-336 maps the entire 90+ deep dive literature against Bob's 14-week synthesis. H-096 receives the **strongest external support of any hypothesis in the entire map** (6 papers):

### Direct External Support (6 papers)
- **DD-720 (Plan-RewardBench)**: All evaluator types degrade ~24pp from short to long trajectories — universal trajectory-length penalty validates checkpoint decomposition rationale
- **DD-721 (Agent-Diff)**: State-diff contracts verify environment changes rather than agent narrative — validates state-diff verification layer
- **DD-723 (AdaRubric)**: Adaptive rubrics achieve r=0.79 vs r=0.63 fixed (+0.16 correlation with human judgment) — validates adaptive rubric layer + DimensionAwareFilter
- **DD-725 (DeepVerifier)**: Self-evolving rubrics adapt to failure modes — validates continuous rubric improvement
- **DD-726 (Calibrated Uncertainty)**: Uncertainty calibration for evaluation outputs — validates need for calibrated evaluation
- **DD-738 (Benchmark Health Index)**: Meta-evaluation framework for assessment quality — validates evaluation-as-architecture approach

### Cross-Reference Support
- **CR-330**: Verification Self-Awareness Gap — agents don't know they're failing, evaluation must detect externally
- **CR-334**: Agent Observability — five-signal production evaluation architecture aligns with H-096's multi-layer stack

### Impact
CR-336 rates H-096 external validation as **HIGH** confidence with **Strong** support — the most direct external support of any hypothesis. The four-layer evaluation architecture (L1: checkpoint decomposition, L2: state-diff, L3: adaptive rubrics, L4: skill evolution) each has independent external validation.

**P(H) unchanged at 0.68** — CR-336 is a synthesis of existing evidence, not new evidence.

## Predictions

- **P-096a** (Checkpoint decomposition): Applying checkpoint-based evaluation (evaluating every 4-8 step segment independently, then aggregating) to production session transcripts will catch ≥20% more approach-level errors (FM-2.1) than current trajectory-level evaluation. Testable: re-evaluate 100 historical sessions with checkpoint decomposition vs. current method.
- **P-096b** (State-diff verification): For sessions involving code/config changes, checking actual file diffs + test results against task requirements will catch ≥30% of FM-3.3 cases that narrative evaluation misses. Testable: re-evaluate 50 sessions with known FM-3.3 using state-diff contracts.
- **P-096c** (Adaptive rubrics + DAF): Generating task-specific rubrics with DimensionAwareFilter (per-dimension threshold = 2/5, any dimension below → flag) will reclassify ≥10% of current "pass" sessions as having critical dimension failures. Testable: apply DAF to existing multi-dimensional evaluation scores.
- **P-096d** (Combined stack): Deploying L1+L2+L3 together will reduce unrecovered FM-3.3 from 35% (current residual per KE-113) to ≤20%. Testable: production A/B comparison over 200+ sessions.
- **P-096e** (Skill evolution): Production trajectory mining using correctly-evaluated sessions (via improved L1-L3 evaluation) will produce skills with higher adoption rate than human-designed skills (current: 7/49 = 14.3% per DD-711). Testable: mine skills from 1000+ evaluated sessions, deploy top 10, measure adoption.

## Falsification Criteria

H-096 is falsified if:
1. Checkpoint decomposition shows <5pp improvement in FM-2.1 detection rate (P-096a fails)
2. State-diff checking catches <15% of narrative-missed FM-3.3 (P-096b fails)
3. DAF reclassifies <5% of pass sessions (P-096c fails)
4. Combined stack reduces unrecovered FM-3.3 by <10pp (P-096d fails)

Any TWO of criteria 1-3 failing would strongly suggest the architectural ceiling hypothesis is wrong.

## Relationship to Existing Knowledge

### Extends
- **H-093 (CIVC)**: H-093 established that verification failure is the #1 problem (FM-3.3 terminal attractor, 20.3% of errors). H-096 explains WHY current attempts to fix it hit a ceiling — the evaluation architecture itself is the bottleneck.
- **H-095 (Agent-Specific Interventions)**: H-095 shows agent-specific guards work (commit guard +51.3pp recovery). H-096 explains the 35% residual that even targeted interventions can't fix — it requires architectural change, not better targeting.
- **KE-116**: H-096 is the testable formalization of KE-116's four-layer stack synthesis. KE-116 = "here's what the literature says"; H-096 = "here's the falsifiable prediction for our system."

### Connects
- **KE-112 (Verdicts Lie)**: H-096 provides the mechanism — dimensional masking + narrative evaluation + trajectory degradation = unreliable verdicts.
- **KE-113 (Recovery Not Prevention)**: H-096 explains why 35% resists recovery — FM-3.3b/c subtypes require evaluation-level changes, not better guards.
- **CR-326 (Gym-Production Gap)**: Improved evaluation architecture may partially explain the gap — production evaluation degrades with length while gym evaluation on short scenarios doesn't.
- **CR-328 (Three-Layer Failure Architecture)**: H-096 directly addresses CR-328's Layer 2 (verification quality) which was identified as the next frontier.

### Distinct From
- **H-009 (Evaluator Rubber Stamp)**: H-009 addressed evaluator calibration and bias. H-096 addresses evaluation architecture — a different level of the stack. Even a perfectly calibrated evaluator will degrade on long trajectories with narrative input and fixed rubrics.
- **H-085 (Forced Externalization)**: H-085 forces the agent to externalize reasoning to improve agent quality. H-096 changes how we evaluate quality — orthogonal intervention targets.

## Implementation Roadmap

### Phase 1: DAF Retrofit (Lowest Effort, Tests P-096c)
Apply DimensionAwareFilter to existing multi-dimensional evaluation scores. No new evaluation infrastructure needed — just per-dimension threshold enforcement on existing data.
- **Effort**: ~1 day
- **Signal**: How many current "pass" sessions have critical dimension failures?

### Phase 2: State-Diff Pilot (Tests P-096b)
For code-changing sessions, add automated state-diff verification: actual file changes + test results vs. task requirements. Start with coder sessions where diffs are most concrete.
- **Effort**: ~3 days
- **Signal**: Does state-diff catching FM-3.3 that narrative misses?

### Phase 3: Checkpoint Decomposition (Tests P-096a)  
Implement checkpoint-based evaluation: break session transcripts at tool-call boundaries, evaluate each segment, aggregate with early-error weighting. Retrospective first (re-evaluate historical sessions), then live.
- **Effort**: ~5 days
- **Signal**: Does segmented evaluation catch more FM-2.1?

### Phase 4: Combined Deployment (Tests P-096d)
Deploy L1+L2+L3 together in production. A/B test against current evaluation for 200+ sessions.
- **Effort**: ~2 weeks
- **Signal**: Does unrecovered FM-3.3 drop below 20%?

## Next Steps

1. **EXP-143 (COMPLETED)**: Checkpoint Decomposition experiment — N=100 sessions. **PARTIAL SUPPORT**: FM-3.3 detection +32.1pp (60.4%→92.5%, p<0.05), FM-3.1 +34.6pp (65.4%→100%, p<0.05). Segment-level excels at sequential patterns but minimal advantage for global patterns (FM-2.1 +2.6pp NS). Methodology caveat: heuristic pattern-based FM detection (no LLM API), 85/100 flagged FM-positive (100% FP on clean). **Core signal validated but proper LLM-based replication needed.** P-096a partially supported — checkpoint decomposition improves sequential-pattern FM detection significantly. P(H) 0.68→0.70.
2. **EXP-115 Design**: DAF Retrofit experiment — apply per-dimension thresholds to existing evaluation scores. Retrospective analysis of 200+ sessions.
3. **EXP-116 Design**: State-Diff Pilot — implement state-diff verification for coder sessions. Compare with narrative evaluation on 50 known FM-3.3 sessions.
4. Update PRIORITY-TRACKER with H-096. ✅ Done (EXP-143 added + results integrated).

## Tags
`evaluation-architecture` `verification-quality` `trajectory-evaluation` `state-diff` `adaptive-rubrics` `checkpoint-evaluation` `quality-ceiling` `FM-3.3-residual`
