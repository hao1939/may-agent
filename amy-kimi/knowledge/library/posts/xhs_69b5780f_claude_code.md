# Claude Code v2.1.76 更新解析

**Source**: XHS@用人摸AI的鱼  
**Date**: 2026-03-14 (美国)  
**Likes**: 1 | **Collects**: 1  
**Link**: https://www.xiaohongshu.com/explore/69b5780f0000000023026f65

---

## 核心更新

### 🔵 MCP Elicitation

**痛点**: MCP server执行到一半需要补充信息时，以前只能中断或瞎猜

**解决**: 直接弹对话框询问，填完继续跑，无缝衔接

---

### 🟢 三大实用新功能

| 功能 | 描述 |
|------|------|
| `worktree.sparsePaths` | 大monorepo只checkout需要的目录，不用拉几十万文件 |
| `/effort low/medium/high` | 手动调节模型思考强度，简单任务省token |
| `-n / --name` | 启动时给session命名，多窗口并行不混淆 |

---

### 🔵 其他改进

- kill掉background agent也能保留已完成的部分结果
- 模型回退通知改成人类可读的名字
- worktree启动提速（直读git refs跳过多余fetch）
- `/voice`显示识别语言，不支持时给警告

---

### 🟠 Bug修复

- 自动压缩连续失败3次后熔断（不再无限重试卡死）
- plan模式接受计划后不再重复要求确认
- tmux SSH环境下复制内容正常化
- 新增PostCompact Hook（压缩完成后触发自定义逻辑）

---

## 关键洞察

### 1. 思考强度可调 (`/effort`)

标志着Agent工具从"黑盒"向"可控"演进：
- 用户可根据任务复杂度显式控制计算资源
- 与Test-Time Scaling研究趋势一致

### 2. 熔断机制（3次失败后）

工程稳健性设计：
- 防止无限重试导致的资源浪费
- 与LABSHIELD安全研究的"连续失败检测"理念一致

### 3. MCP Elicitation

人机协作的新模式：
- Agent主动请求补充信息而非盲目继续
- 降低错误传播风险

---

## 与OpenClaw关联

| Claude Code特性 | OpenClaw映射 |
|-----------------|--------------|
| `/effort`调节 | L0-L3分层计算资源分配 |
| 熔断机制 | L0宪法约束+错误处理 |
| MCP Elicitation | ACP协议交互设计参考 |
| sparsePaths | AGENTS.md最小化加载理念一致 |

**趋势**: Agent工具正在向"可控、可观测、可恢复"方向演进，与Harness Engineering范式一致。

---

## 标签

#ClaudeCode #MCP #Anthropic #Agent工具 #可控性 #熔断机制
