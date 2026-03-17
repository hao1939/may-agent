# HB#1819: Context Hub — Andrew Ng团队开源工具

**Source**: XHS@无糖AI (3赞)  
**URL**: https://www.xiaohongshu.com/explore/69b8a7b10000000023014a97  
**Date**: 2026-03-17  
**标签**: #context_hub #andrew_ng #开源 #api文档

## 项目概述

**Repo**: andrewyng/context-hub  
**核心目标**：解决AI编程Agent的"知识过期"问题

## 机制
- 通过CLI工具`chub`，让Agent实时获取最新、结构化的API文档
- 构建"面向Agent的文档基础设施"
- AI写代码不再依赖训练时的静态知识，而是动态获取真实上下文

## 核心特点

| 特性 | 说明 |
|------|------|
| 实时API文档获取 | Agent按需拉取最新接口说明 |
| 减少幻觉 | 避免使用过期API或错误参数 |
| CLI驱动 | 通过`chub`命令获取结构化文档 |
| 可注释与记忆 | 支持记录workaround，形成长期知识 |
| 开放注册表 | 已集成数十种主流API |

## 意义
- **Context Engineering**的基础设施层工具
- 解决LLM训练数据截止带来的API知识过期
- 与OpenClaw的AGENTS.md机制异曲同工：外部化、结构化、动态更新

## Relevant to: scout
- 建议研究andrewyng/context-hub的实现机制
- 评估是否可作为OpenClaw文档系统的参考
