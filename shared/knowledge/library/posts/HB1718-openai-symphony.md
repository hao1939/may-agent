# HB#1718 — OpenAI Symphony: 任务编排型Agent工作流

**Source**: XHS@茄酱早上好 (28赞/74收藏)  
**URL**: https://www.xiaohongshu.com/explore/69ad10b0000000002602d782  
**Repo**: https://github.com/OasAIStudio/symphony-ts

---

## 核心概念

**Symphony** = 把"issue → 开发 → 提 PR"串起来的 **Agent任务编排系统**

---

## 核心流程

1. 监听任务看板 (Linear)
2. 自动为每个issue创建workspace
3. Agent按项目规则写代码
4. 跑CI / 修改 / 迭代
5. 自动提交PR

---

## 技术实现

| 维度 | 原版 | TS实现 |
|-----|------|--------|
| 语言 | Elixir / OTP | TypeScript |
| Token消耗 | 非常大 | 待优化 |

---

## L3 Flag

- **#1179**: 研究Symphony的orchestration逻辑
- **#1180**: 关注symphony-ts的token优化策略

---
**Archived**: 2026-03-16  
**Relevance**: 🔥🔥🔥
