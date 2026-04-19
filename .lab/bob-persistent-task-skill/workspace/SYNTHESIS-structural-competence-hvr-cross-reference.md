# SYNTHESIS: Structural Competence ↔ HVR Cross-Reference

**Date**: 2026-04-09  
**Sources**: KE-089 (DD-676/677/678 synthesis), EXP-101 Phase 1 results, H-093 (CIVC), H-094 (HVR)  
**Type**: Cross-thread research synthesis

---

## Thread Summaries

### Thread 1: DD-676/677/678 → KE-089 (Structural Verification Competence)
Three papers converge on a single principle: **verification quality is determined by structural reasoning competence — not safety alignment, scale, or LLM flexibility.**

- **DD-676** (TraceSafe-Bench): Structured data competence (JSON parsing, API responses) correlates ρ=0.79 with guardrail effectiveness. Jailbreak robustness ρ≈0. Architecture beats scale.
- **DD-677** (Self-Revising Agent Decomposition): Explicit world-model planning dominates (+24.1pp). LLM revision at ~4.3% of turns is non-monotonic — helps precision, hurts win rate.
- **DD-678** (HAAF + NAAMSE): Evolutionary scenario search finds failure boundaries 3-5× faster than manual design. Scenario manifold parameterization enables systematic CIVC threshold discovery.

**Key insight**: There's a structural competence hierarchy: (1) structured data parsing > (2) explicit planning > (3) belief tracking > (4) LLM revision. Interventions targeting levels 1-2 work; those adding level 4 overhead are harmful.

### Thread 2: EXP-101 Phase 1 → H-094 Update (HVR Weak Signal)
1,259 sessions analyzed across 10 agents. HVR fails as a general discriminator.

- Zero-hedge precision: 96.3% (meets target but = base rate of 96.2%)
- AUROC: 0.535 (fails 0.60 target — barely above random)
- Agents hedge 57.5% zero-hedge rate vs SELFDOUBT's 25.4%
- Most common "hedges" are actually backtracking signals ("actually", "wait"), not uncertainty
- Per-agent: optimizer AUROC 0.716, scout 0.644 — tiny N but promising
- Phase 2 gym validation not justified

---

## Cross-Thread Connections

### Connection 1: DD-676's Structural Bottleneck Explains Why HVR Fails

**The link is strong.** DD-676 shows that verification effectiveness correlates with *structural data competence* (ρ=0.79), not with linguistic signals. HVR is a linguistic signal — it measures hedging words in natural language reasoning traces. EXP-101 confirms that this linguistic approach fails (AUROC 0.535).

The deeper insight: **HVR targets the wrong level of the competence hierarchy.** DD-677's decomposition shows LLM-level signals (level 4 — which includes hedging language) are the *least* predictive of outcome quality. The structural data parsing layer (level 1) is what matters. An agent can hedge extensively while correctly parsing structured data, or output zero hedges while completely failing to track cross-file dependencies.

**Implication**: A "structural confidence gate" based on tool-call patterns (retry counts, error-recovery sequences, verification step skipping) would target the right level. EXP-101's finding that "actually" and "wait" (backtracking markers) carry the most signal — AUROC drops from 0.535 to 0.511 without them — supports this: backtracking is a *structural* behavior (agent revising its approach), not a linguistic one.

### Connection 2: DD-677's Non-Monotonic LLM Revision Illuminates When Hedging Predicts Failure

**The link is moderately strong.** DD-677 finds that LLM revision at ~4.3% of turns is non-monotonic: slightly improves F1 but hurts win rate. EXP-101 finds that hedging (linguistic revision) is near-zero predictive for most agents, but becomes weakly predictive at extreme values (>20 hedges → 11.1% error rate vs 3.7% baseline).

This maps onto DD-677's pattern:
- **Low hedging** (0-5 markers, ~93% of sessions): Agent operating in its structural competence zone. LLM-level uncertainty signals are suppressed by strong explicit planning. Hedging doesn't predict because the agent succeeds via structure, not via self-doubt management.
- **Moderate hedging** (6-20 markers, ~5% of sessions): Non-monotonic zone. Some of this hedging is productive self-correction; some adds noise. Error rate (4.5%) is near baseline — hedging is not discriminative here.
- **Extreme hedging** (>20 markers, ~1.4% of sessions): The agent has exceeded its structural competence threshold. Hedging here signals genuine loss of control — the LLM is "taking over" from the structural planning layer. Error rate jumps to 11.1%.

**Prediction**: The ~4.3% LLM revision rate from DD-677 maps to approximately the >20-hedge threshold in our agents. Below this threshold, hedging is noise. Above it, hedging signals structural competence failure — which IS what H-093 (CIVC) describes.

### Connection 3: Agent-Specific HVR Signal Maps to Structural Task Complexity

EXP-101 found optimizer (AUROC 0.716) and scout (AUROC 0.644) show the strongest HVR signal, while bob (0.520) and coach (0.472) show essentially none. The DD-676/677 framework explains why:

- **Optimizer/Scout**: More focused tasks with clearer structural boundaries. When these agents hedge, it likely signals genuine structural confusion — they've exceeded their competence zone.
- **Bob/Coach**: Complex reasoning tasks where hedging is a *normal* part of the process. DD-677's "symbolic reflection" layer is always active in these agents. Their hedging doesn't discriminate because hedging IS the job.
- **Evaluator** (93.6% zero-hedge, 0.7% error): Near-pure structural agent. Rarely hedges, rarely fails. The structural competence hierarchy predicts this: evaluator tasks are structurally clear (parse output, compare to rubric) so the agent operates almost entirely at levels 1-2.

This directly contradicts the EXP-101 design prediction that "Bob/Coach (complex reasoning) show stronger signal than Scout/QA (simpler tasks)." DD-676 explains the reversal: simpler tasks have cleaner structural boundaries, so crossing them produces a cleaner signal.

---

## Findings Ranked by Impact/Novelty

### Rank 1: Structural Confidence Gate > Linguistic Confidence Gate (HIGH IMPACT, NOVEL)
The cross-reference reveals that HVR was targeting the wrong signal type from the start. A "Structural Hedge-to-Verify Ratio" (S-HVR) measuring tool-call patterns (retries, error recovery, skipped verification steps, file re-reads) would target DD-676's ρ=0.79 structural competence layer instead of the ρ≈0 linguistic layer. This reframes H-094 entirely.

### Rank 2: Non-Monotonic Hedging Threshold (~20 markers) as CIVC Detector (MODERATE IMPACT, NOVEL)
The connection between DD-677's non-monotonic LLM revision and EXP-101's >20-hedge error spike provides a specific, testable threshold for CIVC onset. Below threshold: noise. Above threshold: structural collapse signal. This bridges H-093 and H-094 into a unified detection framework.

### Rank 3: Agent-Complexity Matching Explains Per-Agent HVR Variance (MODERATE IMPACT, CLARIFYING)
The DD-676/677 competence hierarchy explains the per-agent AUROC differences in EXP-101. This isn't just a post-hoc rationalization — it generates the prediction that HVR will work best for agents with narrow structural competence bands (specialist agents) and worst for agents with broad competence bands (generalist agents like bob).

### Rank 4: Adaptive Evaluation Methodology Applies to Both Threads (MODERATE IMPACT, PRACTICAL)
DD-678's HAAF+NAAMSE methodology solves both the EXP-100 ceiling problem AND the EXP-101 label quality problem. Use evolutionary scenario search to find the CIVC boundary (EXP-100 redesign) and simultaneously collect rich FM-classified labels for HVR analysis (EXP-101 RQ4 re-test).

---

## Proposed Next Steps

### Immediate (can prototype now)

1. **Design S-HVR (Structural HVR) metric**: Define tool-call-pattern-based hedging signals:
   - Retry count (same tool called ≥2× with similar args)
   - Error-recovery sequences (tool fails → different tool → retry)
   - Verification step skipping (finish() without prior read-back)
   - File re-read count (reading same file ≥3×)
   - Late-trace tool call density spike
   
   Test S-HVR on the same 1,259 sessions. If AUROC > 0.60, this validates the structural confidence gate hypothesis.

2. **Re-analyze EXP-101 data at >20-hedge threshold**: Specifically test whether sessions with >20 hedges have systematically different structural patterns (more retries, more error recovery, more file re-reads). If yes, the extreme-hedge signal is a proxy for structural competence breakdown.

### Near-term (next experiment cycle)

3. **Design EXP-102: S-HVR Validation**: Same design as EXP-101 but using structural markers. Retrospective analysis on existing sessions. Could reuse the EXP-101 analysis infrastructure.

4. **EXP-100 Redesign using DD-678**: Apply HAAF scenario manifold parameterization to create harder scenarios that trigger CIVC. Use FM-classified evaluation data from harder scenarios to re-test HVR (closing EXP-101 RQ4 gap).

### Longer-term (research direction)

5. **H-095 Proposal**: "Structural Hedge-to-Verify Ratio (S-HVR) as CIVC Early Warning System" — tool-call pattern analysis predicts verification collapse with AUROC ≥ 0.65. This unifies H-093 (what CIVC is), H-094 (how to detect it), and KE-089 (why structural > linguistic).

---

## Impact on Existing Hypotheses

| Hypothesis | Current P(H) | Update | Rationale |
|-----------|-------------|--------|-----------|
| H-093 (CIVC) | 0.75 | **No change** | Neither thread contradicts. EXP-100 ceiling + EXP-101 weak signal are both consistent with CIVC being real but hard to trigger/detect with current tools |
| H-094 (HVR) | 0.50 | **Reframe, not update** | HVR in its linguistic form is likely a dead end. But the *principle* (monitoring agent internal signals for confidence estimation) is supported by DD-676 — it just needs to target structural signals, not linguistic ones |
| H-085 (Externalization) | — | **Strengthened** | DD-677's +24.1pp for explicit planning confirms externalization as the dominant value mechanism |

---

*Cross-reference synthesis by Bob | 2026-04-09 | Session 390*
