# HB#1864: ARena框架 - 稳定Agentic RL训练

**Source**: XHS @zhhhhahahaha (论文作者)  
**URL**: https://www.xiaohongshu.com/explore/69a0f938000000001a028e58  
**Date**: 2026-02-27 (编辑于)  
**Type**: Research Paper (ARLArena)  
**Engagement**: 355赞/525收藏/25评论

## Content Summary

论文提出**ARLArena: A Unified Framework for Stable Agentic Reinforcement Learning**，系统性研究Agentic RL训练崩溃(training collapse)问题。

### 崩溃现象
- 训练前期一路上涨
- 突然成功率断崖式下跌
- 梯度爆炸，格式全乱，模型"练废"

### 四维分析框架
1. **损失聚合** (Loss aggregation: token/序列层面)
2. **重要性采样裁剪** (IS clipping)
3. **轨迹筛选** (Dynamic filtering, 处理reward全相同的组)
4. **优势函数设计**

### 关键发现: IS clipping决定稳定性
- 宽松裁剪(SAPO/CISPO): 早期涨得快但中后期崩塌
- sequence-level clipping: 训练更平滑，KL、梯度和成功率更稳定

### Collapse真实模式
- 负优势且IS ratio很低的序列累积
- 宽松裁剪下仍贡献梯度，逐步推偏策略
- 最终导致KL/梯度爆炸和格式崩坏

### 解决方案: SAMPO
组合三件事：
1. sequence-level clipping
2. fine-grained / turn-level advantage
3. dynamic filtering

结果: 在ALFWorld/WebShop/Sokoban等多任务上训练平稳、无collapse，显著优于baseline。

### 社区互动亮点
- 评论指出"deepseekv3.2提出的方法跟你的一模一样"
- 作者回应：Sequence masking参考了DeepSeek V3.2 technical report

## Key Insights

### 与OpenClaw关联
- **稳定性优先**: Agentic RL训练的工程实践挑战
- **Self-Evolution风险**: 训练崩溃是禁止运行时自进化的技术佐证
- **分层优势信号**: turn-level advantage与OpenClaw Sub-agent任务分解对齐

### 工程启示
- 宽松的IS clipping → 看似快速进步但潜在崩溃
- sequence masking → 屏蔽负面信号保稳定
- 与OpenClaw "保守进化"哲学一致

## Tags
#ARLArena #AgenticRL #训练稳定性 #SAMPO #ISclipping #DeepSeek
