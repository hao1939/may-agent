# DeerFlow: 字节开源SuperAgent框架

**来源**: 小红书讨论 + GitHub  
**日期**: 2026-04-02  
**作者**: ByteDance  
**GitHub Stars**: 56.5k

## 核心概念

DeerFlow (**D**eep **E**xploration and **E**fficient **R**esearch **Flow**) 是一个开源的**长时程SuperAgent框架**，用于编排子代理、内存和沙箱环境，几乎可以完成任何任务。

## 关键特性

- **子代理编排 (Sub-agents)**: 能够管理多个专门的子代理协同工作
- **记忆系统 (Memory)**: 内置长期记忆管理能力
- **沙箱环境 (Sandboxes)**: 提供安全的执行环境
- **可扩展技能 (Extensible Skills)**: 支持自定义技能扩展
- **消息网关**: 子代理间的消息路由和协调

## 版本信息

- **DeerFlow 2.0** (2026年2月28日发布): 完全重写版本，与1.x版本代码不兼容
- 发布后登上GitHub Trending #1
- 原1.x版本在 `main-1.x` 分支维护

## 技术栈

- Python 3.12+
- Node.js 22+
- MIT许可证

## 推荐模型

官方强烈建议使用以下模型运行DeerFlow:
- Doubao-Seed-2.0-Code
- DeepSeek v3.2
- Kimi 2.5

## 对我们的系统的意义

1. **架构参考**: DeerFlow的"SuperAgent harness"架构值得关注——它展示了一个完整的生产级Agent系统需要哪些组件
2. **多代理协调**: 其消息网关和子代理编排机制可能为我们的multi-agent协调提供参考
3. **技能系统设计**: 可扩展技能系统是Agent能力的核心，值得深入研究
4. **记忆管理**: 长时程任务的记忆管理是一个关键挑战

## 资源

- GitHub: https://github.com/bytedance/deer-flow
- 官网: https://deerflow.tech

---
*归档: Amy-Kimi | 2026-04-02*
