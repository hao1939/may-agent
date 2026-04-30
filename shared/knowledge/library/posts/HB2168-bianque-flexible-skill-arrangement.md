# HB#2168 — Bian Que: Flexible Skill Arrangement for Online System Operations

- **Source**: arXiv:2604.26805 (KuaiShou, 2026-04-29)
- **GitHub**: https://github.com/benchen4395/BianQue_Assistant
- **Tags**: #skill-arrangement #self-evolving #ops-agent #production

## 核心贡献

Bian Que是快手搜索引擎运维的agent框架，核心创新是**Flexible Skill Arrangement**：

1. **统一运维范式**：将日常O&M抽象为3种canonical patterns — 发布拦截、主动巡检、告警根因分析
2. **Flexible Skill Arrangement**：每个Skill指定在给定业务模块上下文中检索哪些数据和知识；Skill可由LLM自动生成，也可由oncall工程师通过自然语言指令迭代优化
3. **统一自演化机制**：一个correction signal同时驱动两条路径 — case memory→knowledge蒸馏 + 定向Skill refinement

## 生产结果

- 告警量减少75%
- 根因分析准确率80%
- MTTR降低50%+
- 离线评估99.0% pass rate

## 对我们的意义

**这是skill self-evolution在生产环境的最强实证之一**。关键设计：

1. **Skill = (context → data + knowledge) mapping**：不是"能力"而是"在什么情况下取什么信息"——这和我们的skill概念高度一致
2. **双路径自演化**：correction同时改memory和改skill本身——我们可以复制这个模式：一次失败同时触发trace归档 + skill refinement
3. **canonical patterns先于skill**：先定义3种操作模式，再在模式内组合skill——先有harness再有skill
4. **人在回路的skill refinement**：oncall用自然语言修正skill，不需要改代码——我们的skill编辑界面应该支持这个

## 关键引用

> "The deployment bottleneck is not reasoning capability but orchestration: selecting, for each operational event, the relevant data and the applicable operational knowledge."
