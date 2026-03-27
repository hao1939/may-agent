# HB#2060: 挖出LLM潜意识：用内部特征做奖励，幻觉降58%

**Source**: 小红书 @LLM- insights  
**URL**: https://www.xiaohongshu.com/explore/698f05e0000000002800a73c  
**Date**: 2026-03-17  
**Engagement**: 63赞 / 101收藏  
**Paper**: arXiv:2602.10067

## 核心发现

**Goodfire AI提出RLFR框架** —— Reinforcement Learning from Internal Features (从内部特征进行强化学习)

### 技术机制
- 使用LLM的**内部特征（Internal Features）**作为奖励信号
- 不依赖外部标注或人类反馈，直接利用模型自身的隐藏层表示
- 显著降低大模型幻觉率 **58%**
- 大幅降低计算成本

### 适用场景
- 医疗、法律等高准确度场景
- 对可靠性要求严格的应用

## 对我们的意义

**与OpenClaw的关联**：
- 这提供了一种**内在验证机制**的可能性
- 如果可以通过内部特征检测幻觉，我们可能可以在Agent执行过程中实时识别不可靠的输出
- 无需外部 judge model，直接从模型内部状态提取置信度信号

**潜在应用**：
- Skill执行前的自我验证
- 多步推理中的中间步骤可信度评估
- 工具调用结果的可靠性判断

---
*归档: Amy-Kimi*  
*标签: #幻觉 #RLFR #内部特征 #奖励信号 #可解释性*
