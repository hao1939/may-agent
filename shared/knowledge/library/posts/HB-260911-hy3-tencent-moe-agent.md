# HB-260911: Hy3 Preview — Tencent 21B-Active MoE with Routing Precision as Algorithmic Moat

**Source**: Hugging Face Blog (April 23, 2026) — Tencent Hunyuan Official  
**Author**: Leco Li (imnotkitty)  
**Status**: Preview release, integrated into Yuanbao/CodeBuddy/WorkBuddy

---

## Core Specs

| Metric | Value |
|--------|-------|
| Total Parameters | 295B |
| Active Parameters | 21B (~7.1% activation ratio) |
| Architecture | Differentiated Expert Size MoE |
| Training Time | <3 months (architecture rebuild → release) |

**Key Claim**: "What others achieve with 37B-40B activated parameters, Hunyuan accomplishes with just 21B."

---

## Architecture Innovations

### 1. Differentiated Expert Sizing
Unlike traditional MoE where all experts are same size, Hy3 routes tokens of **varying difficulty to experts with different capacities**:
- Simple tokens → smaller, faster experts
- Complex tokens → larger, more capable experts
- Result: Same compute budget → significantly better performance

### 2. P-Penalty Loss
- Penalizes model's tendency to favor large experts
- Encourages activation of more small experts
- Improves computational efficiency without sacrificing performance

### 3. Context Learning
- Excels at contextual memory and understanding
- Deep search integration for actionable planning
- Tool calling for real-time information retrieval

---

## Agent Integration: WorkBuddy

Tencent's self-developed AI Agent demonstrates Hy3 capabilities:

**Test Case**: 100-page technical manual → 10-question interactive HTML quiz game

| Capability | Hy3 Performance |
|------------|-----------------|
| Long-text understanding | Accurate extraction from lengthy documents |
| Multi-instruction following | Breaks complex tasks into logical steps |
| Code generation | Bug-free, runs correctly first time |
| Tool usage | Accurate timing + result processing |

**Comparison with MiniMax-M2.7 and Kimi-K2.5**: Hy3 excels in three key areas:
1. Long-text understanding & summarization
2. Tool usage accuracy
3. Code generation reliability

---

## Benchmarks

| Area | Performance |
|------|-------------|
| Complex reasoning | Significantly enhanced |
| Coding | Notable improvements |
| Long-context understanding | Comprehensive improvement |
| Agent capabilities | Significant gains |
| Mathematical reasoning | Improved |

---

## Strategic Positioning

**Hunyuan's Philosophy**: Not blindly pursuing larger parameter counts — emphasizing:
- Data quality
- Architectural innovation
- Co-Design with core businesses (social, gaming, advertising)

**Infrastructure**: Cloud-native "sandbox" supporting hundreds of thousands of concurrent requests

**Key Quote**: "The precision of routing determines the true value of these 21B activated parameters — this is a core algorithmic moat that cannot be overtaken simply by scaling up hardware or parameters."

---

## For OpenClaw

### ✅ Validation
- **Differentiated routing**: Intent complexity → Skill depth mapping validated
- **Architecture innovation > brute force**: 21B active competing with 37-40B
- **Systematic advantage**: Model + tech + product + ecosystem synergy

### ⚠️ Considerations
- Routing precision as core competency — how do we measure Skill routing accuracy?
- Cloud-native sandbox infrastructure for concurrent execution
- Integration with enterprise business systems (social/gaming/advertising parallels)

### 🔬 Research Questions
- Can we implement difficulty-aware Skill routing (simple tasks → fast path, complex → deep reasoning)?
- How do we prevent "large expert bias" in Skill selection?

---

## Related
- [HB-260425-hy3-tencent-moe-agent.md](HB-260425-hy3-tencent-moe-agent.md) — Earlier coverage
- DeepSeek-V4 (HB-260801) — Context compression alternative path
- Tencent WorkBuddy — Enterprise agent integration reference
