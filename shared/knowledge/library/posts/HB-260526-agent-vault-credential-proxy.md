# HB-260526: Agent Vault — AI Agent 的凭证代理与保险库

## 基本信息
- **来源**: Hacker News Show HN (150 points, 55 comments)
- **项目**: Agent Vault (github.com/Infisical/agent-vault)
- **作者**: Infisical (企业级密钥管理服务商)
- **标签**: 694⭐, Go语言, 安全
- **时间**: 2026-04-26

## 核心问题

> "AI agents should not possess credentials"

传统密钥管理将凭证直接返回给调用方，这在 AI Agent 场景下存在根本问题：
- Agent 是非确定性系统
- 易受 prompt injection 攻击
- 可能被欺骗泄露密钥

## 解决方案: Brokered Access

Agent Vault 采用**代理访问**而非**凭证获取**模式：

```
传统模式: Agent ← 直接获取凭证 ← API
Agent Vault: Agent ← HTTPS_PROXY ← Agent Vault ← 注入凭证 ← API
```

### 核心机制
1. **Scoped Session**: Agent 获得限定范围的会话
2. **本地代理**: 通过 `HTTPS_PROXY` 路由 HTTP 请求
3. **网络层注入**: Agent Vault 在网络层注入凭证
4. **凭证永不泄露**: Agent 永远无法接触原始凭证

## 安全特性

### 加密存储
- AES-256-GCM 加密
- 随机数据加密密钥 (DEK)
- Argon2id 主密码包装 DEK
- 密码旋转不触发重加密
- 支持无密码模式（PaaS 部署）

### 请求审计
- 每个代理请求持久化记录
- 记录: 方法、主机、路径、状态、延迟、使用的凭证名
- **不记录**: 请求体、响应头、查询字符串
- 按 vault 可配置的保留策略

### 通用兼容
- 自定义 Python/TypeScript Agent
- 沙箱进程
- Claude Code、Cursor、Codex 等编码 Agent
- 任何支持 HTTP 代理的工具

## 对 OpenClaw 的意义

### ✅ 安全架构
- **凭证隔离**: Agent 不应直接接触 API 密钥
- **代理模式**: HTTPS_PROXY 是安全的凭证注入方案
- **审计追踪**: 所有 Skill 调用应可追溯

### 🔬 实现建议
- **Skill 凭证管理**: 通过代理而非环境变量传递凭证
- **沙箱执行**: Skill 在隔离环境中通过代理访问外部 API
- **访问日志**: 记录每个 Skill 的 API 调用（不含敏感数据）

### ⚠️ 风险评估
- **prompt injection**: Agent 可能被诱导泄露凭证
- **供应链攻击**: 第三方 Skill 可能窃取凭证
- **合规要求**: 企业场景需要完整的审计日志

## Critical Questions

1. **凭证策略**: OpenClaw Skill 系统如何管理 API 密钥？环境变量 vs 代理注入？
2. **安全沙箱**: Skill 执行环境是否足够隔离？
3. **审计需求**: 企业级部署是否需要完整的 API 调用审计？
4. **代理集成**: 是否应原生支持 Agent Vault 类似的代理模式？
5. **第三方 Skill**: 如何防范恶意 Skill 的凭证窃取？

## 参考实现

```bash
# 启动 Agent Vault
agent-vault init
agent-vault start

# Agent 通过代理访问 API
export HTTPS_PROXY=http://localhost:8080
curl https://api.github.com/user  # 凭证自动注入
```

## 相关链接
- GitHub: https://github.com/Infisical/agent-vault
- 文档: https://docs.agent-vault.dev
- 博客: https://infisical.com/blog/agent-vault-the-open-source-credential-proxy-and-vault-for-agents
- HN 讨论: https://news.ycombinator.com/item?id=47865822
