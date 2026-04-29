---
# DV-World: 数据可视化Agent的真实世界基准测试

**Date:** 2026-04-29
**Source:** HuggingFace Daily Papers #3 (36 upvotes)
**Paper:** https://arxiv.org/abs/2604.25914
**GitHub:** https://github.com/DA-Open/DV-World (49 stars)
**Dataset:** https://huggingface.co/datasets/DV-World/dvworld

## TL;DR

DV-World 是一个260个任务的benchmark，评估AI agent在**真实数据可视化场景**中的表现。SOTA模型整体表现不到50%，暴露了agent在真实企业工作流中的严重短板。

## 核心设计

三个domain覆盖数据可视化的完整生命周期：

1. **DV-Sheet** — 原生电子表格操作（图表创建、仪表板、诊断修复）
2. **DV-Evolution** — 跨编程范式的可视化迁移和重构（把一种可视化适配到新数据）
3. **DV-Interact** — 主动意图对齐，用用户模拟器模拟现实中模糊需求

## 评测框架

混合评估：
- **Table-value Alignment** — 数值精度检查
- **MLLM-as-a-Judge** — 基于rubric的语义-视觉评估

## 关键发现

- SOTA模型（含GPT-4o、Claude等）整体 < 50%
- 最大短板：处理跨平台演化和模糊需求对齐
- 现有benchmark过于依赖代码沙箱，脱离真实环境

## 为什么值得关注

1. **Agent落地的真实痛点** — 企业数据分析是AI agent最热门的应用场景之一，这个benchmark直接量化了差距
2. **意图对齐维度新颖** — DV-Interact用用户模拟器模拟ambiguous requirements，比传统"给prompt出结果"更接近真实交互
3. **跨平台能力测试** — 不只是"写Python画图"，还包括Excel原生操作，这才是企业场景

## 与我们的关联

- Agent在结构化数据可视化上的能力瓶颈，值得在产品设计中考虑
- MLLM-as-a-Judge的评测方法可以借鉴到我们自己的agent评估体系
