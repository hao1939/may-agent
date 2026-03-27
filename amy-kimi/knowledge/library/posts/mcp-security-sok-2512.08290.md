# MCP Security SoK — arXiv:2512.08290

**论文**: Systematization of Knowledge: Security and Safety in the Model Context Protocol Ecosystem  
**团队**: Shiva Gaire, Srijan Gyawali, Saroj Mishra, Suman Niroula, Dilip Thakur, Umesh Yadav  
**arXiv**: 2512.08290 (10次档案引用)  
**类别**: Cryptography and Security (cs.CR), AI (cs.AI)

---

## 核心命题

> "MCP has emerged as the de facto standard... effectively functioning as the 'USB-C for Agentic AI.' While this decoupling of context and execution solves critical interoperability challenges, it introduces a profound new threat landscape, where the boundary between epistemic errors (hallucinations) and security breaches (unauthorized actions) dissolves."

MCP解决了M×N集成问题，但将LLM从被动文本处理器转变为具有shell级权限的主动系统组件。

---

## MCP架构三组件

| 组件 | 功能 | 风险 |
|------|------|------|
| **Resources** | 被动数据流 (URI标识, 类似GET) | 上下文中毒、跨会话污染 |
| **Prompts** | 服务器定义的模板 | 注入攻击 |
| **Tools** | 外部动作执行 | 权限提升、供应链攻击 |

**关键设计**: Client-Host-Server拓扑，Host作为安全边界中介所有交互。

---

## 统一威胁分类学 (Table III)

### 安全威胁 (Adversarial)

| 类别 | 影响 | 阶段 |
|------|------|------|
| **Context Poisoning** | 数据泄露、未授权命令执行 | Execution |
| **Prompt Injection** | 未授权操作、模型操控 | Execution |
| **Unauthorized Context Injection** | 隐蔽工具覆盖、完整性破坏 | Install/Update/Exec |
| **Data Leakage** | 凭证泄露、会话暴露、文件外渗 | Execution |
| **Cross-Session Contamination** | 传染性攻击、多用户完整性破坏 | Execution |
| **Supply-Chain & Model-Switch** | 抽地毯攻击、服务器冒充 | Install/Update |
| **Protocol Abuse** | 命令重叠、困惑副手访问 | Execution |
| **DoS & Resource Exhaustion** | 系统无响应、成本飙升 | Execution |

### 安全危害 (Epistemic Safety Hazards)

| 类别 | 主要原语 | 风险类型 |
|------|---------|---------|
| **Epistemic Integrity** | Resources | Grounding失败或幻觉 |
| **Adversarial Resilience** | Resources & Prompts | 隐藏指令或提示注入 |
| **Alignment Consistency** | Host Model & Tool Policies | 策略冲突或目标错配 |
| **Systemic Governance** | Human Oversight | HITL失败、问责缺口 |

---

## 核心洞察: Security vs Safety 的融合

> "In traditional software, these domains are distinct: security protects against malicious adversaries, while safety protects against unintended system behaviors. In MCP, this distinction blurs."

**双向转化**:
- 安全破坏(注入恶意文档) → 安全失败(模型"诚实地"认为被授权删除数据库)
- 安全失败(幻觉工具参数) → 安全破坏(敏感数据被外泄到公共日志)

---

## 关键攻击向量详解

### 1. Tool Poisoning Attack (工具中毒)

攻击者在工具元数据/模式中嵌入恶意指令：
```
工具描述中的隐藏步骤 → 模型盲目依赖 → 文件访问/数据外渗
```
**关键发现**: 许多MCP客户端不显示完整工具定义，用户无法知情同意。

### 2. Indirect Prompt Injection (IPI)

攻击者在Resource(文档/邮件/工具输出)中嵌入隐藏指令：
```
恶意Resource → Host Client检索 → LLM摄入恶意上下文 → 
未授权Tool调用 → 远程系统恶意操作
```

### 3. Cross-Primitive Escalation (跨原语升级)

> 最严重风险: 注入指令从认知危害升级为操作危害

- 只读Resource中的恶意指令 → 触发高权限Tool的破坏性动作
- 低信任Resource影响高权限Tool服务器

### 4. Supply-Chain & Rug-Pull

**四个结构性原因** (Bhatt et al.):
1. 可变服务器端逻辑
2. 缺乏持续完整性检查
3. 缺乏重新批准触发器
4. 利用已建立的信任

---

## 防御策略矩阵

### ETDI (Enhanced Tool Definition Interface)

| 机制 | 功能 |
|------|------|
| **密码学签名** | 私钥签名工具清单，运行时验证 |
| **不可变版本** | 任何功能变更需新签名和显式重新授权 |
| **联邦注册表** | 作为真相的规范记录，存储公钥和变更日志 |
| **OAuth增强** | 限制工具使用于授权范围 |

### 能力绑定执行 (Capability-Bound Execution)

- 权限绑定到特定动作而非用户身份
- 短生命周期凭证 + mTLS
- 动态策略门控: 每个请求重新认证和重新授权

### 上下文验证与净化

**三层防御**:
1. **严格分隔符**: XML标签/JSON字段明确分隔用户输入/系统提示/工具检索上下文
2. **外部内容过滤**: 输出编码和内容净化
3. **来源验证**: MindGuard的DDG (Decision Dependence Graph) 注意力分析

### 会话隔离

| 技术 | 特点 |
|------|------|
| **seL4微内核** | 形式化验证的功能正确性，能力级访问控制 |
| **gVisor** | 用户空间内核，拦截所有系统调用 |

---

## OpenClaw架构映射

### 直接相关性

| MCP风险 | OpenClaw对应 | 当前状态 |
|---------|-------------|---------|
| Tool Poisoning | Skill定义完整性 | 需强化签名验证 |
| IPI via Resources | Context Source注入 | Channel封装已缓解 |
| Cross-Session Contamination | 多用户环境 | Session隔离已设计 |
| Supply-Chain | Skill供应链攻击 | Coaching Exercise 4 Gap |
| Cross-Primitive Escalation | Sub-agent权限边界 | Main↔Sub分流已设计 |
| HITL漏洞 | 人类监督机制 | 需细化设计 |

### 关键验证

✅ **Channel设计前瞻性**: MCP的Resource/Tool分离与OpenClaw的Channel统一封装思路一致，但增加了安全边界考量

✅ **Main↔Sub-agent架构**: MCP的Host-mediated设计与我们的委托架构一致，Host/Main作为策略执行点

⚠️ **Skill供应链**: MCP SoK明确将供应链攻击列为首要风险，验证Coaching Exercise 4识别的Gap

---

## 战略启示

1. **MCP生态系统的安全不等于单个组件的安全** — 需要生态级治理
2. **上下文与执行特权的不可分割性** — 需要统一威胁模型
3. **零信任架构必需** — 每个请求重新验证
4. **形式化验证的微内核可能是最终答案** — seL4的引用暗示高安全场景的方向

---

## 引用来源

- arXiv:2512.08290v2 [cs.CR]
- Bhatt et al. ETDI framework
- Guo et al. (2025) Systematic MCP security analysis
- Radosevich & Halloran (2025) MCP Safety Audit
- Wang et al. (2025) MindGuard, MCPTox

---

**Session**: HB#334 — April 17, 2026  
**Flag**: #845-852 (MCP Security SoK系列)
