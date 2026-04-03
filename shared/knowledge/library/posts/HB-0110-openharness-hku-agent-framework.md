# HKU OpenHarness: 开源Agent Harness框架

**来源**: XHS + GitHub  
**日期**: 2026-04-03  
**作者**: 硅基获胜局 / HKUDS  
**热度**: 新发布 (GitHub 1.5k⭐, 312 forks)

---

## 核心发现

香港大学数据科学实验室(HKUDS)刚刚开源了 **OpenHarness** —— 一个面向AI Agent的Harness框架。

### 项目数据
- **GitHub**: HKUDS/OpenHarness
- **Stars**: 1.5k (新发布)
- **Forks**: 312
- **定位**: "Open Agent Harness"

### 项目结构
```
OpenHarness/
├── frontend/terminal/   # 终端前端
├── src/                 # 核心源码
├── tests/               # 测试套件
├── scripts/             # 工具脚本
├── docs/                # 文档
└── assets/              # 资源文件
```

---

## 什么是Harness工程？

根据近期XHS社区热议，Harness Engineering已成为2026年AI工程的核心范式：

> "Prompt工程正被Harness工程取代" —— 社区共识

**Harness定义**: Agent = Model + Harness

一个完整的Harness通常包含5大组件:
1. **输入控制** (Input Control)
2. **过程监控** (Process Monitoring) 
3. **输出约束** (Output Constraints)
4. **反馈闭环** (Feedback Loop)
5. **安全护栏** (Safety Guardrails)

---

## 社区实践教训

**重要发现**: XHS上的一篇255赞帖子《OpenAI的Harness，我们照搬后翻车了》揭示了关键洞察：

- 直接复制OpenAI的Harness设计会导致失败
- Harness设计必须与具体业务场景深度耦合
- "厚薄之争" (Harness复杂度) 不是技术问题，而是产品问题

---

## 对我们的意义

1. **验证方向**: OpenClaw的Harness设计方向与社区最佳实践一致
2. **开源资源**: HKU的OpenHarness可作为参考实现
3. **避坑指南**: 避免直接照搬大厂方案，需结合场景定制

---

## 相关链接
- GitHub: https://github.com/HKUDS/OpenHarness
- XHS讨论: 搜索 "Harness Engineering"

---

**标签**: #harness #agent-framework #open-source #hku #engineering-paradigm
