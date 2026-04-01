# Research Synthesis: Agent Framework Insights
**Date**: 2026-03-17
**Source**: Amy-Kimi (XHS), Scout (ArXiv), Bob (Synthesis)

## 1. Tool-DC Paradigm (Divide-and-Conquer)
**Source**: arXiv:2603.11495 (Wuhan University / NTU)
**Insight**: A structured "Try-Check-Retry" pattern allows smaller models (7B) to outperform frontier models (o3) on complex tool use.
**Relevance**: Validates **P52 Skill Over Agent**.
**Application**: 
- Enforce schema verification (Check phase) in `manager.ts`.
- Prioritize "Skill definition" (Try phase) over "Model size".

## 2. Semantic Invariance (Scale-Robustness Inversion)
**Source**: arXiv:2603.13173
**Insight**: Larger models are *more* fragile to context distractors than smaller, specialized models. "Universal Contrastive Fragility" means irrelevant tokens actively degrade reliability.
**Relevance**: Validates **P42 Minimalism** and **P6 Growth Cycle** (isolation).
**Application**:
- Reliability requirement: Keep context windows minimal.
- Use smaller, stable models (Qwen3-30B) for specialized tasks over massive models.

## 3. Prompt Injection as Role Confusion
**Source**: arXiv:2603.12277
**Insight**: "Sounding like a role = being that role." Attackers use style mimicry to gain authority.
**Relevance**: Validates **P3 Single Voice** and **P108 Adversarial Defense**.
**Application**:
- May's unified voice is a security boundary.
- Evaluators must verify *outcomes*, not *explanations* (which can be mimicked).

## 4. Context Engineering (KV-Cache Optimization)
**Source**: Manus / LangChain
**Insight**: "KV-cache hit rate is the #1 production metric." Static prefixes are essential.
**Relevance**: Validates **P13 Harness Over Model**.
**Application**:
- Confirms our `agent-loader.ts` strategy: Static System Prompt + Volatile User Message.
- Never inject timestamps into the System Prompt.

## 5. CodeCompass (The Navigation Paradox)
**Source**: arXiv:2602.20048
**Insight**: Agents fail in large codebases because they use lexical search (`grep`) instead of structural navigation (imports/refs).
**Relevance**: Identifying tool gaps.
**Application**:
- Future Tool: `graph-nav` for Coder agent.
- Current: Explicitly prompt Coder to follow import chains.

## 6. MAST Taxonomy (Failure Modes)
**Source**: arXiv:2503.13657
**Insight**: Rigorous failure codes.
- **FM-2.6**: Reasoning-Action Mismatch ("I fixed it" but didn't).
- **FM-3.3**: Incorrect Verification (Meta-loop failure).
**Relevance**: Evaluation maturity.
**Application**:
- Adopt codes in `agents/evaluator/knowledge/criteria.md`.
- Monitor for FM-2.6 specifically.
