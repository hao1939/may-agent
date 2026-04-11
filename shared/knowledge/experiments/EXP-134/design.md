# EXP-134: Guard Recovery Audit — What Does FM-3.3 Actually Catch?

**Status**: COMPLETED
**Date**: 2026-04-11
**Author**: Bob
**Channel**: Observational (production data analysis)
**Tests**: H-100 (Skill-Guard Divergence), P-100a (guard attempt rates)
**Connected**: EXP-133 (measurement artifact), KE-106 (structural enforcement), KE-136 (guard transfer), CR-339 Priority 1 & 5

---

## Motivation

EXP-133 revealed that the "48% unverified finish rate" in gym was a **100% measurement artifact** — agents were verifying but the transcript-based detector couldn't see it. The production extension confirmed the same: Bob's 27.2% "unverified" rate was **100% false positives**.

This raises a critical question about the **FM-3.3 finish guard** (KE-106), which is the primary evidence for H-100's "guards are permanent" claim:

- KE-106 reports FM-3.3 attempt rate increased from 27% → 70% over 26 days
- But what exactly is the guard catching? If agents are already verifying (as EXP-133 showed), the guard might be catching **parameter formatting failures** (not populating `verification_evidence`), not **verification failures** (actually skipping verification)
- If the guard is catching formatting, not behavior, then H-100's evidence base is weaker than believed

This experiment audits FM-3.3 guard activations in production to determine what the guard is actually catching.

## Research Questions

1. **What fraction of FM-3.3 catches are behavioral (agent skipped verification) vs. formatting (agent verified but didn't populate the parameter)?**
2. **When the guard fires and forces recovery, does the agent perform NEW verification or was verification already present?**
3. **Does the guard's "catch rate increase" (8.7% → 72.5%) reflect agents getting worse, or the guard getting more sensitive to formatting?**
4. **Is the FM-3.3 guard infrastructure (permanent guard) or measurement correction (could be replaced by fixing parameter population)?**

## Hypothesis

**H-EXP134**: A significant fraction (>50%) of FM-3.3 guard activations catch formatting failures, not verification failures. The true behavioral improvement from the guard is smaller than KE-106 reports.

If confirmed: H-100's P(H) should decrease (evidence for "guards are permanent" is weaker). If disconfirmed: H-100's P(H) should increase (guard genuinely catches behavioral failures).

## Method

### Phase 1: Guard Activation Audit (Production Data)

Using `.state/may.db` production data, identify all sessions where the FM-3.3 finish guard fired:

```sql
-- Sessions where guard caught an issue
SELECT sessionId, agent, quality, issues, overall
FROM evaluations 
WHERE issues LIKE '%finish_success_unverified%'
   OR issues LIKE '%no_verification_evidence%'
   OR overall LIKE '%guard%'
```

For each guard activation session:

1. **Read the session JSONL** from `.state/sessions/{sessionId}.jsonl`
2. **Parse the tool call sequence** to find:
   - All `bash` calls (potential test runs)
   - All `read` calls after `edit`/`write` (potential read-back verification)
   - The `finish` call and its parameters
   - Any guard interception messages
3. **Classify the guard activation**:
   - **True positive (behavioral)**: Agent genuinely skipped verification before finish
   - **False positive (formatting)**: Agent verified but didn't populate `verification_evidence`
   - **Ambiguous**: Cannot determine from transcript

### Phase 2: Recovery Behavior Analysis

For sessions where the guard fired AND the agent performed recovery:

1. **Was the recovery action new?** Did the agent run tests AFTER the guard, that it hadn't run BEFORE?
2. **Was the recovery redundant?** Did the agent re-run tests it had already passed?
3. **Did recovery change the outcome?** Was the final deliverable different after recovery?

### Phase 3: Temporal Analysis

Plot FM-3.3 activation patterns over time:

1. **Guard activation rate by week** — is it truly increasing?
2. **True positive rate by week** — are BEHAVIORAL catches increasing, or just formatting catches?
3. **Agent-specific patterns** — do some agents have higher true-positive rates?

### Phase 4: Counterfactual Estimation

For each true-positive guard activation:
- **What would have happened without the guard?** (Would the session have failed?)
- **What's the quality delta?** (How much quality does the guard truly add?)

Compare this to KE-136's claimed +15.8pp fleet-wide improvement.

## Predictions

### If H-EXP134 is correct (>50% are formatting catches):
- KE-106's "increasing attempt rate" is an artifact of detection sensitivity, not behavioral degradation
- The real quality improvement from FM-3.3 is <8pp (less than half of KE-136's +15.8pp)
- H-100 P(H) should decrease to ~0.45 (evidence for permanent guards weakened)
- Recommendation: Fix parameter population in agent prompts/instructions instead of running a guard

### If H-EXP134 is wrong (<50% are formatting catches):
- FM-3.3 genuinely catches behavioral verification failures
- H-100 P(H) should increase to ~0.70 (guard permanence confirmed with clean data)
- The guard is genuine infrastructure, not a workaround for a measurement problem

## Data Requirements

- `.state/may.db` — evaluations table with quality scores and issues
- `.state/sessions/*.jsonl` — session transcripts with tool call sequences
- FM-3.3 guard activation logs (if stored separately)

## Execution Plan

1. **Write analysis script** (`agents/bob/workspace/exp134-analysis.ts`) that:
   - Queries evaluations for guard-related sessions
   - Parses session JSONLs for verification behavior
   - Classifies each activation as true/false positive
   - Generates summary statistics

2. **Run analysis** on production data
3. **Write results** with classification breakdown, temporal trends, and H-100 implications

## Success Criteria

- [ ] ≥30 guard activation sessions analyzed (sufficient sample)
- [ ] Each activation classified as true-positive, false-positive, or ambiguous
- [ ] Temporal trend computed (is true-positive rate changing?)
- [ ] H-100 probability updated based on findings
- [ ] Clear recommendation on guard vs. parameter-fix approach

## Risks and Limitations

1. **Session JSONL availability**: Not all sessions may have retained transcripts
2. **Guard activation logging**: FM-3.3 may not log which specific check triggered
3. **Small sample**: If few guard activations exist, statistical power is limited
4. **Ambiguous cases**: Some sessions may not be cleanly classifiable

## Why This Over Alternatives

| Alternative | Why Not |
|------------|---------|
| P-100c Guard Removal (disable FM-3.3) | Risky in production, needs Hao approval, can't do without system access |
| P-100b New Skill Internalization | Requires deploying a new content intervention and waiting 7 days |
| New gym scenario | EXP-133 showed gym measurement is unreliable for verification |
| H-096 Evaluation Architecture | Requires building new evaluation infrastructure (checkpoint decomposition) |

**This experiment is purely observational** — it requires only data analysis, no production changes, no gym runs, no waiting periods. It can be completed in a single session and directly addresses both CR-339 Priority 1 (evaluation methodology) and Priority 5 (skill vs guard).

## Expected Outcomes and Knowledge Updates

### If >50% false positive:
- New KE: "FM-3.3 Guard Catches Formatting, Not Behavior" 
- Update KE-106: Revise "structural enforcement has no training effect" to note measurement confound
- Update KE-136: Revise +15.8pp fleet-wide claim with corrected estimate
- Update H-100: Lower P(H) — the "permanent guard" evidence is contaminated

### If <50% false positive:
- New KE: "FM-3.3 Guard Confirmed Behavioral" — clean evidence that verification IS skipped
- Strengthen KE-106 and KE-136 findings
- Update H-100: Raise P(H) — guard permanence confirmed with clean measurement

### Either way:
- New methodological insight about production evaluation measurement
- Foundation for improved evaluation methodology (CR-339 Priority 1)
- Clear next step for H-100 testing (either fix measurement or test P-100c)

## Tags
`evaluation-methodology`, `measurement-validation`, `guard-analysis`, `H-100`, `FM-3.3`, `production-data`, `observational`
