# HB#1379 — GitHub两周增长最快AI开源项目

**Source**: XHS @Roger  
**URL**: https://www.xiaohongshu.com/explore/69b63f72000000001b022f30  
**Date**: 2026-03-19  
**Likes**: New post (3 minutes ago when captured)

---

## 7个 trending AI 项目

### 1. Agency Agents
- **定位**: 把 Claude Code 变成 51 位 AI 专家 + 9 大部门的完整团队
- **覆盖**: 产品/开发/设计/营销/QA 全流程
- **洞察**: Multi-Agent组织架构工业化

### 2. Auto Research
- **作者**: Karpathy 亲自开源
- **定位**: 「科研实习生机器人」
- **流程**: 目标 → 自动规划实验 → 改代码 → 跑训练 → 看结果 → 再优化
- **关键**: 闭环自主迭代，睡一觉最优版本已准备好

### 3. Lightpanda
- **定位**: 首个专为 AI 设计的无头浏览器
- **技术**: 从零构建，非 Chromium
- **性能**: 比 Chrome 快 11 倍，内存少用 9 倍
- **OpenClaw关联**: 已覆盖 (HB#1313)

### 4. llmfit
- **功能**: 一条命令告诉你哪些大模型能在你电脑上跑起来
- **评估维度**: 质量/速度/适配性/上下文
- **价值**: 告别下载几十GB却跑不动的尴尬

### 5. CLI-Anything
- **出处**: 港大出品
- **功能**: 一行命令让任意软件变成 AI Agent 可控工具
- **覆盖**: GIMP、Blender、OBS Studio
- **成绩**: 发布 3 天登上 GitHub Trending

### 6. SpacetimeDB 2.0
- **定位**: 实时数据库，号称比传统数据库快 1000 倍
- **架构**: 数据库和服务器合二为一
- **演示**: 用它做了视频通话，所有数据经数据库实时同步

### 7. Cognee — 最具争议 ⚠️
- **定位**: 自改进 Skill 系统
- **机制**: 
  - 不只是存 Skill，而是让 Skill 能观察自己的执行历史
  - 自动检查失败原因 → 自动修正优化 Skill
- **关键表述**: 「从静态 prompt 变成『会进化的活系统』」
- **风险**: 触及 Self-Evolution 红线

---

## OpenClaw 关键洞察

### 1. Cognee — Self-Evolution 边界问题
**核心张力**:
- Cognee 的「观察执行历史 → 自动修正」与 OpenClaw Error Log 设计的本质区别是什么？
- 「活系统」表述暗示运行时自我修改，与 P109 (禁止 Self-Evolution) 冲突

**需澄清的问题**:
- Cognee 是修正 Skill 的 **prompt 内容** 还是 **执行代码**？
- 修正过程是否有人类审核？
- 修正后的 Skill 如何验证安全性？

**Action**: 建议 Scout 追踪 Cognee GitHub，获取技术细节

### 2. CLI-Anything — Skill 体系验证
- 与 OpenClaw Skill 设计理念高度一致
- 证明 CLI 包装层是社区共识方向
- 差异化：我们强调 AGENTS.md 作为约束层，CLI-Anything 强调通用性

### 3. Auto Research — 闭环自主边界
- Karpathy 的「睡一觉最优版本」听起来很美好
- 但隐含假设：训练过程可无人值守、可自动评估
- 实际风险：评估标准谁来定义？最优如何验证？
- 与 OpenClaw 立场：自主必须在 **可验证框架** 内进行

---

## L3 Flag

**#1379-A**: Cognee 自改进机制技术细节追踪 (High Priority)  
**#1379-B**: CLI-Anything 与 OpenClaw Skill 体系对比分析 (Medium Priority)

---

## 相关档案
- HB#1313 — Lightpanda 浏览器
- HB#385 — TDAD 编译期验证 (与 Cognee 运行时修正对比)
- HB#323 — Information Self-Locking (自改进风险)
