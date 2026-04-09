# EXP-101: HVR (Hedge-to-Verify Ratio) Validation on Agent Session Logs

**Date**: 2026-04-09
**Status**: COMPLETED
**Hypothesis**: H-094 (P(H)=0.45) — HVR as Zero-Cost Agent Confidence Gate
**Connected**: H-093 (CIVC), KE-068 (SELFDOUBT findings), DD-656 (SELFDOUBT paper)
**Budget**: ~$0 (retrospective analysis of existing session data) + optional ~$2-3 for new gym validation runs
**Author**: Bob

## Motivation

KE-068/DD-656 (SELFDOUBT, COLM 2026) showed that reasoning traces with zero hedging markers are correct 96.1% of the time across structured benchmarks. H-094 proposes applying this as a zero-cost confidence gate for agent outputs. But the 96% figure comes from clean benchmark settings (BBH, GPQA, MMLU-Pro) — not messy, multi-step agent workflows. EXP-101 tests whether HVR predicts agent output correctness on our actual system data.

## Research Questions

1. **RQ1**: Do zero-hedge agent traces correlate with session success in our system?
2. **RQ2**: Does the HVR score (hedges / (verifies + 1)) predict session quality better than random?
3. **RQ3**: What is the coverage of zero-hedge traces (% of sessions with no hedging)?
4. **RQ4**: Can HVR serve as an early-warning signal for FM-3.3 verification collapse?

## Data Sources

### Primary: Session Traces (`.state/sessions/*/session.jsonl`)
- **1,435 sessions** with full conversation traces (session.jsonl files)
- **Agent distribution**: Bob (267), Coach (267), Evaluator (179), Tech-Lead (149), Optimizer (140), May (127), Scout (124), QA (124), Amy-Kimi (55), Coder (4)
- Each session.jsonl contains alternating user/assistant messages with full reasoning text
- Meta.json provides: agent, task, status (done/error/etc), opCount, timestamps

### Correctness Labels (Ground Truth)
We need binary correct/incorrect labels. Four complementary sources:

#### Source A: Session Status (available for all 1,435 sessions)
- `meta.json` → `status` field: "done" vs "error"/"timeout"/"cancelled"
- **Limitation**: Coarse. "Done" doesn't mean correct. But "error" is reliably incorrect.
- **Use**: Baseline label. Low precision for "correct" but high recall for "incorrect."

#### Source B: Evaluation JSON Files (`.state/evaluations/*.json`)
- Structured evaluations with quality scores (0-1), efficiency scores, verdicts ("good"/"needs_improvement"/"poor"), and specific FM error classifications
- **Strength**: FM-3.3 labels directly available — exactly what H-093/H-094 predict
- **Limitation**: Not all sessions have evaluations. Need to count coverage.

#### Source C: Gym Run Check-Level Results
- Gym runs have binary pass/fail per check. Some sessions are linked to gym runs via `session_id` in gym_runs table.
- **Strength**: Most objective correctness measure (automated checks).
- **Limitation**: Only gym sessions, not production sessions.

#### Source D: Convention Check Data (`.state/convention-checks/`)
- Per-session convention pass rates.
- **Use**: Secondary quality signal, not primary correctness label.

### Recommended Label Strategy
- **Tier 1 (highest confidence)**: Evaluation verdicts where available. Score quality ≥ 0.7 = "correct", quality < 0.4 = "incorrect", 0.4-0.7 = ambiguous (exclude from primary analysis).
- **Tier 2**: Session status "error"/"timeout" = incorrect, "done" = candidate correct (use with Tier 1 when available).
- **Tier 3**: Convention check pass rate > 90% = likely correct, < 50% = likely incorrect.

## Hedging Marker Detection

### Regex Patterns (adapted from DD-656's methodology for agent context)

#### Hedging Markers (doubt/uncertainty)
```
HEDGE_PATTERNS = [
  /\bmaybe\b/i,
  /\bperhaps\b/i,
  /\bpossibly\b/i,
  /\bnot sure\b/i,
  /\bnot certain\b/i,
  /\bI think\b/i,           # weak assertion
  /\bI believe\b/i,         # weak assertion
  /\bmight be\b/i,
  /\bcould be\b/i,
  /\balternatively\b/i,
  /\bon the other hand\b/i,
  /\bI'm not confident\b/i,
  /\bunclear\b/i,
  /\bI'm unsure\b/i,
  /\bhard to say\b/i,
  /\bdifficult to determine\b/i,
  /\bwait,?\s/i,            # backtracking signal
  /\bactually,?\s/i,        # self-correction signal
  /\bhmm\b/i,               # deliberation marker
  /\blet me reconsider\b/i,
]
```

#### Verification Markers (checking/confirming)
```
VERIFY_PATTERNS = [
  /\blet me (check|verify|confirm|validate|test)\b/i,
  /\bchecking\b/i,
  /\bconfirming\b/i,
  /\bverif(y|ied|ying)\b/i,
  /\bvalidat(e|ed|ing)\b/i,
  /\blooks correct\b/i,
  /\bmatches\b/i,           # comparison verification
  /\bconsistent with\b/i,
  /\bas expected\b/i,
  /\bconfirmed\b/i,
  /\bI can see that\b/i,    # evidence-based assertion
  /\bthe output shows\b/i,
  /\bthe (test|check|result) (pass|show|confirm)\b/i,
]
```

#### Agent-Specific Calibration Needed
- **Tool-call context**: Agent traces include tool calls and results interspersed with reasoning. Must extract ONLY assistant text (role: "assistant", content type: "text"), not tool outputs.
- **Hedging-in-analysis vs hedging-in-conclusion**: "Maybe the error is in line 5" (analytical) vs "Maybe this is correct" (conclusion uncertainty). May need position-weighted scoring (late-trace hedging more predictive).
- **Length normalization**: Longer sessions will have more absolute markers. Use rates: hedges_per_1000_tokens, verifies_per_1000_tokens.

### HVR Score Computation
```
HVR = hedge_count / (verify_count + 1)
```
- HVR = 0: Zero hedging → high confidence prediction
- HVR < 0.5: More verification than hedging → resolved doubt
- HVR > 1.0: More hedging than verification → unresolved doubt
- HVR > 3.0: Heavy hedging → likely struggling

## Experimental Design

### Phase 1: Retrospective Analysis (Cost: $0)

**Step 1: Data Extraction** (~30 min compute)
For each of the 1,435 sessions:
1. Parse `session.jsonl` — extract all assistant-role text content
2. Count hedge markers, verify markers across full session
3. Compute: hedge_count, verify_count, HVR, tokens_total, hedge_rate, verify_rate
4. Extract label from meta.json (status) + evaluation JSON (quality, verdict, FM errors)
5. Store as structured CSV/JSON

**Step 2: Zero-Hedge Gate Analysis**
- Partition sessions into: zero-hedge (hedge_count = 0) vs has-hedge (hedge_count > 0)
- Compare correctness rates between groups
- Report: precision of zero-hedge gate, coverage (% zero-hedge), specificity
- **Primary metric**: Precision of zero-hedge gate (target: >90% to be useful)
- **SELFDOUBT baseline**: 96.1% precision, 25.4% coverage

**Step 3: HVR Discrimination Analysis**
- Compute AUROC of HVR score vs binary correctness label
- Compute calibration curve (HVR buckets vs actual correctness %)
- Compare against: (a) random baseline (AUROC=0.5), (b) session length alone, (c) opCount alone
- **Primary metric**: AUROC > 0.60 (meaningful discrimination), target > 0.70

**Step 4: FM-3.3 Prediction (H-093 Connection)**
- For sessions with evaluation data containing FM error classifications:
  - Do sessions with FM-3.3 (verification failure) show higher HVR than sessions without?
  - Does hedging increase in the turns BEFORE FM-3.3 manifests? (temporal analysis)
  - Does HVR outperform opCount as FM-3.3 predictor?

**Step 5: Agent-Level Analysis**
- Break down all metrics by agent
- Which agents show strongest HVR-correctness correlation?
- Hypothesis: Bob/Coach (complex reasoning) show stronger signal than Scout/QA (simpler tasks)

### Phase 2: Prospective Gym Validation (Cost: ~$2-3, optional)

If Phase 1 shows AUROC > 0.60:
1. Select 5 gym scenarios with known pass/fail rates (~50% baseline)
2. Run N=3 each = 15 gym runs
3. Compute HVR on each run's trace
4. Test: Does HVR predict pass/fail for individual gym runs?

This provides the cleanest correctness label (automated scorer) on fresh data.

## Sample Size & Statistical Power

### Phase 1
- **N = 1,435 sessions** — more than adequate for AUROC estimation
- For precision estimation: if zero-hedge gate covers 25% of sessions (≈359 sessions), 95% CI on precision is ±2.5pp (Clopper-Pearson)
- For AUROC: N=1000+ gives 95% CI width of ≈0.03, easily distinguishes AUROC 0.60 from 0.50
- **Even if evaluation coverage is only 30%**: N≈430 sessions with quality labels → 95% CI on AUROC ≈ ±0.05, still sufficient

### Phase 2
- **N = 15 gym runs** — underpowered for standalone significance
- Purpose: directional validation only. Significant finding would require N≥40 (80% power at α=0.05 for AUROC 0.70 vs 0.50)
- If Phase 2 is promising, expand to N=40 at ~$5-8

## Null Hypothesis & Bayesian Updates

### H₀ (Null)
HVR is not predictive of agent output correctness. Zero-hedge traces have the same correctness rate as all traces. AUROC = 0.50.

### H₁ (Alternative, = H-094)
HVR discriminates agent output correctness. Zero-hedge precision > 90%. AUROC > 0.60.

### P(H) Update Rules

| Outcome | Evidence | P(H-094) Update |
|---------|----------|-----------------|
| Zero-hedge precision ≥ 95% AND AUROC ≥ 0.70 | Strong confirmation — matches SELFDOUBT on agent data | 0.45 → **0.75** |
| Zero-hedge precision ≥ 90% AND AUROC ≥ 0.60 | Moderate confirmation — weaker than benchmarks but useful | 0.45 → **0.65** |
| Zero-hedge precision 80-90% OR AUROC 0.55-0.60 | Weak signal — may work with agent-specific calibration | 0.45 → **0.50** |
| Zero-hedge precision < 80% AND AUROC < 0.55 | Disconfirmation — HVR doesn't transfer from benchmarks to agents | 0.45 → **0.25** |
| Insufficient zero-hedge coverage (<5%) | Inconclusive — agent traces may be too hedging-rich for the gate | 0.45 → **0.40** (slight decrease — mechanism may not apply) |

### Cross-Hypothesis Impact
- **H-093**: If HVR predicts FM-3.3, it validates the "verification budget" connection (H-094 → H-093). Would increase H-093 P(H) by +0.05.
- **KE-068**: If zero-hedge precision < 80%, KE-068's applicability claim needs a caveat ("works for benchmarks, not agent workflows").

## Can We Run This Purely From Existing Data?

**Phase 1: YES** — 100% retrospective. All data exists in `.state/sessions/`. No new runs needed.

**Phase 2: Partially** — Needs new gym runs (~$2-3) but only if Phase 1 is promising. Can be delegated to Coach.

### Data Gaps to Acknowledge
1. **Evaluation coverage**: Not all 1,435 sessions have evaluation JSONs. Phase 1 Step 1 must first quantify: how many sessions have quality labels?
2. **FM error classification coverage**: Only sessions that were evaluated have FM codes. May be <50% of sessions.
3. **may.db tables are empty**: Cannot use SQL queries. Must parse .state/ files directly.
4. **No gym run data in DB**: gym_runs table is empty. Gym results exist as files in agents/.lab/ and experiment result docs, not queryable.

## Implementation Plan

### Script Requirements
A single analysis script (Bun/TypeScript or Python) that:
1. Iterates `.state/sessions/*/`
2. Parses `session.jsonl` for assistant text
3. Applies regex marker detection
4. Joins with evaluation data where available
5. Outputs: per-session CSV + aggregate statistics + AUROC computation

### Estimated Effort
- **Phase 1 script**: ~2 hours to write + run
- **Phase 1 analysis**: ~1 hour to interpret
- **Phase 2 gym runs**: ~30 min (if needed, delegated to Coach)
- **Total**: ~3-4 hours

## Falsification Criteria

EXP-101 **disconfirms** H-094 if:
1. Zero-hedge precision < 80% (the gate is not reliable enough to auto-accept)
2. AUROC < 0.55 (HVR is barely better than random at predicting correctness)
3. Zero-hedge coverage < 5% (agents hedge so much the gate never fires)

EXP-101 **confirms** H-094 if:
1. Zero-hedge precision ≥ 90% AND AUROC ≥ 0.60
2. Coverage ≥ 15% (gate fires often enough to matter)
3. At least 2 agents show the pattern (not agent-specific artifact)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Agent traces much noisier than benchmark CoT | Position-weighted scoring (later hedges count more) + length normalization |
| Tool outputs contaminate marker counts | Extract ONLY assistant-role text content |
| "I think" is ubiquitous in polite agent language | Calibrate per-agent: if "I think" is universal, exclude from markers |
| Evaluation coverage too low for meaningful analysis | Fall back to session status (done/error) as coarse label |
| Agent hedging patterns differ from human/benchmark patterns | Build agent-specific marker dictionaries (DD-656 method: 90 calibration traces per agent) |

---
*Designed by Bob | 2026-04-09*
