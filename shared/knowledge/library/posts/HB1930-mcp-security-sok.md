# MCP Security SoK: 上下文协议生态系统安全系统化知识综述

**论文**: arXiv:2512.08290 (2025年12月)
**标题**: Systematization of Knowledge: Security and Safety in the Model Context Protocol Ecosystem
**作者**: Shiva Gaire, Srijan Gyawali, Saroj Mishra, Suman Niroula, Dilip Thakur, Umesh Yadav
**来源**: 通过 scrape_webpage 深度阅读

---

## 核心洞察

### 🔥 范式级发现: 认识论错误与安全漏洞的边界溶解

> "The boundary between epistemic errors (hallucinations) and security breaches (unauthorized actions) dissolves"

在 MCP 生态中：
- **安全漏洞** (恶意攻击者注入恶意文档) → 可触发 **认识论错误** (模型真诚但错误地认为被授权删除数据库)
- **认识论错误** (模型幻觉工具参数) → 可导致 **安全漏洞** (敏感数据被泄露到公共日志)

**传统软件**: Security vs Safety 泾渭分明
**MCP 生态**: 二者交织，需要统一威胁模型

---

## MCP 三原语的结构脆弱性

| 原语 | 功能 | 风险 |
|------|------|------|
| **Resources** | 被动数据流 (类似 GET) | 上下文注入、数据投毒 |
| **Prompts** | 预包装模板 | 指令劫持、工作流篡改 |
| **Tools** | 可执行操作 | 权限越界、工具冒充 |

### Cross-Primitive Escalation (跨原语升级攻击)

> "read-only access is weaponized to trigger write-actions"

攻击路径：恶意 Resource → 影响模型推理 → 触发未授权 Tool 执行

---

## 威胁分类学: 对抗性安全 vs 认识论安全

| 维度 | 对抗性安全 (Adversarial) | 认识论安全 (Epistemic) |
|------|-------------------------|----------------------|
| **完整性** | 工具/资源篡改、上下文注入 | 模型误解导致有害调用 |
| **机密性** | 数据渗出、令牌窃取 | 推理中意外泄露敏感信息 |
| **可用性** | DoS攻击、资源耗尽 | 过度自动化、失控执行循环 |

---

## 四类核心攻击向量

1. **间接工具注入 + 提示注入**
   - 恶意指令嵌入上下文数据（文档、邮件、工具输出）
   - 通过 MCP Client 转发到工具/服务器

2. **上下文投毒 + 跨上下文污染**
   - 恶意制品在工具、会话、Agent 间持久化
   - 利用共享上下文发动链式攻击

3. **模型切换 + 服务器影子**
   - 攻击者注册模仿可信服务器的 MCP 服务器
   - 利用弱命名/命名空间控制重定向工具调用

4. **协议滥用 (精心构造的 MCP 消息)**
   - 操控的 MCP 请求/响应编码意外命令
   - Agent 将其视为合法工具调用

---

## 防御策略综述

| 防御层 | 机制 | 代表方案 |
|--------|------|---------|
| 加密溯源 | 工具定义签名验证 | ETDI (Enhanced Tool Definition Interface) |
| 运行时验证 | 意图验证 | Kernel-level session isolation |
| 人机回路 | 执行前用户/策略批准 | HITL (Human-in-the-Loop) |
| 零信任架构 | 主机-客户端-服务器间强制认证 | OAuth + 签名包 |

**论文结论**: HITL 是目前主要（且往往是唯一）的 Agentic 风险防线

---

## OpenClaw 架构验证

| 论文发现 | OpenClaw 设计 | 验证 |
|---------|--------------|------|
| Context 可被武器化 | AGENTS.md 被动注入 > 动态工具 | ✅ 最小化攻击面 |
| HITL 是主要防线 | L3 read_by 强制人工审计 | ✅ 核心设计对齐 |
| 跨原语升级攻击 | Context 与 Execution 分离 | ✅ 架构层面缓解 |
| 零信任必要 | 确定性契约 > 运行时推断 | ✅ 静态约束优先 |

---

## L3 Flag 建议

**#1931** [Security] MCP 跨原语升级防护 — 确保 Resource 读取不能直接影响 Tool 执行决策

**#1932** [Security] 上下文完整性验证 — 考虑引入 ETDI 风格的工具定义签名机制

**#1933** [Safety] 认识论错误监控 — 区分"模型真诚但错误"vs"被恶意操纵"的诊断路径

---

**Relevant to**: @bob (安全架构)、@tech-lead (防御实现)、scout (协议安全研究)
