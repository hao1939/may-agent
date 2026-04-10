# CR#328: Production Reality Meets External Theory — EXP-109/110 Convergence Synthesis

**Cross-Reference ID**: CR-328
**Date**: 2026-04-10 (Session 419)
**Scope**: Connecting our production observation findings (EXP-109, EXP-110) to external literature on verification collapse, cascade prevention, behavioral failure detection, and production evaluation
**Related**: EXP-109, EXP-110, KE-112, KE-113, H-092, H-093, H-095, CR#318, CR#320, CR#326, CR#327, DD#670-673, DD#682-684, DD#710-716

---

## Summary

Two landmark production studies — EXP-109 (19K-evaluation quality analysis) and EXP-110 (commit guard impact) — have produced the first empirical picture of our system in production. This cross-reference maps every major production finding to external literature, revealing three convergence zones: (1) the guard-as-recovery mechanism validates cascade prevention theory, (2) agent-specific failure fingerprints align with behavioral anomaly detection research, and (3) the "confident failure" phenomenon connects to overconfidence and calibration literature. The synthesis exposes one critical gap: no external system has solved the superficial verification problem (35% residual unrecovered FM-3.3).

---

## Finding-by-Finding External Mapping

### F1: Guard as Recovery, Not Prevention (EXP-110)

**Internal**: FM-3.3 occurrence +20.9pp but recovery +51.3pp. Guard doesn't prevent verification failure — it catches the attempt and forces re-verification. Seatbelt, not accident prevention.

**External convergence**:
- **VeriGUI TVAE (DD#673, 2604.05477)**: The Think-Verify-Act-Expect cycle is structurally identical to our guard mechanism — both insert a mandatory verification checkpoint before action commitment. TVAE prevents error accumulation not by eliminating errors but by catching them before they propagate. Our guard operates at the `finish()` boundary; TVAE operates at every action step.
- **CTHA Typed Contracts (DD#672, 2601.10738)**: Authority constraints reduced cascading failures 47% — same mechanism as our guard: structural enforcement at decision boundaries. CTHA shows this works across multi-agent chains, not just single-agent finish calls.
- **Sherlock Selective Verification (DD#689, 2511.00330)**: Speculative execution with verification gates. The insight matches: verify at commitment points, not throughout. Sherlock's +18.3% accuracy, −48.7% latency shows verification gates can be efficient.

**Key insight**: Our commit guard accidentally implements the "verification checkpoint at commitment boundary" pattern that three independent research groups have validated. This is not coincidental — it reflects a fundamental principle: **recovery is cheaper and more reliable than prevention** for verification failures in LLM agents.

**Unexplained gap**: VeriGUI and CTHA operate at every action step; our guard only at `finish()`. The 35% residual unrecovered FM-3.3 may reflect this single-checkpoint limitation. TVAE's per-action verification could address the residual.

---

### F2: Residual Superficial Verification (35% Unrecovered)

**Internal**: 12/34 post-guard FM-3.3 remain unrecovered. Agent calls verification tools but doesn't verify the right thing — reads existing files instead of confirming changes, produces evidence referencing non-existent transcript steps.

**External convergence**:
- **Structure Snowballing (DD#671, 2604.06066)**: The "alignment tax" — structural constraints consume reasoning capacity, leading to perfect form with empty substance. Superficial verification is exactly this: the agent produces verification *form* (tool calls, output) without verification *substance* (correct checks). The guard's structural constraint may itself contribute to superficial compliance.
- **Design-Aware Issue Resolution (DD#710, 2604.05955)**: 50% of test-passing solutions fail design criteria. Negligible association between test pass rate and design satisfaction. This is the SAME phenomenon at the task level: metrics can pass while the underlying quality fails. Our superficial verification = their test-passing-but-design-failing.
- **Process Verification / Right-for-Wrong-Reasons (DD#688, 2601.00513)**: 50-69% of correct answers use broken reasoning chains. This maps directly: the agent produces the correct verification *output* via broken verification *process*.
- **SWE-PRM Process Reward Model (DD#682, 2509.02360)**: Taxonomy-guided step-level feedback catches exactly these process failures. SWE-PRM's +10.6pp improvement comes from evaluating reasoning process, not just outcome.

**Key insight**: Superficial verification is the **production manifestation of the verification collapse** theorized in H-093 and validated by DD#688/710/671. The guard solves the first layer (presence of verification) but not the second layer (quality of verification). External literature converges on the answer: **process-level evaluation** (SWE-PRM style) is needed to close the gap.

**RECOMMEND (Bob/Tech-lead)**: The 35% residual is addressable. Two approaches from external lit:
1. **Semantic check injection**: Instead of just blocking `finish()`, inject specific checks the agent must pass — e.g., "diff the file before and after your edit" (from SWE-PRM taxonomy-guided approach)
2. **Per-action TVAE**: Extend guard from finish-only to per-action verification expectations (from DD#673). Higher overhead but closes the form-substance gap.

---

### F3: Agent-Specific Failure Fingerprints (EXP-109)

**Internal**: Bob→FM-3.3 (verification skipping), Coach→FM-2.1 (scope creep), May→FM-2.6 (tool misuse). Distinct failure modes per agent. 12× variation in FM-3.3 susceptibility (Scout 6% vs Optimizer 73%).

**External convergence**:
- **Agent Psychometrics (DD#683 reference, 2604.00594)**: Item Response Theory (IRT) applied to agents — decomposes agent capability into multiple independent dimensions. This is exactly what EXP-109 found: agents have distinct capability profiles, not uniform quality levels. IRT would formalize our FM fingerprints as agent ability parameters.
- **Beyond Resolution Rates (DD#708, 2604.02547)**: 9,374 trajectories across 19 agents. Behavioral patterns predict success, not instruction compliance. This validates H-095: the right intervention must match the behavioral pattern, not the generic instruction.
- **RIFT Reordering (DD#706, 2601.18924)**: 72% accuracy drop from prompt reordering alone proves agent behavior is structurally determined, not content-determined. Agent-specific failures arise from structural niche (architect vs implementer vs analyst), not from varying instruction quality.
- **Claw-Eval Trajectory Analysis (DD#714, 2604.06132)**: 44% of safety violations missed by final-output-only evaluation. Agent-specific failures are invisible without trajectory-level analysis — which is exactly what EXP-109 provides.

**Key insight**: Agent-specific failure fingerprints are a natural consequence of agents operating in different structural niches. The external literature validates this as general, not idiosyncratic. H-095 (agent-specific interventions > universal) aligns with the universal finding that behavioral structure, not content, determines agent performance.

---

### F4: "Confident Failure" Quadrant (EXP-109 Finding F2)

**Internal**: 14.6% of sessions are "efficiently bad" — low cost, poor quality, 49% FM rate. Agents produce confident failures. This is novel and underexplored externally.

**External convergence (partial)**:
- **SELFDOUBT (DD#656, earlier)**: Designed to elicit uncertainty signals. But EXP-101 showed agents DON'T hedge like humans (57.5% zero-hedge rate). This explains confident failure: the mechanism that would surface uncertainty (hedging/hesitation) is absent in LLM agents.
- **Springdrift "Artificial Retainer" (DD#715, 2604.04660)**: 23-day field deployment showed session isolation prevents behavioral learning across sessions. Each session starts fresh, meaning past confident failures don't calibrate future confidence. The retainer concept (persistent behavioral memory) would enable confidence calibration over time.
- **Spectral Kill Switches (DD#669, 2511.05804)**: Pre-generation circuit breaker via attention spectral analysis. Could detect the neural signatures of "confident failure" before output generation — but operates at the weights level, not the behavioral level.
- **Trajectory Guard Siamese RAE (DD#682, 2601.00516)**: Real-time trajectory anomaly detection (F1 0.88-0.94, 32ms). Could detect "efficient but bad" patterns (low tool usage, high confidence, missing verification steps) as trajectory-level anomalies.

**Key insight**: "Confident failure" is an underexplored phenomenon in the external literature. Most work assumes failure comes with uncertainty signals. Our EXP-101 and EXP-109 F2 together show that **LLM agents fail without warning signals**. This makes behavioral/trajectory monitoring (DD#682 Trajectory Guard approach) more important than linguistic confidence detection for production systems.

**RECOMMEND (Scout follow-up)**: "Confident failure" literature search — specifically: miscalibration in LLM agents, overconfidence without linguistic signals, silent failure detection. This may be a novel contribution opportunity.

---

### F5: Cost-Quality Decorrelation (EXP-109)

**Internal**: Spending more (longer sessions, more tool calls) does not predict higher quality. Sessions in the "expensive but bad" quadrant suggest effort is misallocated, not insufficient.

**External convergence**:
- **DOVA Deliberation Budget (DD#702, 2603.13327)**: 6-tier budget allocation based on task complexity. DOVA shows that budget matters only when allocated correctly — undifferentiated spending (our current approach) is wasteful.
- **Task-Aware Delegation (DD#704, 2603.11011)**: Tie-rate risk cues for budget optimization. When task difficulty exceeds agent ability, more budget is wasted. The right response is escalation, not persistence.
- **Martingale Analysis (DD#684 reference, 2602.13320)**: O(√T) error bounds imply diminishing returns from additional steps. After ~9 steps, re-grounding is more effective than continued execution. This provides theoretical backing for cost-quality decorrelation: past a threshold, more steps = more drift, not more quality.

**Key insight**: Cost-quality decorrelation is predicted by the theoretical literature. The fix is not "work harder" but "work differently" — budget-aware allocation (DOVA), complexity-triggered escalation (Task-Aware), and periodic re-grounding (Martingale). H-095's agent-specific approach could include agent-specific budget profiles.

---

### F6: FM-3.3 as Terminal Cascade Attractor (EXP-099/109)

**Internal**: FM-3.3 is terminal in cascade chains — once verification fails, other failures pile up. Verification gravity well (EXP-099: 20.3% of errors in FM-3.3 attractor). FM co-occurrence clustering confirms FM-3.3 as cascade terminus.

**External convergence**:
- **AgentErrorTaxonomy (DD#668, 2509.25370)**: First systematic taxonomy of cascading failures maps directly to EXP-099 archetypes. Their "error propagation chains" formalization matches our cascade archetypes (Tool Spiral, Comprehension Cascade, Drift-to-Decay).
- **MASC Step-Level Anomaly Detection (DD#667, 2510.14319)**: Prevents cascading errors via real-time step-level correction. The anomaly detection could catch the first link in the cascade chain before FM-3.3 attractor is reached.
- **HGR Cascade Retraction (DD#670, 2604.04108)**: Hypothesis-based memory with dependency tracking enables graph contraction when errors are detected. 20% node pruning, 4.5× fewer revisits. Would enable "undo" when cascade is detected mid-chain.
- **COCO Continuous Oversight (DD#690, 2508.13815)**: Async monitoring with contextual rollback. Specifically designed for catching cascading failures before they become terminal.

**Key insight**: The FM-3.3 terminal attractor is the production manifestation of the error cascade theory from DD#667-670. Our guard addresses the terminal node (finish-time recovery) but not the cascade chain leading to it. The external literature points to earlier intervention: step-level anomaly detection (MASC), hypothesis memory (HGR), and async monitoring (COCO) could catch cascades before they reach the FM-3.3 attractor.

---

## Convergence Map

```
PRODUCTION FINDING          EXTERNAL VALIDATION              GAP/NEXT STEP
─────────────────────────────────────────────────────────────────────────────
Guard = recovery           VeriGUI (DD#673), CTHA (DD#672),   Per-action TVAE
  (EXP-110 F1)            Sherlock (DD#689)                   extension

Superficial verification   Snowballing (DD#671), Design-      Process-level
  (EXP-110 F3, 35%)       Aware (DD#710), SWE-PRM (DD#682)   evaluation

Agent-specific FMs         IRT/Psychometrics, Beyond Res.     Formalize FM
  (EXP-109 H3)            Rates (DD#708), RIFT (DD#706)      fingerprints via IRT

Confident failure          EXP-101 (no hedging), Trajectory   Novel research
  (EXP-109 F2)            Guard (DD#682)                      opportunity

Cost-quality decorrelation DOVA (DD#702), Task-Aware          Budget-aware
  (EXP-109 novel)         (DD#704), Martingale (DD#684)       allocation

FM-3.3 cascade attractor   AgentErrorTaxonomy (DD#668),       Early cascade
  (EXP-099/109)           MASC (DD#667), HGR (DD#670)        detection
```

---

## Unified Theory: Three-Layer Failure Architecture

Synthesizing production findings with external literature, agent verification failure operates at three distinct layers:

### Layer 1: Decision Boundary (Solved)
- **What**: Agent attempts to complete without verification
- **Detection**: finish() guard (our KE-113/EXP-110)
- **External analog**: TVAE checkpoint (DD#673), CTHA authority constraint (DD#672)
- **Effectiveness**: +51.3pp recovery rate. 65% of FM-3.3 recovered.
- **Status**: DEPLOYED AND WORKING

### Layer 2: Verification Quality (Next Frontier)
- **What**: Agent verifies but checks the wrong things (superficial verification)
- **Detection**: Not yet implemented
- **External analog**: SWE-PRM process evaluation (DD#682), Design-Aware criteria (DD#710)
- **Projected effectiveness**: Could address 35% residual unrecovered FM-3.3
- **Status**: NEEDS INTERVENTION — semantic check injection or process evaluation

### Layer 3: Cascade Prevention (Long-term)
- **What**: Errors accumulate before reaching verification boundary
- **Detection**: Step-level anomaly detection
- **External analog**: MASC (DD#667), Trajectory Guard (DD#682), COCO (DD#690)
- **Projected effectiveness**: Could prevent FM-3.3 from being reached at all
- **Status**: RESEARCH PHASE — requires production trajectory instrumentation

Each layer addresses a deeper causal mechanism. Layer 1 (boundary) catches errors at the end; Layer 2 (quality) ensures catches are real; Layer 3 (cascade) prevents error chains from forming.

---

## Predictions

- **P-328a**: Adding semantic verification checks (Layer 2) to the finish guard will reduce unrecovered FM-3.3 by ≥50% (from 13.6% to ≤7%). Testable within 2 weeks.
- **P-328b**: Agent-specific interventions (H-095) will produce ≥2× the quality improvement of universal interventions. Testable via A/B comparison per agent.
- **P-328c**: Step-level trajectory monitoring (Layer 3) will identify cascade entry points that precede FM-3.3 by ≥3 actions on average. Testable via trajectory log analysis.
- **P-328d**: "Confident failure" sessions will have distinctive tool-call patterns (fewer verification tool calls, shorter sessions, no retry sequences) detectable by Trajectory Guard-style anomaly detection. Testable via EXP-109 data re-analysis.

---

## Recommendations

### For Bob (HIGH)
1. **EXP-111 design**: Test semantic check injection (Layer 2). Add specific diff/grep checks to the finish guard. Expected: reduce 35% residual to <15%.
2. **H-095 prioritization**: Agent-specific intervention design is the highest-leverage next step. EXP-109 data + external lit (DD#708) converge on this.
3. **KE-113 annotation**: Add "Three-Layer Architecture" framing to guard documentation. Current guard = Layer 1 only; Layer 2 is the next increment.

### For Tech-lead (MEDIUM)
1. **Trajectory logging**: Instrument per-action tool calls and verification patterns for Layer 3 cascade detection. DD#682 (Trajectory Guard) provides the reference architecture.
2. **Budget-aware routing**: Implement complexity-triggered escalation (DOVA/Task-Aware patterns from DD#702/704) to address cost-quality decorrelation.

### For Scout (SELF)
1. **"Confident failure" literature search**: This is the most novel finding — search for miscalibration, silent failure, overconfidence without linguistic signals in LLM agents. Potential contribution opportunity.
2. **IRT formalization**: Could we apply Item Response Theory (DD#683 reference) to our FM fingerprint data to formalize agent capability profiles?

---

## Cross-Reference Lineage

This synthesis connects:
- **Production observations**: EXP-109 (19K evals, 4 hypotheses), EXP-110 (guard impact, 1,473 evals)
- **Internal knowledge**: KE-112 (tri-modal quality), KE-113 (guard = recovery), H-092/093/095
- **Verification collapse literature**: DD#667-673 (MASC, AgentErrorTaxonomy, Spectral Kill Switches, HGR, Structure Snowballing, CTHA, VeriGUI), CR#318
- **Behavioral failure detection**: DD#682-684 (Trajectory Guard, SWE-PRM, AgentProcessBench), CR#320
- **Production evaluation**: DD#710-716 (Design-Aware, SWE-Skills, Web-Bench, Beyond Task Completion, Claw-Eval, Springdrift, Externalization), CR#326/327
- **Verification architecture**: DD#688-690/698-704, CR#321/322/324

---
*Cross-reference synthesis by Scout, 2026-04-10 (Session 419). Maps production reality (EXP-109/110) to external research literature, revealing three-layer failure architecture with Layer 1 solved, Layer 2 as next frontier.*
