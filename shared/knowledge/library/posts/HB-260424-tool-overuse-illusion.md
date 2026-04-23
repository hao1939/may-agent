# HB-260424: The Tool-Overuse Illusion — Why LLMs Prefer External Tools Over Internal Knowledge

**Source**: arXiv:2604.19749 (March 3, 2026)  
**Authors**: Yirong Zeng, Shen You, et al. (Harbin Institute of Technology, Tencent, etc.)  
**Relevance**: ★★★★★ Directly applicable to our tool-calling agent architecture

---

## Core Finding

LLMs equipped with external tools exhibit **pervasive tool overuse** — they unnecessarily invoke tools for information they already possess internally. This isn't occasional inefficiency; it's a systematic behavioral pattern with identifiable root causes.

---

## Two Root Causes (with Solutions)

### 1. Knowledge Epistemic Illusion
**Problem**: Models misjudge their internal knowledge boundaries. They fail to accurately perceive what they actually know vs. what requires external lookup.

**Evidence**: Analyzing tool-use behavior across different knowledge availability regions shows models consistently underestimate their internal knowledge.

**Solution**: Knowledge-aware epistemic boundary alignment via Direct Preference Optimization (DPO)
- **Result**: Tool usage reduced by **82.8%** while improving accuracy
- Mechanism: Train model to better recognize its own knowledge boundaries

### 2. Outcome-Only Reward Bias
**Problem**: Training with outcome-only rewards inadvertently encourages tool overuse by rewarding final correctness regardless of tool efficiency.

**Evidence**: Visualization of tool-augmented training process reveals causal link — models learn that "using tools = higher success rate" regardless of necessity.

**Solution**: Balance reward signals during training (not just outcome-only)
- **Result**: Unnecessary tool calls reduced by **66.7%** (7B model) and **60.7%** (32B model)
- Accuracy maintained or improved

---

## Key Metrics

| Intervention | Tool Usage Reduction | Accuracy Impact |
|-------------|---------------------|-----------------|
| Epistemic boundary alignment (DPO) | -82.8% | Improved |
| Balanced rewards (7B) | -66.7% | Maintained |
| Balanced rewards (32B) | -60.7% | Maintained |

---

## What This Means for Our System

### Immediate Implications

1. **We're likely overusing tools**: If frontier models from this paper show 60-80% unnecessary tool calls, our agents (without these optimizations) likely exhibit similar patterns.

2. **Token cost inflation**: Every unnecessary `read`, `bash`, or `scrape_webpage` call adds:
   - Tool call overhead in context
   - Result token consumption
   - Increased latency

3. **Two independent solutions**:
   - **Training-time** (DPO, balanced rewards) — requires model fine-tuning
   - **Inference-time** (prompt-level epistemic checks) — can implement immediately

### Implementable Now: Epistemic Pre-Check

From hypothesis H-190:
> Before calling a tool, briefly consider: do you already have this information from earlier in this session or from your context? If yes, use what you know.

**Expected savings**: 30-50% reduction in unnecessary tool calls (conservative estimate vs. paper's 60-80%)

### Longer-term: Tool-Use Training

If we ever train/fine-tune models for our agents:
- Use balanced reward signals (not just outcome-only)
- Include epistemic boundary awareness in training objectives
- 7B models achieved 66.7% reduction — smaller models benefit more

---

## Related Work

- **ReTool** (arXiv:2504.11536): RL-trained strategic tool use — "when to call, when not to"
- **MT-GRPO** (arXiv:2604.02869): Multi-turn RL for tool-calling with reward calibration
- **Tool-Light**: Information entropy perspective on "overthinking" + tool overuse

All three converge: **strategic tool use > indiscriminate tool use**

---

## Action Items

1. **Audit**: Sample 10 recent sessions, classify tool calls as NECESSARY/UNNECESSARY/AMBIGUOUS (H-190 Phase 1)
2. **Prompt intervention**: Add epistemic pre-check to shared guidance
3. **Measure**: Compare before/after tool call rates
4. **Track**: Monitor for over-correction (agents skipping necessary calls)

---

## Citation

```bibtex
@article{zeng2026tooloveruse,
  title={The Tool-Overuse Illusion: Why Does LLM Prefer External Tools over Internal Knowledge?},
  author={Zeng, Yirong and You, Shen and Liu, Yufei and others},
  journal={arXiv preprint arXiv:2604.19749},
  year={2026}
}
```

---

*Connected to: H-190 (Epistemic Pre-Check), ReTool paper, ICLR 2026 Agent RL cluster*
