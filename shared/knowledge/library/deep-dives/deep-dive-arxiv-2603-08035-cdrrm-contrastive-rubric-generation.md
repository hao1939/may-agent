# Deep Dive: CDRRM — Contrast-Driven Rubric Generation for Reliable and Interpretable Reward Modeling

**Paper:** arXiv:2603.08035 (submitted 9 Mar 2026)
**Authors:** Dengcan Liu (USTC), Fengkai Yang (PKU), Xiaohan Wang† (Meituan), Shurui Yan (Meituan), Jiajun Chai (Meituan), Jiahao Li (USTC), Yikun Ban (Beihang), Zhendong Mao† (USTC), Wei Lin (Meituan), Guojun Yin (Meituan)
**Code:** https://github.com/ldcan/CDRRM (MIT, Python, 0★ — just released)
**Read:** Full paper HTML + full codebase (prompts.py, diagnosis_generation.py, rubric_generation.py, pipeline scripts)

---

## 1. Problem Statement

Current rubric-based reward models (used for LLM alignment and LLM-as-a-Judge) suffer from:
1. **Redundancy**: Direct prompting generates 7+ rubrics per sample; most are noise (perturbation study: removing 1-3 rubrics causes ≤0.42% accuracy change)
2. **Bias vulnerability**: LLM evaluators are prone to verbosity bias, position bias, and stylistic preference bias
3. **Scalability-reliability trade-off**: More rubrics ≠ better evaluation; excess criteria confuse the judge

CDRRM's core insight: **Preference judgments hinge on a sparse set of causal discriminative factors, not a comprehensive checklist.** Find those factors via contrastive analysis, not direct prompting.

## 2. Architecture: Contrast-then-Synthesis Paradigm

### Phase 1: Contrastive Profiling (StepA — Diagnosis Generation)

For each preference pair (instruction, chosen response, rejected response):

1. **Adaptive Evaluation Taxonomy**: Dynamically selects relevant dimensions from a dimension pool:
   - Instruction Following, Content Coverage, Factual Accuracy, Format Compliance, Logical Consistency, Safety, Conciseness, Completeness
   - Selection is context-dependent: only activate dimensions germane to the specific instruction

2. **Evidence-Anchored Verification**: For each active dimension, the judge model generates:
   - `claim`: One-sentence verifiable statement about what's good/bad
   - `evidence`: Specific text fragment cited from the response
   - `instruction_anchor`: Points to which instruction requirement is relevant
   - `status`: pass | fail | partial | not_applicable
   - `severity`: 0-3 (when status is fail/partial)

3. **Output**: Structured JSON diagnosis per response, grounding all assessments in text evidence

### Phase 2: Rubric Synthesis (StepB — Discriminative Rubric Generation)

Takes the two diagnoses (chosen vs. rejected) and synthesizes a **minimal discriminative rubric**:

1. **Contrastive Comparison**: Uses the structured differential Δ(Γ_chosen, Γ_rejected) to identify exactly where the responses diverge
2. **Rubric Generation**: Produces:
   - `hard_rules`: Atomic, independently verifiable, must/forbid rules with rationale + test description + derived_from (traces back to which diagnosis findings)
   - `principles`: Optional subjective criteria, only when hard rules can't fully distinguish
   - `pair_consistency_check`: Self-verification that the rubric correctly predicts the known preference

3. **Consistency Filtering**: Re-evaluates the preference pair under the generated rubric; rubrics that produce wrong predictions are discarded

### Phase 3: Model Training

Two components trained on 3k samples each:

1. **Rubric Generator** (SFT on Qwen3-8B): Given (instruction, response_a, response_b) → generate rubric
2. **Judge Model** (SFT on Qwen3-8B): Given (instruction, response_a, response_b, rubric) → generate justification + preference

Key: **The Rubric Generator and Judge Model are separate.** The rubric generator produces criteria; the judge model uses those criteria to make decisions. This separation enables:
- Using a frozen (untuned) judge model guided only by generated rubrics
- Upgrading the rubric generator without retraining the judge
- Plugging different judge models behind the same rubric generator

## 3. Key Results

### Performance (Table 2)

| Model | RewardBench | RMBench Overall | RMBench Hard | RMB Overall | Avg |
|-------|-------------|-----------------|--------------|-------------|-----|
| RM-R1-Qwen-32B (rubric-based) | 91.4 | 79.1 | 70.4 | 80.0 | 83.5 |
| BR-RM-Qwen-8B (generative) | 91.0 | 85.0 | 76.1 | 79.6 | 85.2 |
| **CDRRM-8B (Base, no SFT judge)** | **90.4** | **86.1** | **81.1** | **80.8** | **85.8** |
| **CDRRM-8B (SFT)** | **92.0** | **85.8** | **81.0** | **83.2** | **87.0** |
| **CDRRM-14B (SFT)** | **92.8** | **87.6** | **83.4** | **84.4** | **88.3** |

Key takeaways:
- **CDRRM-8B (Base) outperforms 32B rubric-based and 8B generative baselines** with NO judge fine-tuning — just better rubrics
- **+18% gain on RMBench Hard** vs. rubric-based baseline (83.4 vs 70.4) — where bias resistance matters most
- **5.7% improvement** over best rubric-based method across all benchmarks
- **Only 3k training samples** for rubric generator + 3k for judge

### Ablation Study

| Variant | RewardBench | RMBench Overall | Avg |
|---------|-------------|-----------------|-----|
| Direct Judge (no rubric) | 88.1 | 82.2 | — |
| Direct Rubric (no contrastive profiling) | 89.2 | 83.9 | — |
| **Full CDRRM** | **92.0** | **85.8** | — |

Contrastive profiling contributes ~3.8% on RewardBench and ~1.9% on RMBench beyond direct rubric generation. The two-stage pipeline (contrast→synthesize) is strictly better than one-stage (direct prompt → rubric).

### Data Efficiency

Scaling from 1k to 3k samples shows consistent improvement. The framework achieves SOTA with remarkably small data — the quality of training data (contrastively profiled, consistency-filtered) matters far more than quantity.

## 4. Implementation Details (from Code Review)

### Repository Structure
```
cdrrm/
├── prompts.py              # All prompt templates (3 stages)
├── llm_client.py           # Async OpenAI-compatible client
├── utils.py                # I/O, logging, JSON extraction
├── rubric_synthesis/
│   ├── diagnosis_generation.py  # StepA: async batch diagnosis
│   ├── rubric_generation.py     # StepB: async batch rubric gen
│   └── run_pipeline.sh
├── sft_data_synthesis/
│   ├── filter_inconsistent_rubrics.py
│   ├── prepare_sft_data.py
│   ├── judge_synthesis.py
│   └── run_*.sh
├── eval/
│   ├── generate_rubrics.py
│   ├── evaluate.py
│   └── eval_dataset/
└── train/
    └── train.sh           # Uses Swift for SFT
```

### Key Design Decisions
1. **Async batch processing** with resume support (skip already-processed pairs)
2. **JSON extraction from LLM text** (robust parsing)
3. **Validation at every stage** (DiagnosisResult and RubricPairResult have `.validate()`)
4. **Label redaction**: Before sending diagnoses to StepB, chosen/rejected labels are stripped to prevent the rubric generator from pattern-matching on labels
5. **Consistency normalization**: Legacy "chosen"/"rejected" labels mapped to "A"/"B" for position-neutral evaluation
6. **Teacher model**: Qwen3-235B-A22B-Instruct for data synthesis; student models trained on 8B/14B Qwen3

### Prompt Architecture (Extracted from prompts.py)

**StepA (Diagnosis) System Prompt — Key Constraints:**
- "All diagnoses must be based on verifiable facts, not subjective assumptions"
- "Each finding must cite specific fragments from the answer as evidence"
- "Diagnoses must be directly related to instruction requirements, cannot introduce new requirements"
- "Avoid vague evaluations like 'more in-depth' or 'more professional'"
- Severity scale: 0 (mild) to 3 (severe)

**StepB (Rubric Generation) System Prompt — Key Constraints:**
- "Discriminative: Each hard rule must be able to distinguish between Answer A and Answer B"
- "Atomic: Each rule must be independently verifiable (pass/fail), cannot be a compound condition"
- "Generalizable: Rules cannot contain answer-specific details"
- "Minimal: Use fewer rules to distinguish when possible"
- "Executable: Each rule must be able to evaluate a single answer"
- "You MUST NOT assume which answer is better based on any label"

**Judge System Prompt — Key Constraints:**
- Hard Rules: "explicit, objective, verifiable requirements from the instruction"
- Principles: "optional subjective criteria, ONLY if needed to distinguish this specific pair"
- Structured output format with Analysis → Final Judgment → Winner

## 5. Cross-References with Prior Research

### vs. JRH (arXiv:2603.05399 — Judge Reliability Harness)
- JRH tests judge reliability via perturbations; CDRRM reduces the need for such testing by making judges more robust via structured rubrics
- JRH found format perturbations cause larger drops than semantic perturbations → CDRRM's hard rules focus on semantic content, not format, which should be more robust to format perturbation
- **Complementary**: Use CDRRM-style rubrics + JRH-style perturbation testing = best of both

### vs. Bias-Bounded Evaluation (arXiv:2603.05485)
- Bias-bounded approach: accept bias exists, bound its impact mathematically
- CDRRM approach: prevent bias by structuring evaluation around causal discriminative factors
- Both attack the same problem from different angles — CDRRM is prevention, bias-bounded is mitigation
- **Could combine**: Use CDRRM rubrics as the evaluation protocol, then apply Lipschitz shrinkage from bias-bounded framework to the judge's scores for double protection

### vs. AceMAD (arXiv:2603.06801 — Martingale Curse)
- AceMAD: peer-prediction reveals second-order beliefs to break the martingale
- CDRRM: contrastive profiling grounds evaluation in first-order evidence
- Different mechanisms, but both fight the same enemy: LLM judges falling into superficial pattern matching
- CDRRM's "evidence-anchored verification" is a form of forcing first-order grounding

### vs. Bug-Hunt's Adversarial Architecture
- Bug-Hunt: Hunter (over-reports) → Skeptic (challenges) → Referee (decides)
- CDRRM: analogous structure — StepA (diagnosis, like Hunter's report) → StepB (synthesis with consistency check, like Referee's arbitration) → Judge (final decision)
- Key parallel: both use **separation of concerns** — finding evidence and making judgments are different tasks

### vs. Error Cascades (arXiv:2603.04474)
- Error cascades are amplified when evaluation criteria are noisy/redundant (bad rubrics → bad scores → bad training signal → worse model)
- CDRRM's consistency filtering directly prevents this: rubrics that don't correctly predict known preferences are discarded before they can propagate errors

## 6. Actionable Takeaways for Our System

### For Our Evaluator (Highest Priority)

**T1: Adopt the Contrast-then-Synthesis pattern for evaluation criteria generation.**
Current state: Our Evaluator likely uses generic criteria. CDRRM shows that contrastively derived criteria (comparing good vs. bad examples) produce better rubrics than generic prompt-based criteria.
- **Implementation**: When the Evaluator receives code to assess, first generate structured diagnoses of specific strengths/weaknesses (grounded in code evidence), then synthesize those into minimal discriminative rubrics, then judge.
- **Cost**: One extra LLM call (diagnosis step) per evaluation. This is a 2x increase in eval tokens but should significantly improve evaluation quality.

**T2: Evidence-anchoring for all evaluation claims.**
Every evaluation finding must cite the specific code location, function, or behavior it references. No ungrounded claims like "code quality could be improved."
- Directly adoptable from CDRRM's StepA prompt pattern: `claim` + `evidence` + `instruction_anchor`
- This alone should reduce evaluator hallucination and verbosity bias

**T3: Consistency self-check.**
After generating evaluation criteria, re-evaluate a known sample against those criteria. If the criteria produce a wrong verdict, regenerate.
- CDRRM's `pair_consistency_check` is trivially implementable
- Cost: One additional verification call per evaluation

**T4: Separate rubric generation from judging.**
Don't ask one LLM call to both identify criteria AND apply them. Generate criteria first, then judge against those criteria in a second call.
- This mirrors CDRRM's two-stage architecture
- Benefits: criteria become inspectable, debuggable, reusable

### For Our QA Agent

**T5: Structured diagnosis format for code review.**
Adopt CDRRM's finding format for code review outputs:
```json
{
  "criterion": "Error Handling",
  "status": "fail",
  "severity": 2,
  "claim": "Function X does not handle null input, causing potential NPE",
  "evidence": "Line 42: `result = data.process()` — no null check before method call",
  "instruction_anchor": "Requirement: handle edge cases gracefully"
}
```
This makes QA outputs machine-parseable, traceable, and verifiable.

### For Our Workflow Design

**T6: The "3k sample" insight — quality over quantity in training data.**
CDRRM achieves SOTA with 3k high-quality contrastive samples. For any training/few-shot setup in our system, invest in contrastive example selection rather than large-scale data collection.

## 7. New Papers Triaged This Session

### SCAFFOLD-CEGIS (arXiv:2603.08520) — ★★★ Core
"Preventing Latent Security Degradation in LLM-Driven Iterative Code Refinement"
- **The Iterative Refinement Paradox**: 43.7% of GPT-4o iteration chains contain MORE vulnerabilities after 10 rounds than the baseline
- SAST gating makes it WORSE (12.5% → 20.8% latent degradation) because static rules can't detect structural degradation (removal of defensive logic, weakened exception handling)
- **SCAFFOLD-CEGIS fix**: Multi-agent collaborative architecture with CEGIS paradigm — identifies security-critical elements as hard constraints via semantic anchoring, enforces safety monotonicity through 4-layer gated verification
- **Result**: Latent degradation rate reduced to 2.1%, safety monotonicity rate 100%
- **Relevance to our system**: Our Coder does iterative refinement. This paper shows that without explicit security constraint tracking, quality can degrade silently across iterations. The "semantic anchoring" pattern (identify critical elements, solidify them as hard constraints) is directly applicable to our QA/Evaluator loop.

### Boiling Frog Threshold (arXiv:2603.08455) — ★★ Strong
"Criticality and Blindness in World Model-Based Anomaly Detection Under Gradual Drift"
- Sharp detection threshold ε* exists: below it, drift is absorbed as normal variation; above, detected rapidly. Sigmoid shape is universal.
- **Sinusoidal drift is completely undetectable** by ALL detector families — this is a world model property, not a detector artifact
- In "fragile" environments, agents collapse BEFORE any detector fires ("collapse before awareness")
- **Relevance**: Maps to our system's monitoring challenges. Gradual quality degradation across sessions may be undetectable. Sudden changes (new bug type, new error pattern) are detectable; slow drift (gradually declining code quality) may not be. The "collapse before awareness" failure mode is particularly concerning — an agent may become ineffective before any metric catches it.

## 8. Repo Tracking Update

| Repo | Stars | Prior | Change | Status |
|------|-------|-------|--------|--------|
| cc-connect | 754★ | 710★ | +6.2% | Steady growth |
| MetaClaw | 136★ | 103★ | **+32%** | 🔥 Accelerating |

MetaClaw continues its explosive growth trajectory (54→103→136). Self-improvement loop for live agent conversations is clearly finding product-market fit.

---

**Session summary:** CDRRM's Contrast-then-Synthesis paradigm is the most directly actionable evaluation methodology we've found. The core insight — generate evaluation criteria by contrasting good/bad examples, not by prompting from scratch — applies immediately to our Evaluator. Combined with evidence-anchoring and consistency self-checks, this should materially improve evaluation quality at modest additional cost. The code is clean and public.
