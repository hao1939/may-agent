# HB#1733 — 过去两周GitHub增长最快的AI开源项目

**Source**: XHS@Roger (31赞/62收藏)  
**Date**: 2026-03-16  
**Status**: 🔥🔥🔥🔥 高价值 — 7个项目一览，3个与OpenClaw高度相关

---

## 项目清单

### 1. 🤖 Agency Agents
**定位**: 把Claude Code变成51位AI专家+9大部门的完整团队  
**覆盖**: 产品/开发/设计/营销/QA全流程  
**价值**: "免费雇了一整家AI公司"

### 2. 🔬 Auto Research (已归档 HB#1731)
**作者**: Andrej Karpathy  
**定位**: 「科研实习生机器人」  
**流程**: 目标→自动规划实验→改代码→跑训练→看结果→再优化  
**Status**: ✅ 已单独归档

### 3. 🌐 Lightpanda
**定位**: 首个专为AI设计的无头浏览器  
**技术**: 从零构建，非Chromium  
**性能**: 比Chrome快11倍，内存少用9倍  
**场景**: 大规模爬取 + AI Agent开发

### 4. 💻 llmfit
**功能**: 一条命令告诉你哪些大模型能在你电脑上跑起来  
**评估维度**: 质量/速度/适配性/上下文  
**价值**: 告别下载几十GB却跑不动的尴尬

### 5. ⚡ CLI-Anything (HKU出品)
**定位**: 一行命令让任意软件变成AI Agent可控工具  
**覆盖**: GIMP、Blender、OBS Studio  
**成绩**: 发布3天登上GitHub Trending

### 6. 🗄️ SpacetimeDB 2.0
** claim**: 比传统数据库快1000倍的实时数据库  
**架构**: 数据库和服务器合二为一  
**Demo**: 用它做了视频通话，所有数据经数据库实时同步

### 7. 🧠 Cognee — 自改进Skill系统 ⭐最相关
**核心**: 不只是存Skill，而是让Skill能观察自己的执行历史  
**机制**:
- 自动检查失败原因
- 自动修正优化Skill
- 从静态prompt变成「会进化的活系统」

**与OpenClaw的关联**:
- 类似Error Log的失败反思机制
- 但Cognee允许运行时自改进（OpenClaw禁止）
- 可作为Skill评审系统的参考实现

---

## 关键洞察

### 趋势1: Agent基础设施井喷
过去两周7个高质量项目涌现，说明:
- Agent生态进入快速迭代期
- 基础设施层（浏览器、数据库、CLI工具）成为创新热点
- Claude Code成为事实标准，围绕它的增强项目增多

### 趋势2: Skill系统从静态到动态
Cognee代表的方向:
- 静态Prompt → 动态学习
- 被动执行 → 主动优化
- OpenClaw立场: 禁止运行时自进化，但支持离线Skill评审改进

### 趋势3: 香港高校进入Agent领域
CLI-Anything由港大出品，说明:
- 学术研究快速转化为开源工具
- Agent技术进入全球竞争阶段

---

## L3 Flags

- **#1733-1**: Lightpanda作为XHS浏览工具的潜在替代方案评估
- **#1733-2**: CLI-Anything与OpenClaw Skill系统的集成可能
- **#1733-3**: Cognee自改进机制作为Skill评审流程的参考
- **#1733-4**: llmfit用于本地模型能力评估的集成价值

---

## GitHub链接待补充

| 项目 | 搜索关键词 |
|------|-----------|
| Agency Agents | agency-agents |
| Lightpanda | lightpanda-browser |
| llmfit | llmfit |
| CLI-Anything | cli-anything HKU |
| SpacetimeDB | spacetimedb |
| Cognee | cognee |

---

**归档时间**: 2026-03-16  
**探索者**: Amy-Kimi
