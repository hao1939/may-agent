# Skill-JIT: OpenClaw兼容的JIT技能生成插件

**来源**: 小红书 @朝闻道 (16赞, 26收藏)  
**仓库**: china-qijizhifeng/Skill-JIT  
**日期**: 2026-04-04

---

## 简介

Skill-JIT 是一个 Claude Agent 插件（🦞 兼容 OpenClaw），帮助 Agent 在需要时调研并生成可复用的技能（Agent Skills）。

---

## 一键安装

```bash
# Claude Code
claude plugin marketplace add china-qijizhifeng/Skill-JIT
claude plugin install skill-jit@skill-jit-marketplace

# OpenClaw
openclaw plugins install skill-jit --marketplace china-qijizhifeng/Skill-JIT
```

---

## 架构设计

Skill-JIT 包含**一个技能**和**两个子智能体**：

### 技能: skill-jit
- 用户通过斜杠指令 `/skill-jit <描述>` 触发
- 模型也能在遇到需要调研的任务时自动触发

### 子智能体 1: Writer（技能作者）
- 负责编写技能
- 根据需要派出 Researcher 查资料
- 结合调研结果和技能设计模式生成新技能
- 任务复杂时，将技能拆成多个子技能分别调研编写

### 子智能体 2: Researcher（调研员）
- 被 Writer 派出去查资料
- 提供调研结果供 Writer 使用

---

## 三种工作模式

| 模式 | 说明 |
|------|------|
| **Create** | 从零生成新Skill。Writer分析任务→派出Researcher调研→生成Skill文件 |
| **Fix** | 修复已有Skill。定位出错步骤，针对性调研更新，保留正确部分 |
| **Dry-Run** | 预览模式。走完流程但不写入文件，先看效果再决定 |

---

## 技术特点

- **纯Markdown**: 整个插件都是纯Markdown文件，无需编译构建
- **跨平台兼容**: 为Claude Code开发，但基本兼容OpenClaw
- **Agent定义 + Skill模板 + 模式参考**: 三部分组成

---

## 社区讨论

> "这个和anthropic最新的skill-creator有什么区别？" — karpsie

---

## 对我们的启示

1. **JIT技能生成**: 按需生成技能，而非预定义全部技能
2. **子智能体协作**: Writer + Researcher 分工模式
3. **跨平台设计**: 纯Markdown实现跨Agent平台兼容
4. **三种模式覆盖**: 创建/修复/预览完整技能生命周期
5. **社区生态**: OpenClaw兼容插件开始出现

---

## 相关链接

- 仓库: china-qijizhifeng/Skill-JIT
- 相关: Trace2Skill (技能蒸馏), Claude Code Harness Patterns
