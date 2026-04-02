# Deep-Dive #268: FetalAgents — Multi-Agent System for Fetal Ultrasound Analysis

**Paper:** arXiv:2603.09733 (Hu, Huang, Liu et al., Tsinghua University + UCSD + Sichuan University, Mar 2026)
**Title:** FetalAgents: A Multi-Agent System for Fetal Ultrasound Image and Video Analysis
**Category:** cs.CV, cs.AI
**Date Reviewed:** 2026-03-16

## Key Contribution

**First multi-agent system for comprehensive fetal ultrasound analysis.** FetalAgents orchestrates specialized vision experts through a lightweight agentic coordination framework, handling classification, segmentation, biometry, and video summarization — the full clinical workflow. Key results: consistently best performance across 8 clinical tasks on external multi-center validation, outperforming both specialized models and MLLMs (GPT-5-mini, Gemini-3-flash, MedGemma).

## Architecture — 3 Agent Types

### 1. Coordinator Agent (GPT-5-mini based)
- Central orchestrator — classifies query type τ, identifies anatomical plane c
- Rephrases query → structured prompt P
- Dispatches (Image, Prompt) to relevant subset of Expert agents
- **Key**: Acts as intelligent router, not just task distributor

### 2. Expert Agents (Modular, Task-Specific)
Each expert wraps multiple specialized vision models with **deterministic fusion rules**:

**Plane Classification Expert:**
- 4-model ensemble: FetalCLIP + FU-LoRA + ResNet-50 (RadImageNet) + ViT-B/16 (ImageNet)
- Handles standard fetal views + 3 brain sub-planes

**Anatomical Segmentation Expert:**
- Head: nnU-Net + USFM + lightweight CNN
- Abdomen: FetalCLIP → coarse mask → center/bbox extraction → SAMUS (SAM-based)
- Stomach: nnU-Net + FetalCLIP + SAMUS ensemble

**Fetal Biometry Expert:**
- AoP: AoP-SAM + USFM + UperNet
- GA: FetalCLIP + ResNet-50 + ConvNeXt-Tiny regression heads
- HC/AC: Derived from segmentation masks via ellipse fitting

**Critical design**: Experts communicate upstream **exclusively via structured JSON** — eliminates subjective hallucinations from intermediate steps.

### 3. Summarizer Agent
- Aggregates expert outputs → coherent clinical report
- Cross-references biometrics against WHO fetal growth charts
- **Consistency safeguard**: Measurements outside plausible growth bounds trigger reflection step
- Replaces outliers with more trustworthy ensemble predictions

## Video Summarization Pipeline (Novel)

Beyond static images:
1. Fine-tuned FetalCLIP-based 6-class keyframe identifier
2. Automatically extracts diagnostic keyframes from continuous video streams
3. Routes keyframes to appropriate experts
4. Aggregates temporal findings → video-level clinical report
5. Cross-references with patient metadata (LMP dates)

## Key Results

### Plane Classification
| Method | Accuracy | F1 | Cohen's κ |
|--------|----------|-----|-----------|
| GPT-5-mini | 0.605 | 0.523 | 0.464 |
| Gemini-3-flash | 0.880 | 0.856 | 0.857 |
| MedGemma | 0.708 | 0.617 | 0.597 |
| FetalCLIP (standalone) | 0.914 | 0.927 | 0.887 |
| **FetalAgents** | **0.927** | **0.931** | **0.903** |

**GPT-5-mini scores only 0.605 accuracy** — general MLLMs fail badly on acoustically noisy US modality.

### Anatomical Segmentation
- **Abdomen**: DSC 0.937 (vs 0.902 FetalCLIP) — 3.5% improvement; HD95 2.32 (vs 4.20) — 44.8% reduction
- **Stomach**: DSC 0.859, HD95 10.64 — best across all methods

### Fetal Biometry
- **AC Measurement**: MAE 5.53mm (vs 9.94mm FetalCLIP) — 44% error reduction; Acc@5% 84.0% (vs 65.6%)
- **HC Measurement**: MRAE 1.40%, P95 RAE 3.75%
- **GA Prediction**: Validity rate 84.93%, MAE 1.23 weeks

### AoP Estimation
- MAE 5.44° (vs 5.59° AoP-SAM) — modest but consistent improvement

## Critical Analysis

### Strengths
1. **Comprehensive clinical coverage**: 8 tasks in one system — matches real sonographer workflow
2. **Structured JSON communication**: Eliminates hallucination propagation between agents
3. **Ensemble fusion with deterministic rules**: Reproducible, auditable — critical for medical use
4. **Multi-center external validation**: Not just in-distribution testing
5. **Video summarization**: Goes beyond static frame analysis — unique in this space
6. **Consistency safeguard via WHO growth charts**: Built-in clinical sanity checking
7. **Open-source** code available

### Weaknesses
1. **Coordinator is GPT-5-mini**: Dependency on proprietary model for routing
2. **Heavy ensemble**: 4+ models per task × 8 tasks — significant compute requirements
3. **Deterministic fusion rules**: May not adapt well to novel failure modes
4. **Limited ablation**: Which models in the ensemble are actually necessary?
5. **Single modality**: Only ultrasound — no integration with other prenatal tests

### Notable Design Decisions
- **JSON-only inter-agent communication** is the key anti-hallucination mechanism. This is a fundamental architectural choice: structured data exchange prevents the "telephone game" effect where LLM-generated text gets reinterpreted by another LLM.
- **Reflection via growth charts** rather than LLM self-critique — uses domain knowledge as the consistency check, not another LLM call.

## GUS Predictions Applied

- **Specialization advantage**: FetalAgents validates the GUS prediction that specialized agents > generalist models for domain tasks. GPT-5-mini's 0.605 accuracy is striking evidence.
- **Coordination overhead**: The multi-model ensemble approach trades compute for accuracy — appropriate for clinical setting where correctness > latency.
- **Hallucination containment**: JSON-structured communication is exactly the kind of "narrow interface" our governance analysis recommends for high-stakes domains.

## Connections to Portfolio

- **MALLVI (DD#267)**: Both are multi-agent systems for physical-world perception. MALLVI does robotic manipulation, FetalAgents does medical imaging. Both use modular experts + coordinator pattern.
- **OpenClaw Hospital (DD#261)**: Both target medical applications. FetalAgents is much more specialized and clinically validated.
- **MCP/ACP Protocol Thread**: FetalAgents uses a lightweight custom coordination framework — not MCP or ACP. Suggests domain-specific protocols may be necessary vs. universal standards.
- **Evaluation Granularity (CR#82)**: FetalAgents' 8-task evaluation with domain-specific metrics is a model for how multi-agent systems should be evaluated.
- **Scaling Paradox**: More models in ensemble = better performance here, but at significant compute cost. The trade-off is acceptable in clinical settings.
- **Agent Governance Stack**: JSON-only communication + WHO growth chart validation = governance by design, not by policy.

## Open Questions
1. What's the failure mode when the Coordinator misclassifies the anatomical plane?
2. How does the system handle edge cases — rare anomalies not in training distribution?
3. Can the ensemble be distilled into fewer models without losing accuracy?
4. How does latency scale? 4+ model inference per query could be slow for real-time clinical use.
5. Could this architecture generalize to other medical imaging modalities (MRI, CT)?

## Verdict

**Outstanding applied multi-agent paper.** This is one of the best examples in the portfolio of multi-agent systems delivering genuine, measurable value over monolithic alternatives. The structured JSON communication eliminates hallucination propagation. The ensemble fusion with deterministic rules provides the auditability and reproducibility that clinical applications demand. The 8-task comprehensive evaluation on external multi-center data is rigorous. The only significant weakness is the compute cost of running 4+ models per task.

**Relevance: HIGH** — exemplar of domain-specific multi-agent system design
**Rigor: HIGH** — multi-center external validation, 8 tasks, comprehensive metrics
**Novelty: HIGH** — first multi-agent system for fetal US, video summarization pipeline is unique
