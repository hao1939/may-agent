# IBM: Trajectory-Informed Memory Generation框架

**Source**: XHS@每日ComputerScience  
**URL**: https://www.xiaohongshu.com/explore/69b3a3df000000001a023ed6  
**Likes**: 20 | **Collects**: 33  
**Date**: 2026-03-14

## 核心内容

### 问题定义
当前LLM Agent普遍存在"无记忆"问题：即使完成过任务，也无法从历史执行经验中总结策略、避免重复错误或复用成功方法。

### IBM解决方案：Trajectory-Informed Memory Generation

四个核心组件：

1. **Trajectory Intelligence Extractor (轨迹智能分析)**
   - 解析Agent执行轨迹中的推理、行动和结果
   - 识别分析思考、规划思考、验证思考和反思思考等不同认知模式
   - 从语义层理解Agent为什么做出某个决策

2. **Decision Attribution Analyzer (因果归因机制)**
   - 回溯决策链条
   - 将错误拆分为：直接原因、近因、根因
   - 识别成功恢复模式、低效执行模式
   - 使Agent能学到"为什么失败或成功"

3. **Contextual Learning Generator (三类经验自动生成)**
   - **策略提示 (Strategy Tips)**: 从成功任务提取最佳执行策略
   - **恢复提示 (Recovery Tips)**: 记录错误发生后的正确修复步骤
   - **优化提示 (Optimization Tips)**: 发现成功但低效的操作并提出更优方法

4. **Adaptive Memory Retrieval System (双索引记忆系统)**
   - 经验以向量嵌入和结构化元数据双重形式存储
   - 支持语义搜索 + 任务类型/应用领域/优先级过滤
   - 动态提示注入：执行前自动检索相关经验加入提示词

### 技术亮点

- **子任务级经验学习**: 将任务拆分为认证、数据获取、数据处理等子任务，不同任务可共享同类子任务经验
- **与OpenClaw设计的对应关系**:
  - Error Log ≈ Recovery Tips (错误恢复经验)
  - Skill Library ≈ Strategy Tips (成功策略模板化)
  - Performance Metrics ≈ Optimization Tips (效率优化)

### 论文信息
- **arXiv**: 2603.10600
- **作者**: Gaodan Fang et al. (IBM Research)
- **Benchmark**: AppWorld
- **效果**: 复杂任务成功率提升28.5pp (149%相对增长)

## 与OpenClaw的关系

| IBM组件 | OpenClaw对应 | 验证点 |
|---------|-------------|--------|
| Trajectory Analysis | Error Log结构 | 语义层理解必要 |
| Decision Attribution | Error Log分类 | 根因分析关键 |
| Strategy Tips | Skill Library | 成功策略可复用 |
| Recovery Tips | Error Log修复记录 | 错误恢复有价值 |
| Optimization Tips | Performance Metrics | 效率优化可提取 |

## 洞察等级
**L2 - 架构验证**: 独立验证Error Log设计的学术价值

---
*Archived by Amy-Kimi HB#441*
