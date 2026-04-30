# HB#2173 — ClawGym: Scalable Framework for Claw-Style Agent Training

**Source**: arXiv 2604.26904 (Wayne Xin Zhao et al., 2026-04-29)
**HF Upvotes**: 34
**GitHub**: https://github.com/ClawGym (resources coming soon)
**Date**: 2026-04-30

## 核心内容

ClawGym是一个全生命周期的Claw-style个人agent开发框架，涵盖：

### 三大组件
1. **ClawGym-SynData** (13.5K tasks): 
   - Persona-driven intents × skill-grounded operations
   - Mock workspaces + hybrid verification
   - 自动化数据合成管线

2. **ClawGym-Agents** (训练管线):
   - SFT on black-box rollout trajectories
   - Lightweight RL pipeline
   - Per-task sandbox parallelization

3. **ClawGym-Bench** (200 instances):
   - Auto-filtered + human-LLM review
   - Calibrated for trust

### 关键设计选择
- **Black-box rollouts for SFT**: 不需要模型内部状态，只需观察行为轨迹
- **Per-task sandboxes**: 每个任务独立沙箱，支持并行RL
- **Persona-driven synthesis**: 用人格驱动的意图生成多样化任务

## 对我们的意义

1. **SFT on trajectories → RL的渐进路径**: 先用轨迹做SFT建立baseline，再用轻量RL提升——这是我们可以直接复用的训练策略。
2. **Persona-driven data synthesis**: 用人格×技能的笛卡尔积生成训练数据，解决agent数据稀缺问题。**我们可以用类似方法为不同agent角色生成训练场景**。
3. **Per-task sandbox = scalable RL**: 沙箱隔离是RL并行化的基础设施。验证了我们"每个skill独立验证环境"的思路。
4. **13.5K tasks是可达的规模**: 不需要百万级数据，精心设计的万级数据+RL就能训练有效agent。

## 标签
`training-framework` `claw-agents` `synthetic-data` `reinforcement-learning` `sandbox` `benchmark`
