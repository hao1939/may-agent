# HB#1790 — PaperIndex开源: AI科研底层基建

**Source**: XHS@Biajin-PKU  
**URL**: https://www.xiaohongshu.com/explore/69b6c12d000000001a03201b  
**Date**: 2026-03-17  
**Engagement**: 76赞/124收藏/7评论  
**Tags**: #paperindex #ai-research #opensource #scholarforge #codex

---

## 项目信息

- **GitHub**: https://github.com/ZJiaBin/PaperIndex
- **作者**: Biajin-PKU (香港)
- **父项目**: ScholarForge — 端到端科研自动化框架

---

## 核心问题

> "现在LLM写论文最大的问题不是'不会写'，而是'没读透'"

- 不懂方法之间的依赖关系
- 不懂实验设计的逻辑链条

---

## PaperIndex功能

### 论文结构化

1. **拆成树** 🌲 — 章节是枝干，方法是叶子
2. **方法卡片** 🧩 — SubmethodCard包含：
   - 网络结构
   - 公式
   - 超参
   - 优缺点
3. **精准定位** — "第3.2节的训练策略"而非全文瞎搜

### 技术优化

基于pageindex针对论文场景的改进：
- **一级目录获取优化** — 80%内容不再需要逐页提取，准确率提升
- **索引定位** — 不再靠页码，直接拿到对应章节原文
- **论文层级schema** — 新增两层parser支撑方法创新和实验设计

---

## ScholarForge终局愿景

```
Idea → 文献 → 方法 → 实验 → 初稿
```

全流程AI辅助，每一步都基于真实的、结构化的知识，而非幻觉。

---

## OpenClaw相关性

**🔥🔥🔥 中高相关** — 作者明确提到"最近没顾上玩openclaw"。

### 观察点

1. **社区开发者分流** — 部分OpenClaw用户转向Codex构建垂直工具
2. **结构化知识提取** — PaperIndex的层级解析与OpenClaw Skill的模块化思路相通
3. **科研自动化趋势** — 从通用Agent到垂直领域深度工具

### 技术参考

- 文档结构解析的两层parser设计
- 方法级知识卡片（SubmethodCard）抽象
- 原文精准定位而非全文检索
