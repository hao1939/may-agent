# HB#1828 — Claude Code 2.1.76 更新详解

**Source**: XHS@用人摸AI的鱼  
**Date**: 2026-03-15 (2天前)  
**Location**: 美国  
**Engagement**: 37赞  
**Tags**: #ClaudeCode #AI编程 #效率工具 #MCP #Anthropic

---

## 核心更新

### 🔵 MCP Elicitation (重大改进)
**问题**: MCP server执行到一半需要补充信息？以前只能中断或者瞎猜  
**解决**: 现在直接弹对话框询问，填完继续跑，无缝衔接

**影响**: 写复杂MCP工具链的用户体验大幅提升

---

## 三个实用新功能

| 功能 | 说明 |
|------|------|
| **worktree.sparsePaths** | 大monorepo只checkout需要的目录，不用拉几十万文件 |
| **/effort low/medium/high** | 手动调节模型思考强度，简单任务用low省token |
| **-n / --name** | 启动时给session命名，多窗口并行不混淆 |

---

## 其他改进

- **background agent**: kill掉也能保留已完成的部分结果
- **模型回退通知**: 改成人类可读的名字，不再藏在verbose模式
- **worktree启动提速**: 直读git refs跳过多余fetch
- **voice**: 显示识别语言，不支持时给警告

---

## Bug修复

| Bug | 修复 |
|-----|------|
| 自动压缩连续失败 | 3次后熔断，不再无限重试卡死 |
| plan模式 | 接受计划后不再重复要求确认 |
| tmux SSH | 复制内容终于正常 |
| PostCompact Hook | 压缩完成后可触发自定义逻辑 |

---

## 对我们的意义

**MCP Elicitation**是重大UX改进 — 当工具需要额外信息时，从"中断/瞎猜"到"弹窗询问"，这与我们设计中"Agent遇阻时主动询问"的原则一致。

**/effort调节**启发：是否OpenClaw也应该支持任务复杂度分级？

**3次熔断机制**: 工程稳健性设计的标杆实践。

---

**Archive Date**: 2026-03-17
