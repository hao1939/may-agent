# XSkill Dual-Stream Architecture Analysis

**Source**: arXiv:2603.12056v2 [cs.AI] (13 Mar 2026)  
**Authors**: Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. (May) Fung  
**Title**: XSkill: Continual Learning from Experience and Skills in Multimodal Agents  
**Tracking ID**: HB#1564  
**Archived**: 2026-03-16

---

## Core Contribution

XSkill proposes a **dual-stream framework** that unifies two complementary forms of reusable knowledge:

| Knowledge Type | Format | Purpose | OpenClaw Mapping |
|---------------|--------|---------|------------------|
| **Skills (𝒦)** | Markdown documents | Task-level guidance for planning & tool orchestration | `SKILL.md` files |
| **Experiences (ℰ)** | JSON items (condition, action, embedding) | Action-level guidance for tool selection & decision making | `Error Log` entries |

> "Skills provide structured task-level guidance... while experiences provide concise action-level guidance tied to execution context and failure patterns."

---

## Architecture Components

### Two-Model Separation

```
┌─────────────────┐     ┌─────────────────┐
│   MLLM_kb       │     │   MLLM_exec     │
│ (Knowledge Mgr) │────→│   (Executor)    │
│  - Extraction   │     │  - Tool use     │
│  - Consolidation│     │  - Inference    │
│  - Adaptation   │     │                 │
└─────────────────┘     └─────────────────┘
         ↓                        ↓
   ┌─────────────┐          ┌──────────┐
   │  𝒦 (Skills) │          │   Task   │
   │  ℰ (Experiences)│      │ Execution│
   └─────────────┘          └──────────┘
```

| XSkill Component | Function | OpenClaw Equivalent |
|------------------|----------|---------------------|
| MLLM_kb | Knowledge management (extraction, consolidation, adaptation) | Main Agent |
| MLLM_exec | Tool-use inference | Sub-agent/Skill execution |
| Skill Library (𝒦) | Structured Markdown workflows | `agents/shared/skills/` |
| Experience Bank (ℰ) | Condition-action pairs with embeddings | Error Log entries |

---

## Knowledge Flow: The Continual Learning Loop

### Phase I: Accumulation (Learning from Trajectories)

```
Multi-Path Rollouts
       ↓
┌─────────────────┐
│ Rollout Summary │ ← Visually-grounded summarization
│ (w/ images)     │
└─────────────────┘
       ↓
┌─────────────────┐
│ Cross-Rollout   │ ← Contrastive analysis success vs failure
│ Critique        │
└─────────────────┘
       ↓
┌─────────────────┐
│ Hierarchical    │ ← Semantic deduplication & refinement
│ Consolidation   │
└─────────────────┘
       ↓
   [𝒦, ℰ] updated
```

**Key Mechanisms**:

1. **Visually-Grounded Summarization**: Extracts knowledge from interleaved image observations + trajectory text
2. **Cross-Rollout Critique**: Contrastive analysis between successful/failed trajectories to identify causal factors
3. **Hierarchical Consolidation**: Semantic deduplication via cosine similarity threshold θ_sim

### Phase II: Inference (Retrieval & Adaptation)

```
Test Task
    ↓
Task Decomposition → n_g subtasks
    ↓
Retrieval (per subtask) from [𝒦, ℰ]
    ↓
Context-Aware Visual Adaptation
    ↓
Non-Prescriptive Injection → MLLM_exec
    ↓
Usage History → Feedback to Accumulation
```

---

## Formal Definitions

### Definition 2.1: Skill
> A Skill k ∈ 𝒦 is a task-level guidance document: **k = (ℳ, 𝒲, 𝒫)**
> - ℳ: metadata (name, description, version)
> - 𝒲: workflow sequence  
> - 𝒫: reusable tool templates
> - Stored as **structured Markdown**

### Definition 2.2: Experience  
> An Experience e ∈ ℰ: **e = (c, a, v_e)**
> - c: triggering condition
> - a: recommended action
> - v_e ∈ ℝ^d: semantic embedding for retrieval
> - |c| + |a| ≤ L_max^e words

---

## Experimental Results

Across 4 backbone models on 5 multimodal benchmarks:

| Metric | Improvement over tool-only baseline |
|--------|-------------------------------------|
| Average@4 | **+2.58 to +6.71 points** |
| Challenging settings | **Up to +11.13 points** |

**Key Finding**: Skills and experiences play **complementary roles**:
- Skills improve tool-use robustness (structured planning)
- Experiences enable zero-shot cross-task transfer (context adaptation)

---

## OpenClaw Architecture Validation

| XSkill Finding | OpenClaw Design | Validation |
|---------------|-----------------|------------|
| Dual knowledge streams (task + action level) | SKILL.md + Error Log | ✅ **Exact mapping** |
| Markdown for skills, JSON for experiences | SKILL.md + Error Log format | ✅ **Format aligned** |
| Two-model separation (kb vs exec) | Main Agent ↔ Sub-agent | ✅ **Architecture aligned** |
| Cross-rollout critique for learning | External audit via Error Log | ✅ **Mechanism similar** |
| Visual grounding for retrieval | AGENTS.md context injection | ⚠️ **Gap: we lack visual** |
| Continual learning loop | Implicit via Error Log growth | ⚠️ **Gap: no automated consolidation** |

---

## Critical Design Implications for OpenClaw

### 1. Explicit Dual-Stream Architecture

XSkill validates our implicit design but suggests explicit separation:

```
Current OpenClaw:                    Proposed Evolution:
┌─────────────────┐                  ┌─────────────────┐
│   SKILL.md      │                  │   SKILL.md      │ ← Task-level (𝒦)
│  (undifferentiated)│               │   (structured)  │
└─────────────────┘                  └─────────────────┘
                                     ┌─────────────────┐
┌─────────────────┐                  │  EXPERIENCE.md  │ ← Action-level (ℰ)
│   Error Log     │        →         │  (condition-    │
│  (append-only)  │                  │   action pairs) │
└─────────────────┘                  └─────────────────┘
```

### 2. Cross-Trajectory Learning

XSkill's **Cross-Rollout Critique** suggests:
- Error Log should store not just failures but **contrasts** (what worked vs what didn't)
- Current: Linear append → Proposed: Structured comparison

### 3. Semantic Consolidation

XSkill's hierarchical consolidation suggests:
- Error Log entries should have **embeddings** for similarity-based retrieval
- Current: Text search → Proposed: Vector similarity + semantic merge

### 4. Task Decomposition Retrieval

XSkill retrieves per subtask, not per query:
- Current: Main Agent receives full context
- Proposed: Decompose → retrieve from multiple skills/experiences → synthesize

---

## L3 Flags (New)

- **#1564-A**: Evaluate explicit Experience Bank format (condition-action-embedding)
- **#1564-B**: Implement semantic consolidation for Error Log (cosine similarity dedup)
- **#1564-C**: Design cross-trajectory critique mechanism (success vs failure contrast)
- **#1564-D**: Explore task-decomposed retrieval (subtask-level skill/experience matching)

---

## Cross-Reference Network

```
HB#1564 XSkill (Dual-stream knowledge)
    ↕ Skill-experience complementarity
HB#1560 AutoSkill (SKILL.md standardization)
    ↕ Skill format standardization  
HB#1559 SSGM (Memory governance)
    ↕ Knowledge consolidation mechanisms
HB#1556 TopoBench (Error categorization)
    ↕ Experience extraction from failures
HB#1544 Reasoning LLM-as-Judge (Deception)
    ↕ Cross-rollout critique validity
```

---

## Source

- Paper: https://arxiv.org/abs/2603.12056
- Code: https://github.com/XSkill-Agent/XSkill
- Website: https://xskill-agent.github.io/xskill_page/

---

**Relevant to**: bob (dual-stream architecture), tech-lead (Error Log evolution), scout (continual learning mechanisms)

**Archive maintained by**: Amy-Kimi
