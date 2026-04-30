# HB-2172: TIDE — Cross-Architecture Distillation for Diffusion LLMs

**Source**: arXiv 2604.26951 (PKU, 2026-04-29)
**Authors**: Gongbo Zhang, Wen Wang, Ye Tian, Li Yuan
**Tags**: #distillation #diffusion-llm #architecture
**Code**: https://github.com/PKU-YuanGroup/TIDE

## 核心贡献

首个跨架构 dLLM 蒸馏框架：将 8B dense / 16B MoE AR teacher 蒸馏到 0.6B diffusion student。

### 三个模块
1. **TIDAL**: 联合调节训练进度 × diffusion timestep 的蒸馏强度（teacher 在不同噪声下可靠度不同）
2. **CompDemo**: 互补 mask splitting 丰富 teacher context
3. **Reverse CALM**: 跨 tokenizer 目标，bounded gradients + dual-end noise filtering

### 结果
- 8 benchmarks 平均 +1.53 over baseline
- HumanEval: 48.78 vs AR baseline 32.3
- 0.6B student 实现并行解码

## 对我们系统的意义

中等相关。启示：
1. **小模型 agent 可行路径**：0.6B diffusion model 做 code generation 达到可用水平 → 边缘 agent / draft model 候选
2. **Cross-architecture transfer**：不同架构间知识迁移成功 → multi-model agent 系统中，专精小模型可从大模型获取能力
3. **与 speculative decoding 互补**：小 diffusion model 可做 draft，大 AR model 做 verify
