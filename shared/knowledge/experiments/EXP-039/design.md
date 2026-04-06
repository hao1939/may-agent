# EXP-039: Informationally Isolated Verification Protocol

**Date**: 2026-04-05
**Author**: Bob (Architect)
**Status**: PHASE B COMPLETE — LLM evaluator shows selective confirmation bias (significant for weak sessions, negligible for good sessions)
**Tests**: H-009 (evaluator rubber stamp), H-001 (adversarial framing)

## Question

Does **informationally isolated verification** — where the verifier cannot see the producer's reasoning, only its outputs — detect more issues than contextual verification where the verifier has full access?

## Background

Three independent evidence streams converge on this design:

### Internal Evidence
- **H-009**: Evaluator is a rubber stamp (90.7% "good"). It sees the agent's `finish()` summary and deliverables — both **produced by the agent to describe its own work**. The evaluator evaluates the agent's self-description, not its actual work.
- **KE-005**: QA detects issues in only 14% of reviews. QA reads the same coder summary the evaluator sees.
- **KE-019**: Materialization gates (0%→100%) work because they create a **written commitment** that's structurally separate from the action. The commitment can be evaluated independently.

### External Evidence
- **DD-532 (EvoSkills)**: Informationally isolated Surrogate Verifier outperforms contextual verification. Key mechanism: *information isolation prevents confirmation bias*. The verifier can't be fooled by the generator's reasoning because it never sees it.
- **DD-528 (SEVerA)**: Formal output contracts work because they evaluate outputs against specifications, not against the producer's intent.
- **Process-critics synthesis**: Outcome critics fail because agents learn to produce outcome patterns (good summaries) without producing good outcomes.

### The Core Problem

Our current verification pipeline passes the producer's **self-description** to the verifier:

```
Producer → {code + summary + deliverables + evidence} → Verifier
```

The summary, deliverables, and evidence fields are **agent-authored narratives about its own work**. They create a confirmation frame: the verifier reads "I did X, here's evidence Y" and evaluates whether the narrative is coherent, not whether X was actually done or Y is actually evidence.

EvoSkills proves this is a general phenomenon: when a verifier has access to the producer's reasoning, it inherits the producer's biases.

## Design

### Protocol: Isolated Verification

Strip the agent's self-description from the verification input. Give the verifier ONLY:
1. The **task specification** (what was requested)
2. The **output artifacts** (files modified, code written)
3. The **tool execution log** (what commands were run, what they returned)

Do NOT give the verifier:
- The agent's summary
- The agent's claimed deliverables
- The agent's self-reported evidence
- The agent's reasoning or planning

### Concrete Implementation

**Phase A: Controlled Comparison (Gym)**

Use a gym scenario with known bugs (e.g., `qa-evidence-discipline`):

| Condition | Verifier Input | N |
|-----------|---------------|---|
| **Control** (current) | Full session output including agent summary, deliverables, evidence | 10 |
| **Isolated** (treatment) | Task spec + modified files + tool log ONLY (no agent narrative) | 10 |

Both conditions use the same verifier prompt (evaluator heuristic). The only difference is what information the verifier receives.

**Measure**: 
- Issue detection rate (% of reviews finding ≥1 planted bug)
- False positive rate
- Verdict distribution (does isolation break the 90.7% "good" pattern?)

**Phase B: Evaluator Redesign**

If Phase A confirms isolation helps, redesign the production evaluator:

1. **Step 1**: Evaluator receives task description + file diffs + test results
2. **Step 2**: Evaluator independently assesses whether the task was accomplished
3. **Step 3**: Compare evaluator's independent assessment against agent's self-report
4. **Step 4**: Discrepancies trigger deeper review

### Predictions

**P-A1** (Strong): Isolated verification will detect ≥2x more issues than contextual verification in the gym scenario.
*Basis*: EvoSkills showed information isolation is the primary mechanism. Our 90.7% rubber stamp rate leaves enormous room for improvement.

**P-A2** (Moderate): Isolated verification will produce a wider verdict distribution (breaking the "everything is good" pattern).
*Basis*: Without the agent's optimistic self-description, the verifier must form its own judgment from raw artifacts.

**P-A3** (Weak): False positive rate will increase slightly (<2x) in isolated condition.
*Basis*: Some agent context is genuinely useful (e.g., "I intentionally didn't change X because..."). Isolation removes this signal.

### Controls

- Same verifier model and prompt for both conditions
- Same gym scenario and planted bugs
- Randomized order of conditions
- Blind: verifier doesn't know which condition it's in (both get structured input, just different fields)

## Connection to Existing Work

| Existing | How EXP-039 Extends It |
|----------|----------------------|
| EXP-036 (H-009 Phase 1 fix) | EXP-036 improved the evaluator's scoring logic. EXP-039 changes what information reaches the evaluator — a more fundamental intervention. |
| EXP-038 (adversarial QA) | EXP-038 changes the verifier's framing. EXP-039 changes the verifier's information. Orthogonal interventions — could be combined. |
| H-009 Phase 2 (semantic signals) | Phase 2 added heuristic detection of hollow summaries. EXP-039 removes summaries entirely — doesn't try to detect hollow ones, just doesn't pass them. |

## Success Criteria

1. Phase A shows statistically significant improvement in issue detection (p<0.05 or ≥2x effect size with N=10)
2. Verdict distribution in isolated condition has entropy >1.0 (vs ~0.3 in current rubber stamp distribution)
3. Protocol is implementable in production evaluator without breaking existing workflow

## Risk Assessment

- **Risk**: Isolation removes genuinely useful context, making the verifier worse at understanding complex tasks.
  **Mitigation**: Phase A is controlled. If isolated verification is worse, we don't deploy.

- **Risk**: Verifier without context produces many false positives, creating alert fatigue.
  **Mitigation**: Track false positive rate explicitly. If >30%, the protocol needs context back for specific categories.

- **Risk**: Agents learn to encode their narrative in code comments or file names, circumventing isolation.
  **Mitigation**: This is a longer-term concern. For Phase A, it's not an issue (gym scenarios are one-shot).

## Files

- This design: `agents/shared/knowledge/experiments/EXP-039/design.md`
- Depends on: Gym scenario `qa-evidence-discipline`
- Implementation: `src/lib/evaluator.ts` (`formatIsolatedTranscript`)
- Tests: `test/evaluator-isolated-transcript.test.ts` (14 tests)
- Comparison tool: `scripts/exp039-compare-transcripts.ts`
- Heuristic comparison: `scripts/exp039-heuristic-comparison.ts`
- Will produce: Results in `EXP-039/results.md`

## Phase A Results (2026-04-06)

### Heuristic Evaluator Baseline

Ran the heuristic evaluator under both conditions (contextual vs isolated) on 19 real production sessions.

**Result: No meaningful difference in heuristic evaluator scores.**

| Metric | Contextual | Isolated | Delta |
|--------|-----------|----------|-------|
| Avg Quality | 4.84 | 4.89 | +0.05 |
| Avg Efficiency | 3.95 | 3.95 | 0.00 |
| Verdict changes | — | — | 0/19 (0%) |
| Quality drops | — | — | 0 |
| Quality gains | — | — | 1 |

**Interpretation**: The heuristic evaluator is NOT where self-narrative bias lives. It scores primarily on structural signals (tool call counts, session status, finish() presence). Removing agent self-narrative changes almost nothing because the heuristic evaluator barely reads it.

**This confirms H-009**: The rubber-stamp problem is in the overall evaluation pipeline, not specifically in the heuristic scoring rules. The heuristic evaluator gives "good" to nearly all sessions because most sessions have: done status + finish() + tool calls. The LLM evaluator, which reads natural language, is the likely carrier of confirmation bias.

### What Was Built

1. **`formatIsolatedTranscript()`** in `src/lib/evaluator.ts` — exported function that strips agent self-narratives from session transcripts
2. **14 unit tests** covering: first-user-only, reasoning stripping, thinking block removal, tool call preservation, tool result preservation, finish() sanitization, long transcript truncation, mixed content, edge cases
3. **Comparison tool** (`scripts/exp039-compare-transcripts.ts`) — shows side-by-side transcript formatting
4. **Heuristic comparison** (`scripts/exp039-heuristic-comparison.ts`) — runs both conditions on production sessions

### Key Insight: Where the Bias Is

The transcript reduction from isolation is only 4-8% by size, but the critical removed content is:
- Agent reasoning ("I think this is a null pointer issue")
- Agent self-assessment in finish() ("I successfully implemented the feature")
- Agent verification claims ("Step 5: bash showed all tests pass")

These are the exact elements that create the **confirmation frame** described in the design. The LLM evaluator reads these narratives and is likely anchored by them. The heuristic evaluator doesn't read them, so isolation doesn't help there.

### Next Step: Phase B

Phase B should focus on the **LLM evaluator** (the one that actually reads transcripts):
1. Run gym scenarios with the LLM evaluator using both transcript formats
2. Compare issue detection rates and verdict distributions
3. If isolated evaluation improves detection, integrate into production evaluation pipeline

## Phase B Results (2026-04-06)

### LLM Evaluator Comparison

Ran the LLM evaluator (GPT-5.2) under both conditions (contextual vs isolated) on 4 real production task trees. Each tree was evaluated independently with both transcript formats using the same system prompt and temperature (0.1).

**Methodology**:
- Generated evaluation prompts with `scripts/exp039-phase-b.ts` (prompt generator)
- Ran both conditions through direct LLM API calls with `scripts/exp039-phase-b-run.ts`
- Used identical system prompts; only difference is whether agent self-narrative is present
- Inter-run variance measured: ~0.02-0.03 for identical prompts (establishes noise floor)

### Per-Tree Results

| Tree | Agent | Existing Q | Contextual Q | Isolated Q | Δ Quality | Verdict Change? |
|------|-------|-----------|-------------|-----------|-----------|-----------------|
| s_1775311714523_3 | bob | 0.90 | 0.85 | 0.84 | **-0.01** | same (good→good) |
| s_1775027473437_123 | tech-lead | 0.86 | 0.84 | 0.84 | **0.00** | same (good→good) |
| s_1775120777756_105 | coach | 0.45 | 0.58 | 0.48 | **-0.10** | **CHANGED** (acceptable→needs_improvement) |
| s_1775379976263_141 | coach | 0.50 | 0.78 | 0.78 | **0.00** | same (good→good) |

### Aggregate

| Metric | Value |
|--------|-------|
| Avg quality delta | **-0.027** |
| Avg efficiency delta | +0.015 |
| Verdict changes | **1/4 (25%)** |
| Quality drops (>0.05) | 1 |
| Quality gains (>0.05) | 0 |

### Key Finding: Selective Confirmation Bias

**The LLM evaluator shows confirmation bias, but ONLY for lower-quality sessions.**

- **Good sessions** (bob Q=0.90, tech-lead Q=0.86): Virtually zero difference between contextual and isolated evaluation. These sessions have strong structural evidence (code written, tests passing, files created) that doesn't depend on agent self-narrative.

- **Lower-quality sessions** (coach Q=0.45): The one session with genuine execution failures showed a **Q delta of -0.10 and a verdict change** (acceptable → needs_improvement). When the evaluator can see the agent's reasoning and explanations, it gives the benefit of the doubt. Without that narrative, it sees only the raw execution evidence and scores lower.

This pattern is exactly what the DD-532 (EvoSkills) paper predicts: **confirmation bias from self-narrative is strongest when the output quality is ambiguous**. Good work speaks for itself; mediocre work benefits from explanation.

### Inter-Run Variance

An important methodological note: running the same prompt twice on the same model yields Q differences of ~0.02-0.03. This means:
- The -0.01 deltas for good sessions are **within noise** (NOT significant)
- The -0.10 delta for the coach session is **3-5x above noise** (likely significant but sample size = 1)

### Isolated Evaluation Also Found More Specific Issues

In every sample, the isolated evaluation produced **more detailed and structurally grounded issues**:
- Without agent narrative, the evaluator can't rely on "agent says it was checked" and must verify from tool outputs
- Issues found include: weak verification proxies (grep counts ≠ real verification), incomplete evidence, truncated commands

### Prediction Assessment

| Prediction | Result |
|-----------|--------|
| P-A1: Isolated detects ≥2x more issues | **PARTIALLY SUPPORTED** — isolated found more specific issues in qualitative analysis, but overall scores barely changed for good sessions |
| P-A2: Wider verdict distribution | **WEAKLY SUPPORTED** — 1/4 verdict changes, and it was in the "right" direction (catching a weak session) |
| P-A3: False positives increase slightly | **NOT OBSERVED** — no cases where isolated scored worse AND was clearly wrong |

### Implications for Production

1. **Isolated evaluation is most valuable for lower-quality sessions** where agent narrative masks execution failures
2. **For high-quality sessions, it adds no value** — the overhead of running isolated evaluation isn't justified when work speaks for itself
3. **A hybrid approach** could be effective: run contextual evaluation first, then trigger isolated evaluation ONLY for sessions scoring below 0.6 (as a "second opinion")

### Limitations

- Small sample (N=4 trees, only 1 showed significant difference)
- The 3 coach-heavy trees had very large prompts (>100K chars), potentially affecting LLM attention patterns
- No gym scenarios with planted bugs (would give cleaner signal)
- Same model for both conditions (a different model might be more/less susceptible to self-narrative)

### Files Added

- `scripts/exp039-phase-b.ts` — prompt generator (builds contextual and isolated prompts from session data)
- `scripts/exp039-phase-b-run.ts` — direct LLM comparison runner
- `agents/shared/knowledge/experiments/EXP-039/phase-b-prompts/` — generated prompt files
- `agents/shared/knowledge/experiments/EXP-039/phase-b-results.jsonl` — raw results
