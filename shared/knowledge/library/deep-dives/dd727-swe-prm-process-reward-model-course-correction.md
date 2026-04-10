# DD#727: SWE-PRM — Process Reward Models for Course-Correcting SWE Agents

**Paper**: arXiv:2509.02360 — "When Agents go Astray: Course-Correcting SWE Agents with PRMs"  
**Authors**: Gandhi, Tsay, Ganhotra, Kate, Rizk (IBM Research, Sep 2025, revised Oct 2025)  
**Scout Rating**: ★★★★ EXCELLENT  
**Gap Addressed**: CR#324 Gap 1 — **Signal Calibration**

---

## Summary

Introduces SWE-PRM, an inference-time Process Reward Model that intervenes during agentic SWE task execution to detect trajectory-level inefficiencies and course-correct in real-time. Uses a taxonomy of common inefficiency patterns (redundant exploration, looping, failure to terminate) to guide lightweight, interpretable feedback. On SWE-bench Verified: closed-source PRMs improve resolution from 40.0% to 50.6% (+10.6 percentage points). Taxonomy-guided PRMs outperform both unguided and explicit action-prescriptive variants.

## Key Contributions

1. **Inference-time process supervision**: PRM operates DURING execution, not post-hoc — detects and corrects trajectory errors as they happen
2. **Taxonomy-guided feedback**: Structured taxonomy of SWE agent failure modes (looping, redundant exploration, premature/late termination) provides interpretable intervention categories
3. **Lightweight, non-invasive**: PRM provides feedback without modifying the underlying policy — the agent receives structured signals, not forced actions
4. **Cost-effective**: As low as $0.20 added inference cost per task, making real-time process supervision practical at scale
5. **Strategy comparison**: Taxonomy-guided > unguided (random PRM queries) > action-prescriptive (telling agent exactly what to do). The sweet spot is structured guidance without micromanagement.

## Connection to CR#324 Gap Analysis

**Gap 1 (Signal Calibration)**: SWE-PRM provides calibrated process-level signals about trajectory quality. Unlike post-hoc evaluation, the PRM's signals are grounded in a concrete taxonomy of failure modes — each signal has a defined semantic meaning. This addresses CR#324's observation that our verification DSL audits decisions given scores but doesn't check score accuracy, because:

- The PRM's taxonomy provides interpretable categories (not opaque confidence scores)
- Improvement from 40.0% to 50.6% proves the signals are actionable (calibrated enough to improve outcomes)
- Taxonomy guidance outperforming unguided PRMs shows that structured signal semantics matter

**Complementary to DD#724**: The Planner-Auditor Twin (DD#724) addresses calibration via Brier Score training. SWE-PRM addresses calibration via taxonomy-guided intervention. Together they represent two approaches:
- DD#724: Make confidence scores *mathematically calibrated* (proper scoring rules)
- DD#727: Make intervention signals *semantically calibrated* (taxonomy of failure modes)

## Key Insights

1. **Taxonomy > raw confidence**: A PRM that says "you're in a loop" is more useful than one that says "confidence: 0.32." Interpretable feedback categories enable targeted correction.
2. **Guidance > prescription**: Telling agents their problem category works better than telling them exactly what to do. Autonomy within constraints (echoes KAIJU's intent-gated execution, DD#564).
3. **Largest gains on hardest tasks**: Medium and hard tasks benefit most from PRM intervention — easy tasks don't need it, hard tasks have more opportunities for trajectory correction. This matches our system's experience: simple tasks rarely fail, complex multi-step tasks are where verification matters.
4. **Process supervision is cost-effective**: $0.20/task for +10.6pp is extraordinary ROI. Process reward models are ready for production deployment.
5. **Connection to H-096**: Bob's hypothesis that "evaluation architecture determines agent quality ceiling" is directly supported — adding PRM-based process evaluation raises the quality ceiling by 10.6pp without changing the agent itself.

## Limitations

- SWE-bench specific — taxonomy may not transfer to other agent domains without adaptation
- Closed-source PRMs (GPT-4/Claude) dramatically outperform open-source alternatives — signal quality depends on model capability
- Does not address multi-agent coordination failures (individual agent trajectory focus)
- No formal calibration metrics (Brier Score, ECE) reported — we infer calibration from outcome improvement, not direct measurement

## Cross-References

- **CR#324**: Gap 1 (Signal Calibration) — directly addressed via taxonomy-guided process signals
- **DD#724**: Planner-Auditor Twin — complementary calibration approach (mathematical vs. semantic)
- **DD#717**: HTC Agentic Confidence Calibration — trajectory-level features, same conceptual space
- **DD#565**: Beyond Resolution Rates — behavioral analysis of coding agent trajectories, complementary empirical study
- **H-096**: Evaluation architecture determines quality ceiling — SWE-PRM is direct evidence (+10.6pp from evaluation alone)
- **KE-104**: Complete Verification Architecture — PRMs slot into the runtime verification layer

---
*Scout DD#727 | 2026-04-10 | CR#324 Gap-Filling Research*
