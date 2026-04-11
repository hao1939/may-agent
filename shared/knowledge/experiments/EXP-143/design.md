# EXP-143: Checkpoint Decomposition Improves Evaluation Accuracy (Tests H-096 P-096a)

**Status**: DESIGNED  
**Date**: 2026-04-11  
**Author**: Bob  
**Tests**: H-096 Prediction P-096a  
**Depends on**: H-096, KE-116, DD-720 (Plan-RewardBench)

---

## Objective

Test whether decomposing session evaluation into checkpoint-level segments (4–8 tool calls each) and aggregating segment-level judgments produces more accurate evaluation than holistic end-state judgment of the full session transcript.

This directly tests **P-096a**: *"Applying checkpoint-based evaluation (evaluating every 4–8 step segment independently, then aggregating) to production session transcripts will catch ≥20% more approach-level errors (FM-2.1) than current trajectory-level evaluation."*

---

## Background

### The Problem
DD-720 (Plan-RewardBench) found that **all evaluator types** (rule-based, LLM, reward models) degrade ~24 percentage points in accuracy from short trajectories (≤4 steps) to long ones (≥16 steps). Our production sessions are 15–40 tool calls — deep in the degradation zone.

This trajectory-length degradation is a candidate explanation for:
- **35% FM-3.3 verification residual** (KE-113): evaluator can't reliably assess verification quality in long sessions
- **14.6% confident-but-wrong rate** (KE-112): evaluator gives high scores to sessions that actually failed
- **FM-2.1 approach errors going undetected**: early approach mistakes become invisible by session end

### Why Checkpoint Decomposition Should Help
If evaluation accuracy degrades with trajectory length, then evaluating shorter segments should recover that lost accuracy. By splitting a 30-step session into 4–6 segments of 5–8 steps each, each segment falls within the high-accuracy regime (≤8 steps per DD-720's findings).

### Cautionary Precedent: EXP-100
EXP-100 tested forced verification *checkpoints for the agent* during task execution and found it **harmed** complex sessions (0% success vs 50% baseline) due to alignment tax. This experiment is fundamentally different: we decompose the **post-hoc evaluation**, not the agent's behavior. The agent session is already complete — we're only changing how we assess it.

---

## Design

### Type: Retrospective Re-Evaluation (Within-Subjects)

We take historical session transcripts that already have human-labeled ground truth (FM labels from the finish-guard and coach evaluations), then evaluate each session **twice**:
- **Arm A (Holistic — Control)**: Full session transcript evaluated as a single unit
- **Arm B (Checkpoint-Decomposed — Treatment)**: Same transcript split into sequential segments, each evaluated independently, then aggregated

Same sessions, same evaluator LLM, same rubric content — only the evaluation structure changes. This eliminates session-level confounds.

### Independent Variable
**Evaluation method** (2 levels):
1. **Holistic**: Evaluator receives the complete session transcript and produces a single quality judgment (pass/fail + failure mode classification)
2. **Checkpoint-Decomposed**: Session transcript is split at natural boundaries (tool-call clusters, phase transitions). Each segment is evaluated independently for: (a) whether the agent's approach in that segment was sound, (b) whether verification was adequate, (c) whether any failure modes are present. Segment judgments are then aggregated using worst-segment and weighted-average rules.

### Dependent Variables

**Primary DV**: Evaluation accuracy against ground-truth FM labels  
- **Detection rate**: % of known failure modes correctly identified by the evaluation method
- **False positive rate**: % of clean sessions incorrectly flagged as having failure modes
- **Accuracy**: Overall correct classification rate

**Secondary DVs**:
- **FM-2.1 detection rate**: % of known approach errors caught (the specific P-096a prediction)
- **FM-3.3 detection rate**: % of known verification failures caught
- **Confident-wrong rate**: % of sessions rated "high quality" that actually had labeled failures
- **Error localization**: Whether checkpoint decomposition identifies *which segment* contains the error (holistic cannot do this by design)

---

## Procedure

### Step 1: Session Selection (Sample Construction)

Select 100 historical sessions meeting these criteria:
- **Agent**: any (bob, optimizer, scout, may, coach, tech-lead, coder)
- **Length**: ≥15 tool calls (ensures sessions are in the trajectory-degradation zone per DD-720)
- **Ground truth available**: Session has been evaluated by the finish-guard system, with FM labels recorded (FM-2.1, FM-3.3, FM-2.6, FM-1.3, etc.) OR has been manually reviewed with known outcomes
- **Recency**: Last 14 days (2026-03-28 to 2026-04-11) to ensure relevance

**Stratified sampling** to ensure adequate representation:
- ~40 sessions with **at least one labeled failure mode** (enriched for signal)
- ~20 sessions with **FM-2.1 specifically** (approach errors — the key P-096a target)
- ~20 sessions with **FM-3.3 specifically** (verification failures)
- ~20 sessions labeled as **clean/successful** (to measure false positive rate)

**Source of ground truth**: The finish-guard's FM labels serve as ground truth. These labels are assigned by the guard system based on transcript analysis and have been validated through the coach evaluation process. Where guard labels conflict with session outcomes, prefer the guard label (it has access to the full transcript). Sessions where ground truth is ambiguous are excluded.

### Step 2: Transcript Segmentation

For each session in the sample, produce a checkpoint-decomposed version:

**Segmentation algorithm**:
1. Parse the session transcript into a sequence of (thought, tool_call, tool_result) triples
2. Group into segments of 4–8 tool calls each, breaking at natural boundaries:
   - Phase transitions (if the session uses a phased workflow)
   - Topic shifts (agent begins working on a different sub-task)
   - File boundaries (agent moves to a different file/directory)
   - If no natural boundary exists within 8 calls, force a break at 8
3. Each segment includes: (a) a brief context preamble summarizing prior segments, (b) the segment's tool calls, (c) the task description for reference
4. Target: 3–8 segments per session (depending on session length)

**Context preamble** for each segment (to prevent loss of global context):
```
Session task: [original task description]
Segment N of M.
Prior segments summary: [1-2 sentence summary of what happened in segments 1..N-1]
---
[Segment N transcript]
```

### Step 3: Evaluation Execution

For each of the 100 sessions, run two evaluations:

**Arm A — Holistic Evaluation**:
- Input: Complete session transcript + task description
- Prompt: "Evaluate this agent session. Identify any failure modes present (FM-2.1 approach error, FM-2.6 reasoning-action mismatch, FM-3.3 verification failure, FM-1.3 error recovery failure, FM-3.1 ghost deliverable). Rate overall quality (pass/fail). Explain your reasoning."
- Output: List of detected FMs + pass/fail + reasoning

**Arm B — Checkpoint-Decomposed Evaluation**:
- For each segment (independently):
  - Input: Segment transcript + context preamble + task description
  - Prompt: "Evaluate this segment of an agent session. For this segment specifically: (1) Is the approach sound for the current sub-task? (2) Are tool calls appropriate and well-formed? (3) Is there adequate verification of results? (4) Are there any failure modes? Identify: FM-2.1, FM-2.6, FM-3.3, FM-1.3, FM-3.1 if present."
  - Output: Per-segment FM list + quality rating
- **Aggregation**: 
  - Session has FM-X if **any** segment detected FM-X (union rule)
  - Session quality = **worst-segment** rating (conservative) AND **weighted-average** rating (balanced)
  - Report both aggregation methods

**Evaluator**: Use the same LLM (Claude Sonnet) for both arms to control for model differences. Temperature = 0 for reproducibility.

**Blinding**: The evaluator prompt does not reveal which arm the evaluation belongs to. Each evaluation is independent — the holistic evaluator doesn't see segment results, and vice versa.

### Step 4: Scoring

For each session × method combination, compute:
- **True Positives**: FM correctly identified (matches ground-truth label)
- **False Positives**: FM flagged but not in ground truth
- **False Negatives**: FM in ground truth but not flagged
- **True Negatives**: FM correctly not flagged

Compute per-FM-type and aggregate:
- Detection rate (sensitivity) = TP / (TP + FN)
- False positive rate = FP / (FP + TN)
- Precision = TP / (TP + FP)
- F1 = 2 × (Precision × Sensitivity) / (Precision + Sensitivity)

---

## Hypotheses & Success Criteria

| ID | Hypothesis | Metric | Success Threshold | P(H) Update |
|---|---|---|---|---|
| H-143a | Checkpoint decomposition detects more FM-2.1 errors | FM-2.1 detection rate (Arm B − Arm A) | Arm B detects ≥20% more FM-2.1 (absolute, i.e., if Arm A catches 10/20, Arm B catches ≥14/20) | **Pass**: P(H-096) → 0.80. **Fail (<5pp diff)**: P(H-096) → 0.55 |
| H-143b | Checkpoint decomposition detects more FM-3.3 errors | FM-3.3 detection rate difference | Arm B detects ≥15% more FM-3.3 | **Pass**: P(H-096) += 0.05. **Fail**: P(H-096) -= 0.05 |
| H-143c | Checkpoint decomposition reduces confident-wrong rate | Sessions rated "pass" that have ground-truth failures | Arm B has ≤50% of Arm A's confident-wrong rate | **Pass**: Strong evidence for H-096 mechanism. **Fail**: Suggests trajectory length isn't the primary cause |
| H-143d | Holistic evaluation accuracy degrades with session length | Correlation between session length and holistic error rate | Significant positive correlation (p < 0.05) between # tool calls and holistic false-negative rate | **Pass**: Validates DD-720 applies to our system. **Fail**: DD-720 may not generalize here |
| H-143e | Checkpoint decomposition does NOT significantly increase false positives | False positive rate difference | Arm B FP rate ≤ Arm A FP rate + 10pp | **Pass**: Decomposition is safe. **Fail**: Over-flagging makes it impractical |

### Primary Success Criterion (for P-096a)
**H-143a PASS**: Checkpoint decomposition detects ≥20% more FM-2.1 approach errors than holistic evaluation.

If H-143a passes, P-096a is supported and H-096 P(H) increases from 0.68 → 0.80.  
If H-143a fails (<5pp difference), P-096a is not supported and H-096 P(H) decreases to 0.55.  
If H-143a is ambiguous (5–19pp difference), the result is suggestive but inconclusive; P(H-096) → 0.72.

---

## Power Analysis

### Sample Size Justification

**Target effect**: 20pp improvement in FM-2.1 detection rate (e.g., from 50% to 70%).

Using McNemar's test for paired proportions (same sessions evaluated both ways):
- Baseline detection rate: p₀ = 0.50 (conservative estimate — holistic catches about half of FM-2.1)
- Treatment detection rate: p₁ = 0.70  
- Discordant pair probability: ~0.30 (sessions where one method catches an FM and the other doesn't)
- α = 0.05 (two-sided), β = 0.20 (80% power)
- Required discordant pairs ≈ 25
- With ~40 FM-positive sessions and 30% discordant rate → ~12 discordant pairs

**N = 100 sessions (40 FM-positive)** provides:
- ~12–15 discordant pairs for the primary test — borderline for 80% power
- Sufficient for descriptive comparison and confidence intervals
- If initial results are promising but underpowered, extend to N = 200

**Contingency**: If we cannot find 40 sessions with FM-2.1 labels in the 14-day window, extend the lookback to 30 days or reduce the minimum session length to ≥10 tool calls.

---

## Implementation Details

### Segmentation Script

```typescript
// agents/.lab/exp143-segment.ts (pseudocode)
interface Segment {
  index: number;
  totalSegments: number;
  contextPreamble: string;
  transcript: string;  // raw tool calls for this segment
  toolCallCount: number;
}

function segmentSession(transcript: string, taskDescription: string): Segment[] {
  const toolCalls = parseToolCalls(transcript);
  const segments: Segment[] = [];
  let currentSegment: ToolCall[] = [];
  
  for (const call of toolCalls) {
    currentSegment.push(call);
    
    // Break at natural boundaries OR forced at 8 calls
    if (currentSegment.length >= 4 && isNaturalBreak(call, currentSegment)) {
      segments.push(buildSegment(currentSegment, segments, taskDescription));
      currentSegment = [];
    } else if (currentSegment.length >= 8) {
      segments.push(buildSegment(currentSegment, segments, taskDescription));
      currentSegment = [];
    }
  }
  
  // Flush remaining
  if (currentSegment.length > 0) {
    segments.push(buildSegment(currentSegment, segments, taskDescription));
  }
  
  return segments;
}

function isNaturalBreak(call: ToolCall, segment: ToolCall[]): boolean {
  // Phase transitions: finish() calls, checkpoint() calls
  if (call.name === 'finish' || call.name === 'checkpoint') return true;
  // File boundary: different file path than previous calls
  if (call.name === 'edit' || call.name === 'write' || call.name === 'read') {
    const prevFile = segment.slice(-2, -1)[0]?.params?.path;
    if (prevFile && call.params?.path !== prevFile) return true;
  }
  // Agent dispatch boundary
  if (call.name === 'agents') return true;
  return false;
}
```

### Evaluation Prompt Templates

**Holistic (Arm A)**:
```
You are evaluating an agent work session for quality and failure modes.

TASK: {taskDescription}

SESSION TRANSCRIPT:
{fullTranscript}

Evaluate this session:
1. Did the agent complete the task successfully? (PASS/FAIL)
2. Identify ALL failure modes present from this list:
   - FM-2.1: Approach error (wrong strategy from the start)
   - FM-2.6: Reasoning-action mismatch (plan says X, does Y)  
   - FM-3.3: Verification failure (doesn't verify work, or fakes verification)
   - FM-1.3: Error recovery failure (hits error, doesn't recover well)
   - FM-3.1: Ghost deliverable (claims output that doesn't exist)
3. Rate confidence in your assessment (LOW/MEDIUM/HIGH)
4. Briefly explain your reasoning.

Output JSON: {"verdict": "PASS"|"FAIL", "failureModes": ["FM-X.X", ...], "confidence": "LOW"|"MEDIUM"|"HIGH", "reasoning": "..."}
```

**Checkpoint Segment (Arm B)**:
```
You are evaluating ONE SEGMENT of an agent work session.

TASK: {taskDescription}
SEGMENT: {segmentIndex} of {totalSegments}
PRIOR CONTEXT: {contextPreamble}

SEGMENT TRANSCRIPT:
{segmentTranscript}

Evaluate THIS SEGMENT ONLY:
1. Is the approach in this segment sound for the sub-task being performed? (SOUND/QUESTIONABLE/WRONG)
2. Are tool calls appropriate and well-formed? (YES/MOSTLY/NO)
3. Does the agent verify results adequately in this segment? (YES/PARTIAL/NO)
4. Identify failure modes present IN THIS SEGMENT:
   - FM-2.1: Approach error
   - FM-2.6: Reasoning-action mismatch
   - FM-3.3: Verification failure
   - FM-1.3: Error recovery failure  
   - FM-3.1: Ghost deliverable
5. Rate this segment's quality (1-5 scale)
6. Confidence (LOW/MEDIUM/HIGH)

Output JSON: {"approach": "SOUND"|"QUESTIONABLE"|"WRONG", "toolQuality": "YES"|"MOSTLY"|"NO", "verification": "YES"|"PARTIAL"|"NO", "failureModes": ["FM-X.X", ...], "quality": 1-5, "confidence": "LOW"|"MEDIUM"|"HIGH", "reasoning": "..."}
```

**Aggregation Logic**:
```typescript
function aggregateSegmentEvaluations(segments: SegmentEvaluation[]): SessionEvaluation {
  // Union of all detected failure modes
  const allFMs = new Set(segments.flatMap(s => s.failureModes));
  
  // Worst-segment verdict
  const worstQuality = Math.min(...segments.map(s => s.quality));
  const worstVerdict = worstQuality <= 2 ? 'FAIL' : 'PASS';
  
  // Weighted-average verdict (weight later segments slightly more — 
  // final segments often contain verification/delivery)
  const weights = segments.map((_, i) => 1 + (i / segments.length) * 0.5);
  const weightedAvg = segments.reduce((sum, s, i) => sum + s.quality * weights[i], 0) 
                    / weights.reduce((a, b) => a + b, 0);
  const avgVerdict = weightedAvg <= 2.5 ? 'FAIL' : 'PASS';
  
  return {
    failureModes: Array.from(allFMs),
    worstSegmentVerdict: worstVerdict,
    averageVerdict: avgVerdict,
    worstSegmentQuality: worstQuality,
    averageQuality: weightedAvg,
    segmentCount: segments.length,
    // Flag which segment contained each FM (error localization)
    fmLocalization: Object.fromEntries(
      Array.from(allFMs).map(fm => [
        fm, 
        segments.filter(s => s.failureModes.includes(fm)).map(s => s.index)
      ])
    )
  };
}
```

---

## Execution Plan

| Phase | Duration | Activity | Output |
|---|---|---|---|
| **Phase 0: Setup** | 1 session | Build segmentation script, evaluation prompt templates, scoring framework | `agents/.lab/exp143-segment.ts`, `agents/.lab/exp143-evaluate.ts` |
| **Phase 1: Sample** | 1 session | Select 100 sessions, extract transcripts, verify ground-truth labels | `EXP-143/sample.json` — session IDs + ground truth + metadata |
| **Phase 2: Segment** | 1 session | Run segmentation on all 100 sessions, quality-check 10 randomly | `EXP-143/segments/` — one file per session |
| **Phase 3: Evaluate** | 2-3 sessions | Run both evaluation arms on all 100 sessions (200 total evaluations) | `EXP-143/evaluations/holistic/`, `EXP-143/evaluations/checkpoint/` |
| **Phase 4: Analyze** | 1 session | Score all evaluations against ground truth, compute metrics, test hypotheses | `EXP-143/results.md` |

**Total estimated cost**: 6–8 work sessions, ~$3–5 in LLM evaluation calls (200 evaluations × moderate token cost).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Ground truth labels are noisy** — FM labels from finish-guard may themselves be inaccurate | Medium | High — if ground truth is wrong, we can't measure accuracy | Use only sessions where FM labels were confirmed by coach review or where the guard block → retry → different outcome provides clear signal. Exclude ambiguous cases. |
| **Segmentation artifacts** — poor segment boundaries split coherent reasoning | Medium | Medium — artificial segments could hurt Arm B | Quality-check 10 random segmentations manually. Tune boundary detection. Report segment quality metrics. |
| **Context preamble insufficient** — segment evaluator lacks context to judge approach | Medium | Medium — Arm B disadvantaged by missing context, not by architecture | Test multiple context preamble lengths (1-line, 3-line, full summary). Report sensitivity analysis. |
| **Evaluator memorizes sessions** — if the LLM has seen these sessions before | Low | Low — we use temperature=0, and sessions are our internal data | Each evaluation is a fresh API call with no conversation history. |
| **Sample bias** — enriching for FM-positive sessions inflates detection rates | Low | Medium — could make both arms look better than reality | Report both raw rates and stratified rates. Primary comparison is Arm B vs Arm A (relative), not absolute detection. |
| **DD-720 doesn't generalize** — trajectory degradation was measured on benchmarks, not our evaluator | Medium | High — experiment premise may be wrong | H-143d specifically tests whether our evaluator shows length-dependent accuracy. If H-143d fails, the experiment still provides data but the DD-720 connection is weakened. |

---

## Relationship to Knowledge Base

### Tests
- **H-096 P-096a**: Primary prediction being tested — checkpoint decomposition catches ≥20% more FM-2.1
- **DD-720 (Plan-RewardBench)**: Does the ~24pp trajectory-length degradation apply to our evaluation system?

### Informs
- **H-096 P-096d** (combined stack): If checkpoint decomposition alone shows significant improvement, it justifies building the full L1+L2+L3 stack
- **KE-113 (35% residual)**: If decomposition catches FM-3.3 missed by holistic evaluation, it explains part of the residual mechanism
- **KE-112 (Verdicts Lie)**: If decomposition reduces the confident-wrong rate, it validates that trajectory length is a key driver

### Depends On
- **H-096**: The theoretical framework predicting why decomposition should help
- **KE-116**: The four-layer evaluation architecture synthesis that motivates L1 (checkpoint decomposition)
- **EXP-100**: Cautionary precedent — decomposition must be for evaluation, not for agent behavior

### Related Experiments
- **EXP-139/142**: Currently running, testing workflow-level verification. EXP-143 tests evaluation-level improvements — complementary interventions
- Future **EXP-144** (State-Diff, P-096b) and **EXP-145** (Adaptive Rubrics, P-096c) would test the other layers of H-096

---

## Decision Matrix (Outcome → Action)

| H-143a (FM-2.1) | H-143d (Length Effect) | H-143e (FP Safe) | Interpretation | Next Step |
|---|---|---|---|---|
| ✅ ≥20pp | ✅ Significant | ✅ FP safe | **Full success**: Decomposition works, length effect confirmed, no FP cost | Build production checkpoint evaluator. Design EXP-144 (State-Diff). P(H-096) → 0.80 |
| ✅ ≥20pp | ❌ No length effect | ✅ FP safe | Decomposition helps but NOT because of trajectory length — different mechanism | Investigate why. Still valuable. P(H-096) → 0.72 (mechanism uncertain) |
| ✅ ≥20pp | ✅ Significant | ❌ FP high | Works but over-flags — needs calibration | Tune aggregation logic (e.g., require 2+ segments to flag). P(H-096) → 0.75 |
| ❌ <5pp | ✅ Significant | N/A | Length effect exists but decomposition doesn't help — segmentation or aggregation is wrong | Redesign segmentation. Try different segment sizes. P(H-096) → 0.60 |
| ❌ <5pp | ❌ No length effect | N/A | **Full failure**: No length effect, no decomposition benefit | H-096 L1 is wrong. Pivot to L2 (State-Diff) or L3 (Adaptive Rubrics). P(H-096) → 0.55 |

---

## Tags
`evaluation-architecture`, `checkpoint-decomposition`, `H-096`, `P-096a`, `retrospective-evaluation`, `within-subjects`, `FM-2.1-detection`, `FM-3.3-detection`, `trajectory-length-degradation`
