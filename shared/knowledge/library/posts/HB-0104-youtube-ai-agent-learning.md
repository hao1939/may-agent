# YouTube AI Agent 学习资源汇总

**Source:** 小红书 (69cf2f5500000000220024b2)  
**Author:** 无糖冰美式  
**Date:** 2026-04-03  
**Tags:** #AI-Agent #Learning-Resources #Multi-Agent

---

## 概述

作者分享了6个YouTube上优质的AI Agent学习频道，从入门到进阶，涵盖理论、实践和底层实现。

---

## 推荐频道详解

### 1. Mu Li (李沐) | 亚马逊首席科学家
- **内容:**《动手学AI Agent》
- **特点:** 
  - 使用PyTorch搭建多Agent框架
  - 包含任务调度、实时决策完整代码
  - Jupyter Notebook可直接运行
  - 逐句讲解《AutoGPT》《ReAct》论文
  - 深入解析Agent记忆流、工具调用逻辑
- **适合人群:** 想动手实操的开发者

### 2. Hung-yi Lee (李宏毅) | 台湾大学教授
- **内容:**《AI Agent系统设计2025》
- **特点:**
  - 用"复仇者联盟"比喻多Agent配合
  - 用"哈利波特守护神咒"解释工具调用
  - 可在Colab搭建旅行Agent（查地图、订机票）
- **适合人群:** 零基础入门者

### 3. Andrej Karpathy | OpenAI创始成员
- **内容:** 4小时从零手写AutoGPT
- **特点:**
  - 递归任务分解全流程还原
  - GitHub热榜代码逐行解析
  - VS Code断点调试Agent死循环
  - 深入底层逻辑
- **适合人群:** 硬核技术玩家

### 4. Hugging Face官方频道
- **内容:** 10小时Transformers Agent课程
- **特点:**
  - 部署自己的AutoGPT
  - 多Agent竞拍系统
  - 股票机器人实战
  - GPU资源优化、API限流破解技巧
- **适合人群:** 想系统掌握框架的开发者

### 5. Andrew Ng (吴恩达) | DeepLearning.AI
- **内容:** Agent决策树可视化
- **特点:**
  - 用Excel表格演算Agent决策树
  - 任务分解和选择过程全可视化
  - 《Multi-Agent博弈系统》教本地部署类AutoGPT集群
- **适合人群:** 逻辑控、系统设计者

### 6. MIT Efficient ML (韩松 | MIT教授)
- **内容:** 边缘计算Agent部署
- **特点:**
  - Llama3驱动的Agent塞进树莓派
  - 量化后仅2GB内存
  - 嵌入式/轻量化AI应用实践
- **适合人群:** 边缘计算、嵌入式开发者

---

## 对我们的意义

1. **学习路径清晰化** - 从李宏毅入门→李沐实践→Karpathy深入→HF系统学习
2. **多Agent协作参考** - 李沐和Andrew Ng的内容直接相关我们的多Agent架构
3. **工具调用理解** - 各频道对ReAct、AutoGPT的解析有助于优化我们的工具系统
4. **轻量化部署思路** - 韩松的边缘计算实践对资源优化有参考价值

---

## 行动建议

- [ ] 团队内部分享：每人选择一个频道深入学习
- [ ] 提取多Agent编排模式：整理李沐课程的框架设计
- [ ] 评估边缘部署：研究韩松的量化技术是否可用于我们的场景
