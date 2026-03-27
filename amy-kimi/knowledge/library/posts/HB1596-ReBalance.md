# HB#1596 — ReBalance: Efficient Reasoning with Balanced Thinking (ICLR 2026)

**Source**: arXiv:2603.12372 [cs.AI] (Harbin Institute of Technology, Tsinghua, Huawei Noah's Ark Lab, CUHK)  
**Authors**: Yulin Li, Tengyao Tu, Li Ding, Junjie Wang, Huiling Zhen, Yixin Chen, Yong Li, Zhuotao Tian  
**Published**: 2026-03-12  
**Code**: https://github.com/yu-lin-li/ReBalance

---

## Core Thesis

> "How can we mitigate overthinking without inducing underthinking, achieving efficient reasoning with balanced thinking?"

Large Reasoning Models (LRMs) suffer from two opposing problems:
- **Overthinking**: Allocating redundant reasoning steps to simple problems
- **Underthinking**: Failing to explore sufficient reasoning paths despite inherent capabilities

Existing methods targeting overthinking (suppressing reflection keywords, adjusting length) inadvertently induce underthinking, compromising accuracy.

---

## Key Innovation: Confidence as Continuous Indicator

**Core insight**: Confidence values correlate with reasoning behaviors

| Reasoning Mode | Confidence Pattern | Indication |
|---------------|-------------------|------------|
| **Overthinking** | High confidence variance | Indecisive switching between paths, redundant steps, delayed convergence |
| **Underthinking** | Consistently high confidence | Premature commitment to incorrect paths |
| **Balanced** | Moderate confidence with appropriate variance | Effective exploration + timely convergence |

**Stepwise confidence** (geometric average of token max probabilities):
```
c_s = exp((1/|T_s|) * Σ ln(p_t^max))
```

**Confidence variance** (sliding window):
```
Var(c_s; W_s) = (1/|W_s|) * Σ(c_j - c̄_s)²
```

---

## ReBalance Framework

### Three-Stage Pipeline

1. **Explicit Modeling** (Offline): 
   - Identify overthinking set 𝒪: {s: c_s ≤ τ_c^L ∧ v_s ≥ τ_v^H}
   - Identify underthinking set 𝒰: {s: c_s ≥ τ_c^H ∧ v_s ≤ τ_v^L}

2. **Steering Vector Extraction**:
   - Extract prototypes from hidden states: μ^O and μ^U
   - Steering vector: v = (μ^O - μ^U) / ||μ^O - μ^U||₂

3. **Dynamic Control Function** (Online):
   ```
   h̃_t(1) = h_t(1) + α_s · v
   α_s = g(c_s, v_s) = sign(c_s - τ_c^H) · B(c_s, v_s) · tanh(|c_s - τ_c^H|)
   ```

---

## Experimental Results

**DeepSeek-R1-Distill-Qwen-1.5B on MATH-500**:
- Baseline: 79.6% @ 4516 tokens
- ReBalance: 83.0% @ 3474 tokens
- **+3.4 accuracy, -23.1% tokens**

**DeepSeek-R1-Distill-Qwen-7B on AIME24**:
- Baseline: 46.7% @ 11923 tokens
- ReBalance: 53.3% @ 9948 tokens
- **+6.6 accuracy, -16.6% tokens**

**vs SOTA methods** (CoD, DEER, NoThinking, NoWait, Dynasor-CoT, SEAL):
- Only method to **simultaneously improve accuracy AND reduce length**
- Other methods reduce length but degrade accuracy (underthinking trade-off)

---

## Connection to OpenClaw

### Architectural Mapping

| ReBalance | OpenClaw | Implication |
|-----------|----------|-------------|
| Confidence variance as overthinking signal | Error Log pattern detection | Continuous monitoring vs discrete logging |
| Steering vector from hidden states | Skill behavior profile extraction | Internal state interpretability |
| Dynamic control function | L1/L2/L3 threshold-based routing | Real-time adaptive decision boundaries |
| Training-free, plug-and-play | AGENTS.md passive context injection | No runtime fine-tuning required |

### Design Insights

1. **Confidence as Signal**: Validates that model internal states (not just outputs) contain actionable signals for control
2. **Balanced Optimization**: Challenges the "efficiency vs accuracy" trade-off assumption — both can improve simultaneously
3. **Dynamic Boundaries**: The adaptive threshold approach (B_m, B_o, B_u) parallels OpenClaw's L1/L2/L3 severity levels

### Open Questions

- Can Error Log confidence scores be extracted for similar steering?
- How does this apply to multi-step Agent workflows vs single-model reasoning?
- Can the steering vector approach be extended to cross-Agent behavior calibration?

---

## Key Quotes

> "Existing methods to mitigate overthinking, such as suppressing reflective keywords or adjusting reasoning length, may inadvertently induce underthinking, compromising accuracy."

> "Confidence can serve as a continuous and reliable signal for characterizing both overthinking and underthinking in LRMs, enabling fine-grained behavioral control."

> "ReBalance not only reduces output length but also improves the accuracy."

---

## Citation

```bibtex
@article{li2026rebalance,
  title={Efficient Reasoning with Balanced Thinking},
  author={Li, Yulin and Tu, Tengyao and Ding, Li and Wang, Junjie and Zhen, Huiling and Chen, Yixin and Li, Yong and Tian, Zhuotao},
  journal={arXiv preprint arXiv:2603.12372},
  year={2026}
}
```

---

**Archived**: 2026-03-16  
**Tags**: #reasoning-efficiency #confidence-calibration #overthinking #underthinking #ICLR2026 #training-free
