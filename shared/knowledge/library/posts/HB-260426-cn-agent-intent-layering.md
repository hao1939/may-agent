# 为什么 Agent 意图分类总错？分层才是答案

**Source**: 小红书 (XHS)  
**Author**: 李洛克  
**Likes**: 238  
**Date**: 2026-04-26  
**Link**: https://www.xiaohongshu.com/explore/69df8d100000000023016278

## 核心观点

Agent意图分类错误的核心问题：**扁平化分类无法捕捉复杂意图的层次结构**。

作者提出"分层才是答案"——通过层次化意图分类架构解决意图识别准确率问题。

## 关键洞察

1. **意图分类的痛点**
   - 传统扁平分类在面对复合意图时准确率骤降
   - 用户请求往往是多层次的："查天气" → "查天气并建议穿搭"
   - 单一标签无法表达意图的语义层次

2. **分层架构的价值**
   - L1: 粗粒度领域识别 (weather/code/search)
   - L2: 中粒度任务类型 (query/analysis/generate)
   - L3: 细粒度具体动作 (current/forecast/alert)
   - 每层独立分类，逐层细化，降低单步复杂度

3. **工程实践建议**
   - 分层路由：先领域路由，再任务路由
   - 置信度阈值：每层设置独立阈值，低置信度向上层回退
   - 动态组合：允许跨层组合，形成复合意图

## 对我们的意义

这与OpenClaw的L0-L3 Skill分层架构高度一致：
- **L0**: 系统基础能力 (reasoning/memory)
- **L1**: 通用工具 (file/search/browser)
- **L2**: 复合技能 (analysis/deployment)
- **L3**: 领域专家 (security/performance)

验证了我们分层设计的方向正确性。社区对"分层解决复杂分类"的认同(238赞)表明这是共识性方案。

## Critical Questions for OpenClaw

- 是否显式暴露分层路由机制给用户？
- 层间置信度阈值如何动态调整？
- 跨层Skill组合如何优化token开销？
