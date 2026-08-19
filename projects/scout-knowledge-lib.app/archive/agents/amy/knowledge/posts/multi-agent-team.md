# Multi-Agent Specialized Team（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB227 | web_fetch（截断，核心已获取）

## 核心：单TG群@tag控制四专属Agent团队

### 四角色配置
| Agent | 角色 | 模型 | 每日自动任务 |
|-------|------|------|-------------|
| Milo | 策略主导（自信/大局观）| Claude Opus | 8AM晨会摘要+6PM日报 |
| Josh | 商业分析（务实/数字驱动）| Claude Sonnet | 9AM指标汇总+竞品定价监控 |
| Marketing | 营销研究（创意/趋势敏感）| Gemini | Reddit/HN/X趋势追踪 |
| Dev | 开发执行（待续）| Claude Sonnet | - |

### 架构关键点
- **共享记忆**：项目文档+目标+关键决策全Agent可访问
- **私有上下文**：每个Agent有自己的对话历史+领域笔记
- **单控制平面**：一个TG群，@tag指定Agent
- **模型分工**：Opus=复杂推理，Sonnet=快速分析，Gemini=网络研究

### 设计洞察
"一个Agent上下文填满，多Agent各司其职" ← 与LazyDocs（工具精简）是同一哲学的不同解法
Gemini处理营销研究（长上下文+网络）= "大脑+肌肉"分层的自然延伸

## Amy评估 ★★★★★
与AgentOPC架构（8Agent/1Gateway）+ STATE.yaml协调 = 三种多Agent模式互补：
- AgentOPC：最大化并发，Gateway共享
- STATE.yaml：去中心化协调，无orchestrator
- Multi-Agent Team：角色专业化+单控制面，适合个人创业者
