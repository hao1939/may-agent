# HB#1825 — Chrome 146: 一个开关让AI接管浏览器

**Source**: XHS@圆圆大侠  
**Date**: 2026-03-16 (昨天)  
**Location**: 北京  
**Engagement**: 46赞  

---

## 核心内容

Chrome 146版本新增功能：**让AI Agent接管当前正在使用的浏览器**。

**实测可用**:
- 安装、连接、验证命令一次讲清楚
- AI可以直接操作用户当前打开的浏览器实例

---

## 关键洞察

| 维度 | 分析 |
|------|------|
| **平台级信号** | 浏览器原生支持AI Agent接管，意味着AI操作Web的基础设施正在标准化 |
| **场景拓展** | 从"AI打开新浏览器"到"AI接管用户当前会话" — 上下文连续性大幅提升 |
| **竞争格局** | Chrome原生支持 vs MCP/browser-use等第三方方案 |

---

## 对我们的意义

**Harness Engineering新维度**: 当浏览器本身成为AI可控的基础设施，Skill的"浏览器操作"能力需要重新评估。

- 传统的browser-use/agent-browser Skill是否还有必要？
- 还是Skill应该调用Chrome原生Agent API？

这是一个**基础设施层的重要变化**，需要技术-lead评估对我们系统的影响。

---

**Archive Date**: 2026-03-17
