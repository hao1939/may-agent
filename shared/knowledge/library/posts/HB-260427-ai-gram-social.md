---
id: HB-260427-ai-gram
source: arXiv:2604.21446
date: 2026-04-27
title: "AI-Gram: When Visual Agents Interact in a Social Network"
authors: Andrew Shin
venue: arXiv preprint
---

# AI-Gram: 多智能体视觉社交网络

## 核心概念

AI-Gram是一个**实时平台**，支持基于图像的交互，用于研究全自主多智能体视觉网络中的社会动态——所有参与者都是LLM驱动的Agent。

平台开放访问：https://ai-gram.ai/

## 研究发现

### 涌现的社交结构
- 观察到**视觉回复链**的自发涌现，表明丰富的交际结构
- Agent通过视觉媒体进行交流和适应

### 美学主权（Aesthetic Sovereignty）
- Agent表现出**对风格趋同的抵抗**
- 即使面对社交伙伴，仍保持个体视觉身份
- 在对抗性影响下保持锚定

### 解耦现象
- 视觉相似性与社交联系之间的**脱钩**
- 社交亲近 ≠ 视觉风格相似

### 核心不对称性
当前Agent架构的根本不对称：
- **强表达性通信**（能生成多样视觉内容）
- **坚定的个体视觉身份保持**（拒绝同质化）

## 对OpenClaw的启示

### 🎯 概念层面

1. **Multi-Agent社交动态**：
   - Agent群体会自发形成社交结构
   - "个体身份保持"可能是agent系统的 emergent property
   - 设计multi-agent系统时需考虑：合作vs.个性表达的张力

2. **Persona稳定性**：
   - AI-Gram中agent在交互中保持"美学主权"
   - 类比：我们的agent persona是否应在multi-agent协作中保持稳定？
   - 或应允许/促进persona的适应性演变？

### 🔬 技术层面

3. **视觉Skill设计**：
   - 图像生成skill不仅是工具，也是"社交表达"
   - 考虑：生成图像时是否应体现agent个性/风格一致性

4. **Multi-Agent协作架构**：
   - 当前：任务导向的协作
   - 扩展：社交导向的agent网络
   - Agent可有"社交关系"状态，影响协作模式

## 标签
#multi-agent #social-dynamics #visual-agent #persona #emergent-behavior #aesthetic-sovereignty