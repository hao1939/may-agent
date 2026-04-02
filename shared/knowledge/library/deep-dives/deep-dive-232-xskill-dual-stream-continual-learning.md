# Deep-Dive #232: XSkill — Dual-Stream Continual Learning from Experience and Skills in Multimodal Agents

**Paper:** arXiv:2603.12056 (Jiang, Su, Qu, Fung — ICML 2026 submission)
**Date:** 2026-03-15
**Rating:** ★★★★★ (Critical framework paper — directly extends and validates SkillRL/Capability Evolution Pipeline)
**Scout Research Portfolio — Deep-Dive #232**

---

## 1. Core Contribution

XSkill proposes a **dual-stream framework** for training-free continual learning in multimodal agents, separating reusable knowledge into two complementary forms:

1. **Skills** (K): Task-level guidance — structured workflows, tool templates, reusable procedures stored as Markdown documents. Each skill k = (M, W, P) where M=metadata, W=workflow sequence, P=tool templates.

2. **Experiences** (E): Action-level guidance — concise context-sensitive insights for tool selection, error recovery, and decision-making stored as JSON entries. Each experience e = (c, a, v_e) where c=triggering condition, a=recommended action, v_e=embedding for retrieval.

The key insight: **Skills reduce errors; Experiences enable flexible orchestration.** These two knowledge forms are complementary, not redundant.

---

## 2. Architecture — Two-Phase Design

### Phase I: Accumulation
For each training task, the execution model performs N independent rollouts, then:

1. **Rollout Summary** — A knowledge management model (MLLMkb) performs visually-grounded summarization across trajectories, producing both trajectory summaries and skill fragments. Crucially grounds extraction in visual observations, not just text logs.

2. **Cross-Rollout Critique** — Contrastive analysis between successful and failed trajectories identifies causal factors. Produces structured experience updates (add/modify operations).

3. **Knowledge Consolidation** — Hierarchical mechanism that:
   - Merges semantically similar experiences (cosine similarity > threshold)
   - Caps experience bank at N_max, pruning low-quality entries by generalizability/actionability
   - Integrates skill fragments into global skill document, with length-triggered refinement replacing specific instances with reusable placeholders

### Phase II: Inference
For a test task:

1. **Task Decomposition Retrieval** — Decomposes query into n_g abstract subtasks, retrieves top-k experiences per subtask via embedding similarity.

2. **Experience Rewrite** — Adapts retrieved experiences to current visual context (e.g., "normalize orientation" becomes "rotate this upside-down image before detection").

3. **Skill Adaptation** — Prunes irrelevant skill sections, integrates rewritten experiences, adjusts code templates.

4. **Non-Prescriptive Injection** — Adapted knowledge injected as reference, not prescription — agent retains flexibility to improvise.

**Continual Learning Loop:** Usage history from inference feeds back into accumulation for progressive refinement.

### Model Separation
Critical design choice: **MLLMexec** (execution) and **MLLMkb** (knowledge management) are separate models. This enables:
- Using a stronger model for knowledge curation while keeping execution model flexible
- **Cross-model knowledge transfer** — knowledge accumulated by one model can benefit another

---

## 3. Key Results

### 3.1 Performance
Evaluated on 5 benchmarks (VisualToolBench, TIR-Bench, MMSearch-Plus, MMBrowseComp, AgentVista) across 4 backbone models (Gemini-2.5-Pro, Gemini-3-Flash, GPT-5-mini, o4-mini):

- Average@4 gains over tools-only baseline: **+2.58 to +6.71 pts** across models
- Best single-benchmark gain: **+15.38 pts** (TIR-Bench with Gemini-3-Flash)
- **Cross-model transfer validated:** GPT-5-mini and o4-mini used knowledge accumulated by Gemini-3-Flash and still gained 2.58-4.16 pts

### 3.2 Ablation (VisualToolBench, Gemini-2.5-Pro)
| Component Removed | Average@4 Drop |
|-------------------|---------------|
| w/o Experience | -3.04 |
| w/o Skill | -3.85 |
| w/o Experience Manager (Phase 1) | -4.09 |
| w/o Skill Manager (Phase 1) | -3.62 |
| w/o Task Decomposition (Phase 2) | -1.28 |
| w/o Task Adaptation (Phase 2) | -1.52 |

**Critical finding: Phase 1 (knowledge quality) matters more than Phase 2 (retrieval mechanism).** Knowledge accumulation/consolidation contributes 3.62-4.09 pts; retrieval improvements contribute only 1.28-1.52 pts.

### 3.3 Complementary Roles
- **Skills reduce structural errors:** Error rate drops from 29.9% (168 errors) to 15.3% (95 errors) when skills added. Syntax errors: 114 to 71. Tool name errors: 16 to 2.
- **Experiences shift tool selection:** Code interpreter usage increases from 66.63% to 74.49% on VisualToolBench. Image search doubles (15.43% to 24.63%) on MMSearch-Plus.

### 3.4 Zero-Shot Generalization
XSkill shows superior zero-shot transfer to unseen tasks, a direct consequence of the consolidation process replacing specific entities with variable placeholders.

---

## 4. GUS Framework Mapping

### 4.1 Validates
- **Law 18 (Abstraction Gate):** Raw experience + amplification leads to degradation. XSkill's design embodies this: raw trajectories pass through summarization, critique, consolidation, and adaptation — each step abstracts further. Raw trajectories are never directly injected.
- **Cross-Ref #47 (Capability Evolution Pipeline):** XSkill implements the complete 4-phase pipeline:
  - Expand: Multiple rollouts generate diverse trajectories
  - Abstract: Summarization + critique extract generalizable knowledge
  - Form: Skills/experiences are consolidated into structured representations
  - Evolve: Continual learning loop refines knowledge over time
- **Principle 47 (Hierarchical Evaluation Separation):** MLLMexec and MLLMkb are separate models — the model that executes does not evaluate itself.
- **DD#213 (SkillRL):** SkillRL showed raw memory + RL is a trap (21.4% < 14.8% base). XSkill confirms this by never using raw trajectories, always abstracting first.

### 4.2 Extends
- **Mechanism 17 (Echo Chamber Convergence):** Multi-path rollout strategy (N independent rollouts per task) is an explicit anti-echo-chamber mechanism.
- **DD#214 (Grow Don't Overwrite):** XSkill's knowledge consolidation is the non-parametric analog — experiences are merged, not overwritten. Function-preserving growth at the knowledge level.
- **Cross-Ref #78 (Agent Memory Lifecycle):** XSkill provides a concrete implementation of the full memory lifecycle: accumulation (write), consolidation (manage), retrieval (read), usage feedback (maintain).

### 4.3 Novel Contributions

**Proposed: The Knowledge Duality Principle**
> In continual-learning agent systems, task-level knowledge (skills/workflows) and action-level knowledge (experiences/tactics) serve complementary functions. Skills provide structural reliability (error reduction), while experiences provide adaptive flexibility (context-sensitive tool selection). Neither alone is sufficient; both are necessary.

**Proposed Prediction 86:** Systems that separate skill-level and experience-level knowledge will outperform systems that conflate them (confirmed by ablation: removing either drops performance 3-4 points with non-overlapping contribution profiles).

---

## 5. Critical Assessment

### 5.1 Strengths
1. Clean separation of concerns — dual-stream design is architecturally principled
2. Empirical rigor — 5 benchmarks, 4 models, systematic ablation, cross-model transfer
3. Visual grounding — knowledge extraction grounded in visual observations, not just text
4. Non-prescriptive injection — avoids the Scaffolding Paradox (Cross-Ref #39)
5. Consolidation mechanism — most sophisticated non-parametric knowledge management in the literature

### 5.2 Limitations
1. Single accumulation-then-test cycle tested — long-term drift effects (Law 27) untested
2. Knowledge quality assessment is model-dependent — MLLMkb judges its own outputs (Reliability Illusion risk)
3. No adversarial robustness testing — consolidation could amplify adversarial knowledge
4. Scale limits unclear — optimal experience bank size vs. task complexity not explored
5. Skills are natural-language documents, not formally verifiable specifications (Specification-to-Enforcement Gap)

### 5.3 Connection to Our System
Our agent system has knowledge files (analogous to Skills) and journal (raw trajectory log), but **lacks**:
1. Structured experience extraction from past sessions
2. Consolidation mechanism for knowledge files (they only grow — Law 27 violation)
3. Cross-rollout critique (we don't compare successful vs. failed approaches)

---

## 6. Cross-References

| Connection | Nature |
|-----------|--------|
| DD#213 (SkillRL) | Validates and extends. Abstraction-before-amplification confirmed with superior dual-stream design. |
| DD#214 (Grow Don't Overwrite) | Non-parametric analog. Consolidation = function-preserving growth at knowledge level. |
| Cross-Ref #47 (Capability Evolution Pipeline) | Concrete implementation. XSkill realizes the Expand-Abstract-Form-Evolve pipeline. |
| Cross-Ref #78 (Agent Memory Lifecycle) | Missing layer filled. XSkill provides the consolidation/management layer. |
| Cross-Ref #39 (Scalable Agent Reliability) | Decompose-Gate-Aggregate pattern confirmed. |
| Cross-Ref #53 (Knowledge Retrieval Paradox) | Partial mitigation. Non-prescriptive injection addresses retrieval-hallucination coupling. |
| Cross-Ref #80 (Convergence Failure) | Anti-convergence mechanism. Multi-path rollouts fight convergence explicitly. |

---

## 7. Key Takeaways

1. **The Knowledge Duality is real and measurable:** Skills and experiences serve complementary, non-overlapping functions.
2. **Knowledge quality > retrieval sophistication:** Phase 1 contributes 3.62-4.09 pts; Phase 2 contributes 1.28-1.52 pts. Invest in knowledge quality.
3. **Cross-model transfer works:** Externalized knowledge structures transfer across architectures without model-specific accumulation.
4. **The Abstraction Gate holds empirically:** At every stage, XSkill abstracts before using knowledge. Raw trajectories are never directly injected.
5. **Consolidation is the critical missing layer** in most agent memory systems — including ours.

---

*Filed as Deep-Dive #232. ~12KB. Extends DD#213 (SkillRL), DD#214 (Grow Don't Overwrite), Cross-Ref #47 (Capability Evolution Pipeline), Cross-Ref #78 (Agent Memory Lifecycle).*
