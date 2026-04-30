# HB-2167: Bian Que — Flexible Skill Arrangement for Online System Operations

**Source**: arXiv:2604.26805 (2026-04-29)
**Authors**: Bochao Liu et al. (KuaiShou / 快手)
**Code**: https://github.com/benchen4395/BianQue_Assistant
**Tags**: #skill-arrangement #self-evolving #operations #production

## 核心问题

大规模在线系统运维（搜索/推荐/广告）中，LLM agent的部署瓶颈**不是推理能力，而是编排**：为每个运维事件选择相关数据和适用知识。全量喂入导致稀释和幻觉，手动映射不可行。

## 三大贡献

### 1. 统一运维范式
将日常运维抽象为三种规范模式：
- **Release Interception**（发布拦截）
- **Proactive Inspection**（主动巡检）
- **Alert Root Cause Analysis**（告警根因分析）

### 2. Flexible Skill Arrangement（灵活技能编排）
每个Skill指定：
- 对于给定业务模块上下文，**检索哪些数据**
- **检索哪些知识**
- Skill可由LLM自动生成/更新
- 或由值班工程师通过自然语言指令迭代精炼

### 3. 统一自演化机制
一个纠正信号驱动两条并行路径：
- **Case Memory → Knowledge Distillation**（案例记忆→知识蒸馏）
- **Targeted Skill Refinement**（定向技能精炼）

## 生产结果（快手电商搜索引擎）

| 指标 | 改善 |
|------|------|
| 告警量 | **减少75%** |
| 根因分析准确率 | **80%** |
| 平均解决时间 | **缩短>50%** |
| 离线评估通过率 | **99.0%** |

## 对我们系统的意义

### 直接对标
1. **"Skill指定检索什么"** = 我们的skill应该声明自己的context需求，而非让harness猜测
2. **双路径自演化** = correction → (更新knowledge + 精炼skill) 并行，不是串行
3. **统一范式抽象** = 先定义agent的canonical patterns，再编排skill

### 关键洞察
- **编排>推理**：生产系统的瓶颈是"给agent看什么"而不是"agent能想什么"
- **Skill = (context_spec, knowledge_spec, action)**：不只是"做什么"，更重要的是"看什么"
- **NL指令精炼Skill**：人类可以用自然语言修正skill行为，无需改代码

### 可借鉴
- 每个skill声明 `data_needs` 和 `knowledge_needs`，harness据此做精确检索
- 自演化的双通道：错误case同时更新memory和refine skill definition
- 将运维场景的三范式思路应用到我们的agent任务分类
