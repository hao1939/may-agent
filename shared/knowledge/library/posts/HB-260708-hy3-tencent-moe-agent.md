# HB-260708: Hy3 Preview — Tencent 21B Active MoE with Agent Integration

**Source**: Hugging Face Blog (Apr 23, 2026) — Tencent Hunyuan Official  
**URL**: https://huggingface.co/blog/imnotkitty/hy3-preview  
**Archived**: 2026-07-08

---

## Core Innovation

Hy3 Preview is Tencent's open-source fusion reasoning model combining fast and slow thinking with **industry-lowest activation ratio**:

| Metric | Hy3 Preview | Typical MoE |
|--------|-------------|-------------|
| Total Params | 295B | 300-400B |
| Active Params | 21B | 37-40B |
| Activation Ratio | ~7.1% | ~10-12% |

**Key Claim**: "What others achieve with 37B–40B activated parameters, Hunyuan accomplishes with just 21B."

---

## Architecture Innovations

### 1. Differentiated Expert Sizing
- Traditional MoE: All experts same size
- Hy3: Tokens of varying difficulty routed to experts with different capacities
- Small experts for simple tokens, large experts for complex reasoning

### 2. P-Penalty Loss
- Penalizes tendency to favor large experts
- Encourages activation of more small experts
- Improves computational efficiency without sacrificing performance

### 3. Context Learning
- 1M token long-context understanding
- Excels at contextual memory and comprehension

---

## Agent Integration: WorkBuddy

Hy3 is deeply integrated with Tencent's **WorkBuddy Agent**, demonstrating:

| Capability | Description |
|------------|-------------|
| Deep Search | Gather information across sources |
| Tool Calling | Retrieve literature, news, real-time info |
| Complex Reasoning | Break down multi-step problems |

### Real-World Use Case
Converting a 100+ page textbook into an interactive quiz game:
1. Extract structured knowledge from long documents
2. Generate 10 in-depth test questions
3. Package into single-file HTML with scoring/answer explanations

**Result**: Bug-free code, runs correctly first time

---

## Performance Benchmarks

Compared to MiniMax-M2.7 and Kimi-K2.5, Hy3 excels in:
- **Long-text understanding & summarization** — connects key points scattered across sections
- **Tool usage** — accurately grasps user intent, decides when/which tool to call
- **Code generation** — clean logic, few syntax errors, often works on first try

---

## Key Insight

> "The precision of routing determines the true value of these 21B activated parameters — this is a **core algorithmic moat** that cannot be overtaken simply by scaling up hardware or parameters."

**Routing precision > Brute force scaling**

---

## Development Timeline

- Architectural upgrades + infrastructure reconstruction → official release
- **Less than 3 months** total development time

Products already integrated:
- Yuanbao (general chat)
- CodeBuddy (coding assistant)
- WorkBuddy (Agent platform)

---

## What This Means for OpenClaw

| Aspect | Implication |
|--------|-------------|
| ✅ Validation | MoE + Agent integration is production-ready approach |
| ✅ Architecture | Differentiated routing could inspire Skill selection (easy/hard tasks → different skill depth) |
| ⚠️ Competition | Tencent's systematic advantage: model + tech + product + ecosystem |
| ⚠️ Efficiency | 21B active params achieving 37-40B performance — efficiency matters more than scale |

**Strategic Takeaway**: The industry is converging on "small activated parameters + smart routing" over "large dense models". Our Skill-based approach aligns with this trend.

---

## Related

- [HB-260601](HB-260601-hy3-tencent-moe-agent.md) — Earlier coverage
- [HB-260425](HB-260425-hy3-tencent-moe-agent.md) — Initial analysis
