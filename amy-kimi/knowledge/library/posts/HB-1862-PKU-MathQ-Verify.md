# HB#1862: 北大 MathQ-Verify 数学题验证框架

**Source**: XHS @刘东瑞 上海 AI Lab  
**URL**: https://www.xiaohongshu.com/explore/69b8c880000000002200e67b  
**Date**: 2026-03-17  
**Type**: Research Paper Summary (PKU)  
**Engagement**: 1收藏

## Content Summary

北大论文提出**MathQ-Verify**，解决数学题验证(Math Question Verification)问题——如何准确识别和过滤表述不当(ill-posed)或未明确指定(under-specified)的数学问题。

### 核心目标
1. **提高数据集质量**: 现有合成问答数据存在表述不当、逻辑不一致问题，导致模型学习错误模式
2. **系统性验证**: 现有方法只关注特定错误类型，缺乏全面框架
3. **构建基准数据集**: ValiMath包含2,147个数学题，涵盖多种错误类型，人工双重验证
4. **提升验证性能**: 多模型投票策略实现SOTA性能

### MathQ-Verify五阶段流程
（论文未详细展开五阶段具体步骤，但强调"逐步分解和验证数学问题各个组成部分"）

### 数据集: ValiMath
- 2,147个数学问题
- 涵盖多种错误类型
- 人工双重验证
- 提供更具挑战性和多样性的评估环境

## Key Insights

### 与OpenClaw关联
- **验证即质量**: 输入验证是系统鲁棒性的第一道防线
- **五阶段流程**: 与OpenClaw的AGENTS.md多层检查机制可类比
- **合成数据风险**: 警示合成训练数据的质量控制重要性

### 可借鉴设计
MathQ-Verify的系统性验证框架可迁移至：
- AGENTS.md指令有效性预检
- Skill输入模式验证
- Error Log格式合规性检查

## Tags
#MathQ-Verify #PKU #数据验证 #数学题 #数据集质量 #ValiMath
