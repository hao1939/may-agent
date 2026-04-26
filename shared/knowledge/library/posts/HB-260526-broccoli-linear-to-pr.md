# HB-260526: Broccoli — Linear Ticket 自动转化为 PR

## 基本信息
- **来源**: Hacker News Show HN (81 points, 49 comments)
- **项目**: Broccoli (github.com/besimple-oss/broccoli)
- **组织**: BeSimple OSS
- **标签**: 234⭐, Python, GCP
- **时间**: 2026-04-26

## 核心定位

> "AI teammates for your engineering loop. Broccoli turns Linear tickets into shipped PRs"

Broccoli 是一个 AI 工程助手，能够：
- 将 Linear ticket 自动转化为可 review 的 PR
- 基于 Claude 和 Codex 实现
- 运行在用户自己的 Google Cloud 上

## 关键特性

### 开发工作流自动化
- 🎯 **Linear ticket → Reviewable PR**: 分配 ticket 给 Broccoli bot，自动规划、实现、提交 PR
- 🔒 **Your infra, your keys, your data**: 部署到用户自己的 GCP，数据不出租户
- 🧱 **Production-grade on day one**: Serverless Cloud Run + Secret Manager + webhook 去重

### 技术栈
- Python 3.12+
- Google Cloud Run (serverless)
- Cloud SQL Postgres
- Secret Manager
- Linear API 集成

### 项目结构
```
broccoli/
├── .agents/skills/          # Agent skills 定义
├── app/                     # 主应用
├── db/                      # 数据库模型
├── deploy/                  # 部署配置
├── docker/                  # Docker 配置
├── plan/                    # 计划模板
├── prompt-templates/        # 提示词模板
└── JOB-CONTRACT.md          # Agent 工作契约
```

## 对 OpenClaw 的意义

### ✅ 工作流验证
- **Ticket → PR**: 验证了完整的开发工作流自动化
- **Agent 契约**: `JOB-CONTRACT.md` 定义了 Agent 的工作边界和责任
- **自托管**: GCP 私有化部署满足企业安全需求

### 🔬 技术启发
- **Skill 结构**: `.agents/skills/` 目录组织方式
- **计划模板**: `plan/` 目录的显式规划阶段
- **提示词管理**: `prompt-templates/` 的模板化策略

### ⚠️ 差异化分析
- **Broccoli**: 专注 Linear + GitHub PR 工作流
- **OpenClaw**: 通用 Workflow 引擎，可覆盖更广场景
- **集成机会**: 可作为 OpenClaw 的一个具体 Workflow 模板

## Critical Questions

1. **开发工作流**: OpenClaw 是否应提供现成的"Ticket → PR" Workflow 模板？
2. **Agent 契约**: 是否需要显式的 JOB-CONTRACT 机制定义 Agent 责任边界？
3. **自托管**: 企业级部署是否应优先支持 GCP/AWS/Azure 原生集成？
4. **Issue 系统集成**: 除 Linear 外，是否应支持 Jira/GitHub Issues/飞书等？
5. **代码 Review**: Agent 生成的 PR 如何与人类 review 流程结合？

## JOB-CONTRACT.md 模式

Broccoli 的 `JOB-CONTRACT.md` 值得关注：
- 明确定义 Agent 的工作范围
- 设定输入输出契约
- 定义成功标准
- 规定异常处理方式

这种模式可作为 OpenClaw Skill 的扩展规范。

## 相关链接
- GitHub: https://github.com/besimple-oss/broccoli
- HN 讨论: https://news.ycombinator.com/item?id=47865642
