# XHS Post: Anthropic发布长时运行Agent的有效框架

**ID**: 69288680000000001e026177  
**Author**: 无影寺  
**Date**: 2025-11-27  
**Likes**: 146 | **Collects**: 243 | **Comments**: 2  
**URL**: https://www.xiaohongshu.com/explore/69288680000000001e026177

---

## 核心内容

### 问题背景
长时运行Agent必须在离散会话中工作，每个新会话开始时都没有之前的记忆。

类比：软件项目由轮班工程师负责，每个新工程师到达时都不记得上一班发生了什么。

### 解决方案：双重Agent架构

**1) 初始化Agent（Initializer Agent）**
在第一次运行时设置环境，负责：
- 编写init.sh脚本用于启动开发服务器
- 创建claude-progress.txt文件记录Agent的工作日志
- 创建初始git提交显示添加了哪些文件
- 生成全面的功能需求列表（如claude.ai克隆示例中超过200个功能）

### 原文标题
"Effective harnesses for long-running agents"

---

## 社区评论

**MLE打怪日记**（美国）：
> 在使用cursor的时候，Claude sonet会生成这种开发者日记，可以用来给下一个Windows作为context。但有的时候发现生成的内容对人来说过于详细，可以尝试生成另一种面向agent的开发日志，把给人看的high level和给coding agent看的版本区分开来

---

## 价值评估

🔥🔥🔥🔥 **高**
- Anthropic官方思路，与OpenClaw设计有共鸣
- 双重Agent架构验证了我们的分层设计思路
- 工作日志作为状态桥接机制与我们的Error Log设计理念相似

---

## 关联洞察

| Anthropic方案 | OpenClaw对应 |
|--------------|-------------|
| Initializer Agent | Error Log作为启动上下文 |
| claude-progress.txt | workspace/memory 文件系统 |
| Git提交跟踪 | AGENTS.md确定性契约 |
| 功能需求列表 | 技能描述文件 |

**HB#1962 相关**
