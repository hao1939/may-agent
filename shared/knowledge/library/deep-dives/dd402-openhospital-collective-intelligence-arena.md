# DD#402 — OpenHospital: A Thing-in-itself Arena for Evolving and Benchmarking LLM-based Collective Intelligence

**ArXiv:** 2603.14771  
**Date:** 2026-03-16  
**Authors:** Peigen Liu, Rui Ding, Yuren Mao, Ziyan Jiang, Yuxiang Ye, Yunjun Gao (Zhejiang University), Ying Zhang, Renjie Sun (Zhejiang Gongshang University), Longbin Lai (Tongyi Lab, Alibaba Group), Zhengping Qian (Alibaba Cloud)  
**Primary Category:** cs.AI (cross-listed cs.MA)  
**Rating:** ★★★★  
**Code:** https://github.com/ZJU-LLMs/OpenHospital

---

## One-Sentence Summary

OpenHospital is an interactive arena where LLM-based physician agents evolve collective intelligence through dynamic interactions with patient agents, demonstrating measurable improvement across clinical metrics over 22 training batches using a "data-in-agent-self" paradigm.

---

## Core Problem

Current LLM multi-agent systems are evaluated on **static benchmarks** that capture snapshot capabilities but fail to measure how collective intelligence **emerges and evolves** over time. The "data wall" — exhaustion of high-quality human corpora — demands a paradigm shift from training on static inputs to embedding agents in **dynamic environments** that iteratively refine behavior through complex autonomous interactions.

The authors frame this philosophically via Kant's phenomenon/noumenon distinction: static datasets are mere phenomena (surface observations), while true CI requires agents to approximate noumenal structure through active engagement.

---

## Key Contributions

### 1. Data-in-Agent-Self Paradigm
Rather than receiving pre-processed static data, physician agents must **interact** with patient agents modeled as dynamic entities to elicit clinical information. Patient agents enforce:
- **Information asymmetry**: Patients only reveal subjective symptoms, not ground-truth diagnoses
- **Conditional disclosure**: Information given only in response to targeted inquiry (no "information dumping")
- **Persona-modulated responses**: Different patients respond differently to identical questions

### 2. Four-Pillar Patient Agent Construction
Rigorous patient simulation with validated pillars:

| Pillar | Metric | Score |
|--------|--------|-------|
| Clinical Correctness | Medical Consistency (GPT-5.2 judge) | 4.41/5 |
| Persona Diversity | Self-BLEU4 / TF-IDF | 0.41 / 0.87 |
| Linguistic Fluency | Perplexity (Baichuan-M2-32B) | 5.75 |
| Behavioral Realism | Accuracy/Relevance/Persona Alignment | 4.36/4.74/4.12 out of 5 |

Knowledge base: **583 diseases**, **467 binary comorbidities** across **19 clinical departments**.

### 3. Multi-Dimensional Evaluation Framework

**Medical Capability Metrics:**
- **Examination Precision:** P = |L_pred ∩ L_gold| / |L_pred| — penalizes unnecessary tests
- **Diagnostic Accuracy:** Binary match against ground truth diagnosis
- **Treatment Plan Alignment:** LLM-scored across safety, effectiveness, and personalization

**System Efficiency Metric:**
- **Total Input Tokens:** Cumulative token consumption across all LLM interactions per batch

### 4. Demonstrated Evolution of Collective Intelligence

**Architecture:** 38 physician agents across 19 departments (2 per dept), using Agent-Kernel framework with closed-loop reflection mechanism.

**Training:** 12,000 patient records, 22 sequential batches (~500 cases each), powered by Qwen3-Next-80B-A3B-Instruct.

**Results across 22 batches:**

| Metric | Batch 1 | Batch 22 | Improvement |
|--------|---------|----------|-------------|
| Examination Precision | 45.05% | 61.31% | +16.26pp |
| Diagnostic Accuracy | 48.11% | 57.34% | +9.23pp |
| Treatment Plan Alignment | 58.49% | 61.52% | +3.03pp |
| Total Input Tokens | 16.04M | 14.83M | -7.5% (more efficient) |

Key insight: **Performance rises while computational cost drops** — agents learn to streamline diagnostic workflows, eliminating redundant inquiries.

### 5. Emergent Cooperative Behaviors
- **Spontaneous cross-departmental consultation:** Infectious disease agents proactively consult cardiology for complex comorbidity cases
- **Consensus-driven decision-making:** Agents integrate diverse medical knowledge through debate
- **No explicit cooperation instructions** — collaborative patterns emerge purely from the reflection mechanism

---

## Architecture Deep-Dive

### Patient Agent Design
```
Patient Agent = {
  Ontology (structured medical record),
  Persona Seed (demographics, psychology, behavioral patterns),
  Vector Database (semantic memory of medical history),
  Epistemic Boundary (subjective info only, no ground truth access),
  Conditional Disclosure Protocol (respond only to targeted queries)
}
```

### Physician Agent Action Space
1. **Patient Perception** — Initial assessment of presenting symptoms
2. **Targeted Inquiry** — Directed questions to extract specific information
3. **Diagnostic Examination** — Order relevant tests
4. **Multi-Agent Consultation** — Cross-departmental collaboration
5. **Knowledge Retrieval** — Access medical knowledge base
6. **Treatment Formulation** — Final diagnosis and treatment plan

### Reflection Mechanism (Evolution Driver)
After each case, agents perform multi-dimensional self-critique:
- Compare diagnosis against ground truth
- Evaluate examination efficiency
- Assess therapeutic safety
- Synthesize reflections into unified feedback for decision-making optimization

---

## Critical Assessment

### Strengths
1. **Compelling paradigm:** Data-in-agent-self shifts from static to dynamic evaluation — a genuine contribution
2. **Rigorous validation:** Four-pillar patient construction with multiple automated and LLM-judge metrics
3. **Quantifiable evolution:** Clear upward trajectories across all clinical metrics over 22 batches
4. **Efficiency-capability tradeoff:** Rare demonstration that agent improvement can co-occur with reduced computational cost
5. **Emergent collaboration:** Spontaneous cross-department consultation without explicit cooperation programming

### Weaknesses
1. **Text-only modality:** No medical imaging (CT, MRI, X-ray) — limits realism for radiology/dermatology
2. **No temporal disease progression:** Static snapshots rather than evolving clinical conditions
3. **Binary diagnostic accuracy:** Oversimplified metric — partial credit or differential diagnosis ranking would be more clinically meaningful
4. **Single model backbone:** Both physician and patient agents use same Qwen3 model — potential confound in interaction dynamics
5. **Limited improvement magnitude:** Diagnostic accuracy gains (+9pp) are modest, raising questions about ceiling effects
6. **Missing baselines:** No comparison against other multi-agent medical systems (Agent Hospital, AgentClinic)

### Questions for Follow-up
- Does CI quality plateau or continue improving beyond batch 22?
- How does agent specialization emerge — do some departments improve faster?
- What happens when agents from different model families interact?

---

## Connections to Prior Deep-Dives

### Direct Connections
- **DD#393 (Exemplar-Driven Moral Learning):** Both study emergent prosocial behaviors in multi-agent simulation — OpenHospital shows emergent cooperation in medical context
- **DD#375 (ASVO — Autonomous Social Value-Oriented Agents):** Both demonstrate agents developing cooperative behaviors through interaction rather than explicit programming
- **DD#392 (SAGE — Self-Evolution for LLM Reasoning):** Both use reflection/self-critique mechanisms to drive agent evolution — SAGE for reasoning, OpenHospital for clinical capability

### Architectural Pattern Connections
- **DD#391 (Language Model Teams as Distributed Systems):** OpenHospital's 38-agent architecture maps to distributed systems concepts — department specialization = service decomposition
- **DD#401 (Token Coherence / MESI):** Token consumption tracking connects to coherence overhead — OpenHospital shows agents can reduce communication cost while improving
- **DD#382 (D-MEM: Dopamine-Gated Memory):** Reflection mechanism parallels dopamine-gated memory consolidation — both selectively retain high-value experiences

### Synthesis Pattern: "Evolution Through Interaction"
OpenHospital validates a key architectural law from DD#400 (Seven Laws of Multi-Agent Coordination): **Law 4 (Self-Organization)** — sophisticated cooperative patterns emerge from simple local rules (reflection + consultation capability) without centralized coordination. The cross-departmental consultation behavior is a textbook example of emergent role specialization.

---

## Relevance to Our System

**Medium-High.** Several directly applicable insights:

1. **Reflection-driven evolution:** The closed-loop self-critique mechanism could be adapted for Scout's own research quality improvement — comparing research output against ground truth assessments
2. **Multi-agent consultation patterns:** The spontaneous cross-department consultation model parallels potential inter-agent knowledge sharing in our multi-agent architecture
3. **Efficiency-capability co-optimization:** Demonstrates that agents can simultaneously get better AND cheaper — important for system design
4. **Quantifiable CI metrics:** The dual medical-capability + system-efficiency framework provides a template for measuring our own multi-agent system performance

**Actionable insight:** The "data-in-agent-self" paradigm suggests that agent improvement should come from *interaction with dynamic environments* rather than static fine-tuning — directly relevant to our operational model.

---

## Tags
`collective-intelligence` `multi-agent-evolution` `medical-ai` `reflection-mechanism` `emergent-cooperation` `agent-benchmarking` `dynamic-environment` `data-in-agent-self` `self-improvement` `cross-department-consultation`
