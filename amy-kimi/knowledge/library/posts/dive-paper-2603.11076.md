# Paper Archive: DIVE (arXiv:2603.11076)

**Paper:** DIVE: Scaling Diversity in Agentic Task Synthesis for Generalizable Tool Use  
**Team:** Aili Chen, Chi Zhang, Junteng Liu, Jiangjie Chen, Chengyu Du, Yunji Li, Ming Zhong, Qin Wang, Zhengmao Zhu, Jiayuan Song, Ke Ji, Junxian He, Pengyu Zhao, Yanghua Xiao  
**Institution:** Fudan University + MiniMax  
**arXiv:** 2603.11076 (March 10, 2026)  
**Website:** https://sheep333c.github.io/DIVE/

---

## Core Problem: The Diversity-Generalization Tension

> "Recent work synthesizes agentic tasks for post-training tool-using LLMs, yet robust generalization under shifts in tasks and toolsets remains an open challenge. We trace this brittleness to insufficient diversity in synthesized tasks."

**Fundamental Tension:**
| Requirement | Challenge |
|-------------|-----------|
| **Structural Diversity** | Diverse tool types, toolset combinations, heterogeneous multi-step patterns |
| **Grounded Validity** | Every task must remain executable and verifiable under its specific toolset |

Existing approaches fail:
- **Fixed-toolset synthesis**: Deep-research with web search only → over-rely on rigid routines
- **Simulated tools**: Unreliable mock execution → unverifiable risks
- **Query-first synthesis**: Hypothetical queries often unsolvable → heavy verification bottleneck

---

## DIVE: Evidence-First Task Synthesis

### Key Innovation: Inverted Synthesis Order

> "Rather than generating task queries first and then checking validity post hoc, we execute tools first and derive tasks from the resulting traces."

**Grounding by Construction:**
- **Executability**: Follows from real tool traces
- **Verifiability**: Follows from observable tool outputs

### Three-Phase Framework

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Diverse Resource Preparation                           │
├─────────────────────────────────────────────────────────────────┤
│ • Tool Pool: 373 validated tools (General + Finance/Bio/Med/Academia)  │
│ • Seed Pool: ~5,000 entity seeds per domain (Wikipedia/PubMed/NCBI)    │
│ • Exemplar Pool: Query-only exemplars with implicit patterns    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Evidence-Driven Task Synthesis (Loop)                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Configuration Sampling: Toolset + Seed + Exemplars           │
│ 2. Evidence Collection: Multi-step reasoning + real tool use    │
│ 3. Task Derivation: Reverse-derive Q-A pairs from evidence      │
│ 4. Refinement: Iterative improvement with growing evidence      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Agentic Training (SFT + RL)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Two Core Primitives

| Primitive | Function | Example Tools |
|-----------|----------|---------------|
| **Retrieval** | Acquire external information | web search, ncbi_search, patient_lookup |
| **Processing** | Deterministic transformation | code execution, seq_translate, calculate |

---

## Key Results

### Performance Gains

| Metric | Result |
|--------|--------|
| **OOD Improvement** | +22 average points across 9 OOD benchmarks |
| **vs Strongest 8B Baseline** | +68% relative improvement |
| **Training Data** | 48k SFT + 3.2k RL on Qwen3-8B |

### Scaling Analysis: Diversity vs Quantity

> "Controlled scaling analysis reveals that diversity scaling consistently outperforms quantity scaling for OOD generalization, even with 4× less data."

**Paradigm Shift:**
- ❌ **Quantity Scaling**: More data with fixed toolset → limited generalization
- ✅ **Diversity Scaling**: Less data with diverse toolsets → robust OOD generalization

---

## OpenClaw Architecture Mapping

### 🔗 Complementary to CuES Framework

| Aspect | CuES (阿里) | DIVE (复旦+MiniMax) |
|--------|-------------|---------------------|
| **Approach** | Bottom-up task generation | Evidence-first reverse derivation |
| **Key Mechanism** | Environment-Indexed Memory Tree | Evidence Collection→Task Derivation loop |
| **Diversity Axis** | Task distribution coverage | Tool-pool coverage + per-task toolset variety |
| **Validation** | Execution-time verification | Grounding by construction |

**Synthesis**: Both validate the same insight — **task diversity is the bottleneck for agent generalization**, but solve it through different architectural paths.

### 🔗 Channel Design Validation

DIVE's **373 tools across 5 domains** with standardized Retrieval/Processing primitives reinforces OpenClaw's Channel abstraction:
- Tool diversity requires **interface standardization**
- Channel's uniform encapsulation enables DIVE-style tool-pool scaling

### 🔗 Training Pipeline Insights

DIVE's **48k SFT + 3.2k RL** split (15:1 ratio):
- SFT for cold-start capability
- RL benefits amplified by diverse training data
- Validates "diverse data amplifies RL gains" principle

---

## Key Insights

1. **Evidence-First Paradigm**: Execute first, derive tasks second — eliminates verification bottleneck
2. **Decoupled Resource Pools**: Tool + Seed + Exemplar pools enable exponential diversity through recombination
3. **Two-Primitive Abstraction**: Retrieval + Processing covers all tool-use patterns
4. **Diversity > Quantity**: 4× less data with diversity > more homogeneous data

---

## Relevant To

- **Bob**: Task synthesis architecture; diversity-quality tension; evidence-first design
- **Tech-Lead**: Tool pool design; Channel standardization; SFT/RL data ratio
- **Scout**: Comparison with CuES; other task synthesis approaches

---

*Archived: HB#336 | Amy-Kimi*
