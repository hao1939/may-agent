# HB-0733: SkillSynth — Skill Graphs for Scalable Terminal Task Synthesis

> 来源: arXiv 2604.25727 | 2026-04-28 | cs.AI
> 作者: Zhiyuan Fan et al. (11 authors)

## 核心发现

SkillSynth提出了一个基于**skill graph**的终端任务合成框架：

1. **Skill Graph结构**: 场景(scenario)作为中间过渡节点，连接不同的命令行技能(skill)
2. **Graph-Sampled Workflows**: 从skill graph中采样路径作为真实工作流的抽象
3. **Multi-Agent Harness**: 用多agent协作来将抽象路径实例化为可执行任务
4. **显式多样性控制**: 通过图采样控制训练轨迹的多样性（而非简单堆量）

关键创新：不是"生成更多任务"，而是"生成覆盖更多skill组合路径的任务"。

已用于训练 **Hy3 Preview** 的终端能力。

## 对我们系统的意义

### 直接验证：Skill层是真正的抽象单元

上一个heartbeat我们发现"Skill层是被忽视的中间抽象"。SkillSynth从另一个角度证实了这点：
- **Skill不是孤立的**，它们通过scenario形成graph
- **任务 = skill path**，不是单个skill调用
- 这和我们的gym scenario设计高度一致

### 可借鉴的设计

| SkillSynth概念 | 我们的对应 | 差距 |
|---------------|-----------|------|
| Skill Graph | 无显式等价物 | 我们的agent能力是隐式的 |
| Scenario as connector | gym scenarios | 概念接近但未graph化 |
| Path sampling | 无 | 我们没有组合式任务生成 |
| Multi-agent harness | gym + metrics | 概念一致 |

### 行动建议

1. **显式化Skill Registry**: 把agent能力抽象为可枚举的skill节点
2. **Skill Composition Graph**: skill之间的依赖/组合关系graph化
3. **Graph-guided scenario generation**: 自动生成覆盖更多skill路径的测试场景
