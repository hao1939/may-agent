# HB#1434 — Harness Engineering: 从Prompt到护栏的三阶进化

**Source**: XHS@lonly[大数据+AI]  
**URL**: https://www.xiaohongshu.com/explore/69b66e62000000002300452e  
**Date**: 2026-05-23 (posted 1小时前)  
**Tags**: #HarnessEngineering #AIAgent #AICoding

---

## 核心论点

作者提出AI交互方式的三阶段进化论：

| 阶段 | 名称 | 核心隐喻 | 解决的问题 |
|------|------|----------|------------|
| 1 | Prompt Engineering | 对马喊话 | 单次任务指令 |
| 2 | Context Engineering | 给马地图 | 信息缺失问题 |
| 3 | **Harness Engineering** | **修带护栏的高速路** | **兜住AI下限** |

---

## Harness Engineering 三要素

### 1. 装上手脚（工具执行）
AI只会吐文字，Harness给它接上文件系统和命令行。AI写完脚本，Harness替它跑，跑完把结果喂给它看。

### 2. 建防撞护栏（强约束与反馈）⭐核心
> "AI写完代码，Harness绝不会直接让过，而是自动跑测试用例。**只要报错，Harness会立刻把错误日志'甩'给AI，强制它重写，直到跑通为止。**"

就像公路两边的护栏，只要AI跑偏，就硬生生把它弹回正轨。

### 3. 外包记忆（状态管理）
长线任务AI容易忘事。Harness会在外部建一个"工作进度表"，每次干下一步前，强迫AI先读档，防止陷入死循环。

---

## 关键洞察

> "以前AI出错，我们总以为是提示词没写好；而在 Harness 时代，AI出错是个'系统工程问题'——说明你的测试环境和护栏没搭好。"

**Prompt** = 告诉AI"去哪"  
**Context** = 给AI"看啥"  
**Harness** = 给AI造一条"**哪怕它犯迷糊也偏离不了的自动化流水线**"

---

## 与OpenClaw的对应验证

| Harness概念 | OpenClaw实现 | 匹配度 |
|-------------|--------------|--------|
| 装上手脚 | Skill System | ✅ 直接对应 |
| 建防撞护栏 | Error Log + read_by追踪 | ✅ 完全对齐 |
| 外包记忆 | AGENTS.md被动上下文 | ✅ 设计理念一致 |
| 护栏强制弹回 | Trust Chain多层验证 | ✅ 机制对应 |

---

## 标签
L2-架构洞察, OpenClaw验证, 社区共识形成
