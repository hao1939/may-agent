# Paper: Security Considerations for Artificial Intelligence Agents

**arXiv**: https://arxiv.org/abs/2603.12230  
**Date**: March 12, 2026  
**Authors**: Ninghui Li, Kaiyuan Zhang, Kyle Polley, Jerry Ma (Perplexity)  
**Type**: Perplexity Response to NIST/CAISI Request for Information 2025-0035

---

## 核心贡献

来自**Perplexity生产环境**（数百万用户、数千企业）的AI Agent安全系统性分析，正式提交给NIST/CAISI（美国国家标准与技术研究院/AI安全研究所）。

---

## 三大独特安全挑战

### 1. 代码-数据边界进一步模糊

> "In LLM-powered AI agent systems, the distinction between code and data is further blurred."

- **传统原则**: 代码与数据分离是计算机安全基础
- **Agent挑战**: 纯文本提示充当代码角色，动态生成文本可成为LLM的新提示
- **本质**: LLM提供新的可编程计算接口层，该层没有代码与数据的二元区分

### 2. 显著更灵活的自动化

| 传统软件 | AI Agent |
|----------|----------|
| 预编程工作流 | 接受高级目标，动态构建工作流 |
| 窄域、可预测 | 泛化到未见情境 |
| 显式指定 | 解释模糊输入、处理部分信息 |

**风险**: Agent需被授予广泛能力（文件系统、数据库、API凭证、代码执行、交易），误用（恶意或意外）可导致重大漏洞。

### 3. 现有安全机制不匹配

- **桌面系统**: 围绕人类用户设计，依赖"人类行动相对缓慢"的假设
- **Agent速度**: 机器速度执行，需要新安全机制
- **Web浏览器**: 依赖用户评估跨站交互风险，但Agent自动化执行这些操作

---

## CIA三元组分析

### Confidentiality (保密性)

**风险场景**:
- Agent访问敏感信息（凭证、个人数据、商业秘密）
- 数据通过多渠道传播：工具输出、工作区文件、记忆条目、webhook响应
- 外部连接器或浏览器自动化跨系统传输数据

### Integrity (完整性)

**风险场景**:
- 关键系统非授权修改（删除/修改文件、安装软件、配置更改）
- 外部服务非预期通信或交易（发送邮件、金融转账）
- 任务以次优或被操纵方式完成
- 向用户呈现错误或误导信息

### Availability (可用性)

**风险场景**:
- 长时间运行任务、定时作业、浏览器自动化、外部连接器引入额外依赖
- 资源过度消耗导致任务过早终止
- 级联故障：单个组件失败传播至整个流水线
- **对抗性攻击**: 利用LLM推理的高计算成本进行资源耗尽攻击

---

## 主要攻击面

### 攻击者类型

| 类型 | 描述 | 示例 |
|------|------|------|
| **外部内容提供者** | 控制Agent交互系统信息的实体 | 网页运营商、邮件/帖子发送者 |
| **组件提供者** | 提供Agent系统核心组件 | LLM服务、记忆服务、工具/Skill |
| **网络攻击者** | 网络路径上的攻击者 | API端点、webhook、通信通道 |
| **内部人员** | Agent系统开发者或运营者 | 软件bug、配置错误、特权滥用 |
| **客户端攻击者** | 访问用户交互设备的实体 | 设备入侵 |

### 间接提示注入 (Indirect Prompt Injection)

> "An adversary embeds adversarial instructions within content that an agent retrieves during normal operation"

- **载体**: 网页、邮件、日历条目
- **机制**: LLM无法可靠区分可信指令与不可信数据
- **示例**: 投毒网页可静默指示浏览Agent读取用户Google日历并外泄至攻击者服务器

### 多Agent系统特有风险

| 风险 | 描述 | 案例 |
|------|------|------|
| **隐式委托** | 一个Agent通过共享状态间接触发另一个Agent动作 | 授权链不清晰 |
| **混淆副手** (Confused Deputy) | 外部Agent被操纵指示更高权限内部Agent执行非预期动作 | 经典安全漏洞 |
| **权限提升** | 低权限Agent诱导高权限对等Agent执行敏感操作 | 绕过端到端访问控制 |
| **审计困难** | 决策路径跨多个Agent、中间产物、重试 | 责任归因困难 |

---

## OpenClaw引用

论文明确提及OpenClaw作为安全案例研究：

> "A concrete example is **OpenClaw**, an open-source AI assistant that connects AI models to local files and messaging platforms like WhatsApp and Discord to automate tasks continuously. Several security incidents involving OpenClaw have been documented, including attacks recorded as **CVE-2026-25253** and **CVE-2026-26327**."

**关键洞察**: 与传统软件相比，LLM驱动的逻辑本质上非确定性和更不透明，使得推理可达状态、枚举不良行为或形式化验证系统安全变得更加困难。

---

## 分层防御栈

论文评估当前防御为**分层栈**：

| 层级 | 机制 | 作用 |
|------|------|------|
| **输入级** | 输入过滤、提示清洗 | 阻断恶意输入 |
| **模型级** | 模型训练、对齐 | 提升内在安全性 |
| **沙箱执行** | 隔离环境运行 | 限制损害范围 |
| **确定性策略执行** | 高后果动作的策略强制 | 最终安全防线 |

---

## 研究缺口与标准需求

论文识别以下需要进一步研究的领域：

1. **自适应安全基准**: 动态适应新攻击模式
2. **委托与权限控制策略模型**: 细粒度授权框架
3. **安全多Agent系统设计指南**: 与NIST风险管理原则对齐

---

## 对OpenClaw的关键启示

| Perplexity发现 | OpenClaw设计验证 | 状态 |
|----------------|------------------|------|
| 代码-数据边界模糊 | L0宪法层明确分离 | ✅ 方向正确 |
| 间接提示注入风险 | 输入验证层 | 🔄 需强化 |
| 混淆副手风险 | Main/Sub-agent权限边界 | 🔄 需审计 |
| 级联故障风险 | Error Log故障隔离 | ✅ 已考虑 |
| 分层防御栈 | L0-L3约束层级 | ✅ 架构对应 |
| 确定性策略执行 | L0禁止运行时自进化 | ✅ 一致 |

---

## L3 Flags 关联

- #1012: 网络攻击能力评估 → CIA保密性风险
- #1013: 自主渗透测试 → 完整性/可用性风险
- #1031-#1033: SDec-POMDP通信安全 → 多Agent协调安全

---

*Archived: Amy-Kimi HB#385 | March 14, 2026*
