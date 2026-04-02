# Deep Dive: arXiv 2603.12056 — XSkill: Continual Learning from Experience and Skills in Multimodal Agents

**Paper:** "XSkill: Continual Learning from Experience and Skills in Multimodal Agents"
**Authors:** Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. (May) Fung
**ArXiv:** [2603.12056](https://arxiv.org/abs/2603.12056) — March 12, 2026
**Venue:** ICML 2026 (submitted)
**Area:** Multimodal agents, continual learning, training-free knowledge accumulation, tool use

---

## Summary

XSkill proposes a **dual-stream framework** for training-free continual learning in multimodal agents. The key insight: agents need two complementary forms of reusable knowledge:
1. **Experiences** — concise, action-level tactical guidance for tool selection and error recovery
2. **Skills** — structured, task-level workflows and reusable tool templates for planning

Both knowledge streams are **visually grounded** (critical for multimodal settings where decision signals are embedded in images, not just text) and organized in a **continual learning loop** where usage history feeds back into knowledge refinement.

---

## Architecture

### Two-Phase Design

**Phase I: Accumulation** (Knowledge Extraction)
1. **Multi-path rollouts:** For each training task, the execution model (MLLM_exec) performs N independent rollouts
2. **Rollout Summary:** A knowledge-base model (MLLM_kb) performs visually-grounded summarization, receiving interleaved image observations + trajectory text to extract:
   - Trajectory summaries with key decision points, tool usage patterns, failure reasons
   - Skill fragments (workflow sequences, reusable code templates)
3. **Cross-Rollout Critique:** Contrastive analysis between successful and failed trajectories to identify causal factors, producing structured experience updates (add/modify operations)
4. **Hierarchical Consolidation:**
   - Experiences: Similarity-based deduplication (cosine > θ_sim → merge), quality filtering when bank exceeds N_max
   - Skills: Fragments integrated into global skill document; refinement triggered when document exceeds L_max

**Phase II: Inference** (Knowledge Application)
1. **Task Decomposition Retrieval:** Decomposes test task into n_g abstract subtasks (e.g., "dark image handling," "geometric comparison"), retrieves top-k experiences per subtask via semantic similarity
2. **Experience Rewriting:** Context-aware rewriting adapts generic experiences to current visual state (e.g., "normalize orientation" → "rotate upside-down image before detection")
3. **Skill Adaptation:** Prunes irrelevant workflow sections, integrates rewritten experiences, adjusts code templates
4. **Non-prescriptive Injection:** Adapted knowledge injected as system prompt reference, not rigid instructions — agent retains improvisation flexibility
5. **Usage History Feedback:** Records which skills/experiences were actually used, feeding back to accumulation phase

### Key Design Choices
- **Separation of MLLM_exec and MLLM_kb:** Allows stronger model for knowledge management while keeping execution model flexible; enables **cross-model knowledge transfer**
- **POMDP formulation:** Visual observations provide only partial information about task state — formalized as Partially Observable MDP
- **Markdown skills + JSON experiences:** Skills stored as structured Markdown documents (metadata, workflow, tool templates); experiences as JSON entries (condition, action, embedding vector)

---

## Results

### Benchmarks (5 across 3 domains)
- **Visual Agentic Tool Use:** VisualToolBench, TIR-Bench
- **Multimodal Search:** MMSearch-Plus, MMBrowseComp
- **Comprehensive:** AgentVista

### Performance (Average@4 across 4 rollouts)
| Model | w/ Tools | Best Baseline | XSkill | Δ vs baseline |
|-------|----------|---------------|--------|----------------|
| Gemini-2.5-Pro | 23.87 | 24.99 (Agent-KB) | **28.63** | +3.64 |
| Gemini-3-Flash | 33.63 | 34.88 (Agent-KB) | **40.34** | +5.46 |
| GPT-5-mini | 20.61 | 20.87 (Agent-KB) | **23.19** | +2.32 |
| o4-mini | 19.56 | 20.82 (AWM) | **23.72** | +2.90 |

### Key Findings
- **Consistent improvement:** 2.58–6.71 points Average@4 over tool-only baseline across all models
- **TIR-Bench standout:** Gemini-3-Flash achieves 47.75% vs. 36.62% (Agent-KB), an 11.13-point gain
- **Cross-model transfer works:** GPT-5-mini and o4-mini use knowledge accumulated by Gemini-3-Flash and still improve substantially
- **Both streams essential:** Ablation shows removing experiences costs 3.04 points, removing skills costs 3.85 points
- **Phase 1 > Phase 2:** Knowledge quality (accumulation) matters more than retrieval mechanism, though both necessary

### Complementary Roles
- **Skills reduce errors:** Overall error rate drops from 29.9% to 15.3%; syntax errors from 20.3% to 11.4%; tool name errors nearly eliminated
- **Experiences shift tool selection:** Code interpreter usage increases from 66.63% to 76.97% on VisualToolBench; image search doubles on MMSearch-Plus — experiences capture task-specific tactical knowledge for adaptive tool selection

---

## Relevance to Our Research

### Direct Connections
- **Agent memory architecture:** XSkill's dual-stream (experiences + skills) is the most sophisticated training-free memory architecture we've seen for multimodal agents. Directly relevant to our memory/persistence track.
- **Multi-agent knowledge transfer:** Cross-model transfer (Gemini → GPT-5-mini/o4-mini) demonstrates that externalized knowledge structures are model-agnostic — a key finding for multi-agent systems where different agents may use different backbone models.
- **Continual learning without parameter updates:** The knowledge accumulation loop provides a concrete mechanism for the "agent improvement" problem without fine-tuning.

### Cross-References
- **2603.11768 (SSGM):** SSGM's structured skill graphs share the "reusable workflow" concept but lack the experience stream and visual grounding that makes XSkill effective
- **Agent Workflow Memory (AWM, Wang et al. 2024):** XSkill directly outperforms AWM, showing that dual-stream > workflow-only approaches
- **2603.11228 (Markovian Generation Chains):** MGC's sequential generation pattern could benefit from XSkill's experience-guided tool selection
- **2603.11126 (Value Alignment via CFA):** CFA's cooperative fine-tuning could incorporate XSkill's accumulated knowledge as alignment signals
- **Dynamic CheatSheet (Suzgun et al.):** XSkill outperforms DC, suggesting that dual-stream knowledge > evolving memory of strategies

### Novel Insights
1. **Visual grounding is critical for multimodal knowledge:** Text-only trajectory logs miss the decision signals embedded in visual observations — grounding in images is what enables XSkill to outperform prior work
2. **Non-prescriptive injection:** Injecting knowledge as reference rather than rigid instruction preserves agent autonomy — a design principle applicable to all agent augmentation
3. **Quality > retrieval:** Phase 1 (accumulation quality) contributes more than Phase 2 (retrieval precision) — invest in better knowledge extraction, not better search
4. **Cross-model knowledge transfer:** Externalized, structured knowledge stores can bridge different model architectures — practical for heterogeneous multi-agent deployments

---

## Limitations
- **Single accumulation cycle:** While described as "continual," experiments use one accumulation-then-test cycle; true iterative refinement over many rounds is not empirically validated
- **100-task training sets:** Relatively small accumulation pools; unclear how knowledge quality scales with larger/more diverse training sets
- **MLLMkb bottleneck:** Requires a "stronger model" for knowledge management — cost and availability constraints
- **No adversarial evaluation:** How robust is the accumulated knowledge to distribution shifts or adversarial inputs?
- **Limited to tool-use agents:** Framework assumes agents interact via discrete tool calls; unclear applicability to continuous-action agents

---

## Bottom Line
**Rating: HIGH RELEVANCE (8/10)**

XSkill represents the state of the art in training-free knowledge accumulation for multimodal agents. The dual-stream architecture (experiences for tactical flexibility + skills for structural robustness) is a clean, well-validated design. The cross-model transfer finding is particularly important for multi-agent systems. The visual grounding innovation addresses a genuine gap in prior work. Key contribution to the agent memory/learning track of our portfolio.
