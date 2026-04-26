# DiffMAS: End-to-End Latent Communication for Multi-Agent Systems

**Source**: arXiv:2604.21794 (April 2026)  
**Authors**: Ye Yu, Heming Liu, Haibo Jin, Xiaopeng Yuan, Peng Kuang, Haohan Wang  
**Venue**: Under review at COLM 2026  
**Status**: 📄 Paper only, no public code yet

---

## Core Innovation

**DiffMAS** — a training framework that treats **latent communication as a learnable component** of multi-agent systems.

### The Problem with Current Multi-Agent Communication

| Approach | Limitation |
|----------|------------|
| Text-based protocols | Fixed interface, not optimized for task |
| Prior latent methods | Don't jointly optimize communication with reasoning |
| Role-based orchestration | Communication treated as implementation detail |

### DiffMAS Solution

- **Parameter-efficient supervised training** over multi-agent latent trajectories
- Agents jointly learn **how to encode AND interpret** information across interactions
- Communication happens through **key-value cache representations** instead of text

---

## Performance Results

| Benchmark | Metric | DiffMAS Result |
|-----------|--------|----------------|
| AIME24 | Math reasoning | **26.7%** |
| GPQA-Diamond | Scientific QA | **20.2%** |
| Code generation | Various | Consistent gains |
| Commonsense | Various | Consistent gains |

DiffMAS improves over:
- Single-agent inference
- Text-based multi-agent systems
- Prior latent communication methods

---

## Technical Approach

### Latent Communication via KV Caches
- Instead of: Agent A → text → Agent B
- Uses: Agent A → KV cache representation → Agent B
- Eliminates text serialization/deserialization overhead
- Richer information density than natural language

### End-to-End Training
- Supervised training on multi-agent trajectories
- Parameter-efficient (likely LoRA/adapter-based)
- Joint optimization: reasoning + communication encoding/decoding

---

## Implications for Multi-Agent Design

### 1. Text is Not Optimal
Natural language is for human communication, not agent-to-agent. Latent representations:
- Higher information density
- No ambiguity from parsing
- Direct gradient flow during training

### 2. Communication Should Be Learned
Not hand-designed protocols, but **emergent from joint training**:
- Agents develop shared encoding schemes
- Optimal for their specific task distribution
- Evolves with capability improvements

### 3. KV Cache as Interface
The same mechanism used for model attention becomes the **inter-agent communication channel**.

---

## For OpenClaw

### ⚠️ Architectural Mismatch
Our current system uses **text-based coordination** (markdown files, natural language instructions). DiffMAS suggests this is suboptimal.

### 🔬 Long-Term Research Direction
- Text coordination is good for **debuggability** and **human oversight**
- Latent communication could be **layer beneath** for high-frequency agent interactions
- Hybrid: text for human-visible, latent for agent-internal

### 🔬 Training Implications
- Our agents are not jointly trained — they're independent LLM instances
- DiffMAS benefit comes from **shared training trajectories**
- Would require fundamental architecture change to realize

### Questions
1. Should we experiment with KV-cache-based communication between agents?
2. Can we maintain debuggability while moving to latent representations?
3. Is there a hybrid: structured data (not text, not fully latent) middle ground?

---

## Related
- [HB-0027](HB-0027-sub-agents-vs-teams.md) — Claude's multi-agent coordination modes
- [HB-0029](HB-0029-tencent-multiagent-competition.md) — Multi-agent competition research
- [insights-cn.md](../insights-cn.md) — Multi-agent section

---

**Tags**: #multi-agent #latent-communication #diffmas #colm-2026 #arxiv-2604.21794
