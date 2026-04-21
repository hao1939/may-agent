# H-180: Structured Lesson Extraction Outperforms Raw Experience Replay

**Created**: 2025-04-28 by orchestrator
**Status**: proposed
**Confidence**: ★★★☆ (P(H) ≈ 0.70)
**Source**: KE-328/329 (DD-831 agent learning survey), KE-333/334 (DD-832 Voyager/MemGPT/Reflexion), KE-336 (EXP-192 quality gap analysis)
**Connects**: H-179 (self-lesson replay vs curated few-shot), H-085 (forced externalization), H-165 (production-provision interference), H-091 (few-shot delivery), H-098 (attention channel theory)

---

## Claim

Agents that extract **structured lessons** (classify failure mode → identify root cause → write corrective rule) from their own session transcripts will outperform agents given **raw session transcripts** as few-shot examples, specifically on judgment tasks. The structured extraction process forces the same externalization that H-085/H-165 identify as critical — **the lesson-writing process itself is the intervention, not the lesson content**.

This sharpens H-179's task-type moderation claim with a mechanistic explanation: structure matters more than content because structured extraction is a forced externalization event (H-085) that creates Ch2-compatible artifacts (H-098). Raw transcript replay is Ch1-only (text dumped into context), which H-098 predicts will fail on judgment tasks.

## Mechanism

Three converging evidence lines:

1. **Structure > Content** (KE-328/329/333/334): Across Voyager, MemGPT, and Reflexion, the papers that succeed share structured memory (typed skills, hierarchical summaries, verbal RL with explicit failure classification). The papers that fail dump raw experience. DD-831's survey and DD-832's deep-dive both converge on this as THE key finding.

2. **Self-generated ≈ curated on quality** (KE-336, EXP-192): Phase 1 found self-generated lessons were surprisingly close to curated expert examples on 3/4 scenarios. The quality gap is smaller than H-179 predicted. This means the *structure* of the lesson, not the *expertise* behind it, is doing the work.

3. **Forced externalization as the active ingredient** (H-085, H-165): H-085 establishes that forced externalization is the general mechanism behind judgment interventions. H-165 shows that self-production can destroy expert content on hard tasks — but that's when production competes with consumption. When the agent is ONLY producing (extracting lessons from its own transcripts, not simultaneously solving a task), the production overhead becomes the intervention itself.

### Why structured extraction works (proposed causal chain)

```
Raw transcript → agent reads passively → Ch1 channel → filtered by attention competition → low uptake

Structured extraction:
  Session transcript → "classify failure mode" → forces pattern recognition (externalization event #1)
  Failure mode → "identify root cause" → forces causal reasoning (externalization event #2)  
  Root cause → "write corrective rule" → forces action commitment (externalization event #3)
  → Three Ch2-compatible artifacts produced
  → Subsequent replay pushes structured artifacts, not raw text
```

Each extraction step is a forced externalization gate (H-085). The resulting artifacts are structured (Ch2-compatible per H-098), not raw text (Ch1). The agent who did the extraction has already internalized the lesson through the production process — the artifacts are a bonus, not the mechanism.

## Predictions

- **P-180a** (judgment): Structured self-lessons > raw transcript replay on judgment tasks by **≥20pp**. The structure forces the classify-then-act pattern that H-091 showed transfers at 100% via matched few-shot.

- **P-180b** (execution narrowing): The gap narrows on execution tasks to **<10pp**. Execution tasks benefit from procedural content (step sequences), which raw transcripts contain directly. Structure adds less value when the content is already procedural.

- **P-180c** (curated comparison): Structured self-lessons ≈ curated few-shot on execution tasks (within 10pp) but **< curated on judgment** (≥15pp gap). Curated examples encode expert mental models that self-extraction cannot generate from failed transcripts alone. This is H-165's quality-dependence finding applied to the lesson domain.

- **P-180d** (mediator): Quality of self-extracted lessons (rated by independent evaluator on specificity, correctness, actionability) **mediates** the relationship between structured extraction and performance. Higher-quality extractions → higher pass rates. This is the causal test: if the process is the only mechanism, quality shouldn't matter. If quality also matters, it's process + content.

## Test Design (EXP-180)

### Prerequisites
- Gym infrastructure fixed (EXP-190 P0 blocker resolved)
- Agent binary available for independent trials

### Phase 1: Generate Transcripts (~$4)
1. Run agent through 6 scenarios (3 judgment, 3 execution) × 3 trials each = 18 runs
2. Collect full session transcripts (including tool calls, reasoning, failures)
3. Select transcripts where agent failed (need failure transcripts for lesson extraction)

### Phase 2: Structured Extraction (~$2)
For each failed transcript:
1. Prompt agent with structured extraction template:
   - "What failure mode occurred? (classify: wrong-diagnosis / missed-info / premature-action / other)"
   - "What was the root cause? (1 sentence)"
   - "Write a corrective rule that would prevent this failure (imperative, actionable)"
2. Rate each extracted lesson: specificity (1-5), correctness (binary), actionability (1-5)

### Phase 3: Comparative Trials (~$10)
For each scenario, 4 arms × 5 trials = 20 runs per scenario, 120 total:
- **Arm A**: No guidance (baseline)
- **Arm B**: Raw transcript from Phase 1 failure injected as context
- **Arm C**: Structured self-lesson from Phase 2 injected at task start
- **Arm D**: Curated few-shot example (from H-091/EXP-192 set)

### Metrics
- Pass rate per arm × task type (judgment vs execution)
- Effect size: Arm C − Arm B (structured vs raw) — primary test of H-180
- Effect size: Arm D − Arm C (curated vs structured self) — replicates H-179
- Lesson quality score × pass rate correlation (P-180d mediator test)

### Decision Criteria
- If P-180a confirmed (C − B ≥ 20pp on judgment): Structure is the mechanism, not content. Invest in extraction templates, not curated examples.
- If P-180b confirmed (C − B < 10pp on execution): Structure matters less when content is procedural. Task-type routing is needed.
- If P-180d shows mediation: Both process AND content matter. The optimal system uses structured extraction to IMPROVE content, not replace it.
- If P-180a rejected (C ≈ B on judgment): Structure is not the mechanism. H-179's quality-gap explanation is correct instead.

### Cost
- ~$16 total across 3 phases
- 138 runs (18 transcript generation + 120 comparative)

## Relationship to H-179

H-179 asks: "Does self-generated replay match curated few-shot?" (answer: depends on task type).
H-180 asks: "WHY does structure matter?" (answer: extraction process = forced externalization).

H-179 is descriptive (task-type moderation). H-180 is mechanistic (structured extraction as forced externalization). H-180 subsumes H-179's predictions but adds the process-vs-content decomposition.

If H-180 is confirmed, the practical implication changes from "use curated for judgment, self-generated for execution" (H-179) to "always use structured extraction; the process itself is the intervention."

## Priority

Medium-High. Blocked on gym infrastructure (same as EXP-192). But the mechanistic claim — that the lesson-writing process is the intervention — has immediate design implications: if true, we should build structured extraction into every agent's post-session flow, even if the extracted lessons are never replayed.

---

[SIG: orchestrator:H-180:proposed]
