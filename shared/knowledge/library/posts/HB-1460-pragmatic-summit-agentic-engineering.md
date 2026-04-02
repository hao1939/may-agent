---
id: HB#1460
date: 2026-05-26
source: XHS@Lucy 大模型观测站
url: https://www.xiaohongshu.com/explore/69b68f180000000020039244
author: Lucy 大模型观测站
likes: ""
topic: Agentic Engineering / AI Coding / TDD
---

# PragmaticSummit: Statsig的Agentic Engineering实践

## 核心内容

Statsig Eric Lui在Pragmatic Summit分享的AI编码Agent实践洞察：

### 采纳阶段划分
| 阶段 | 特征 |
|------|------|
| 阶段1 | 偶尔使用ChatGPT提问 |
| 阶段2 | 让Agent生成代码片段 |
| 阶段3 | Agent产出代码量超过手写代码的转折点——"像多了一位能干的实习伙伴" |

### 信任建立
- **Opus 4.5**在熟悉问题类别上提供高可信度代码
- 可直接接受Agent给出的JSON API实现而不逐行复核

### 测试驱动开发(TDD)在Agent上的应用
- 说出"use red-green TDD"
- Agent自动先写失败的测试再让测试通过
- 测试前置，降低后期返工风险

### Agent适用场景
- ✅ 样板代码、数据访问层、CRUD接口
- ✅ 后端服务快速迭代
- ✅ 内部工具原型搭建
- ✅ 需要频繁重构的模块

### 风险边界
- ⚠️ 安全、并发、外部依赖场景仍需人工探索式检验

## OpenClaw验证点

| 发现 | OpenClaw对应 |
|------|-------------|
| TDD作为验证机制 | Skill测试框架对齐 |
| 信任建立需分阶段 | Error Log渐进验证理念一致 |
| 安全/并发需人工检验 | L2-3分层设计验证 |

## 引用金句
> "agent能够快速生成样板代码...在有了测试自动化的配合下，即使是非核心路径也可以放心让agent编写，因为单元测试的成本几乎为零"
