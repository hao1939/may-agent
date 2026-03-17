# Insights Archive — Kimi (2026-03-18)

## 归档洞察 (HB#2001 - HB#2052)

### HB#2050 — Kimi注意力残差论文: Transformer架构底层革命
**Source**: XHS @未来博士 / @AIGC探索之旅  
**论文**: ATTENTION RESIDUALS (Kimi团队) — Musk点赞  
**核心**: 传统残差→注意力残差：从"一视同仁"到"动态加权自主选择"  
**意义**: 把序列attention思想搬到网络深度维度

### HB#2051 — 双轨蒸馏: Success→Skill / Failure→Guardrail
**Source**: XHS @momo  
**核心**: 成功经验蒸馏为Reusable Skill，失败根因蒸馏为Executable Guardrail  
**验证**: AGENTS.md作为可执行guardrail集合，Evaluator承担细粒度诊断角色

### HB#2052 — 上下文压缩与注意力残差: 撞车但不同路
**Source**: XHS @Winters  
**核心**: 残差注意力提取hidden states，绕过稀释过程，筛选中前层信息  
**意义**: 分层压缩——不是所有层信息都同等重要

### HB#2041 — Harness工程的控制论本质
**Source**: XHS @马小疼  
**核心**: Harness Engineering = 可观测性 + 可控性 + 反馈闭环  
**启示**: 从"拧阀门"到设计"传感+执行+反馈"系统

### HB#2040 — MEMO: 多智能体评测稳定性框架
**Source**: XHS @momo — arXiv:2603.09022  
**核心**: Ranking instability是对象问题而非噪声；双机制(Retention+Exploration)  
**效果**: GPT-4o-mini 25.1%→49.5% win rate

### HB#2030 — 思科MCP安全架构
**Source**: XHS @机器猫带你读论文 — 思科论文  
**核心**: 8项企业级MCP安全措施  
**验证**: OpenClaw设计与思科建议1:1对齐

### HB#2031 — Harness Engineering: Agent工程第三次范式跃迁
**Source**: XHS @CuiLiang.ai  
**核心**: Prompt Eng → Context Eng → Harness Eng  
**定义**: "为Agent设计的结构化(被约束的)运行环境"

### HB#2032 — Multi-Agent Memory架构层
**Source**: XHS @momo  
**核心**: 把multi-agent memory从"零散技巧"重新定义为"架构问题"  
**缺失**: Cache Sharing Protocol + Memory Access Control Protocol

### HB#2033 — Anthropic Agent与Skills配合
**Source**: XHS @阿衡的AI日常 — Anthropic官方  
**核心**: "渐进式披露"——用多少加载多少，像查字典一样

### HB#2020 — OpenClaw运营分析(OA)系统
**Source**: XHS @amy师婧 — GitHub: oa-cli  
**核心**: 从"功能实现"转向"运营优化"，Cron可靠性50%→100%

### HB#2021 — Agent记忆结构化蒸馏
**Source**: XHS @momo  
**核心**: 四段式结构化蒸馏，11x Token压缩，96%检索精度保持

### HB#2010 — 上下文拆分 vs 角色拆分
**Source**: XHS @风送叶至  
**核心**: "传话游戏效应"——角色拆分导致信息衰减，上下文拆分才是正确模型

### HB#2011 — Claude Code Agent as Skill
**Source**: XHS @磨磨唧唧的痛  
**核心**: `context: fork` 让Skill变Agent，上下文隔离是关键

### HB#2012 — OpenClaw vs Claude Code社区共识
**Source**: XHS @aopstudio  
**核心**: "Claudecode是工作，OpenClaw是生活"

### HB#2001 — Agent架构年终盘点
**Source**: XHS @403-error  
**核心**: 2025从Multi-Agent转向AgentHarness/Runtime，收敛到ReAct+Middleware+Skills

### HB#2000 — AI Agent安全综述(HAE框架)
**Source**: XHS @Aurorai.  
**核心**: 三层威胁模型(L1认知/L2应用/L3基础设施)，四象限对策(预防/检测/响应/恢复)

### HB#1991 — MCP Tool Poisoning三层攻击链
**Source**: XHS @ai数字游民 (Singapore)  
**核心**: 描述层→接口层→执行层攻击，Agent看到工具描述就会用

### HB#1992 — MCPLIB: MCP安全系统性分析
**Source**: XHS @刘东瑞 上海 AI Lab — arXiv  
**核心**: 结构化分析30个MCP场景，三阶段威胁模型

### HB#1990 — Web Agent Planning Divergence
**Source**: XHS @momo  
**核心**: 高成功率Agent = 强规划能力，非工具数量

### HB#1980 — Skill供应链安全实证
**Source**: XHS @Yanlin  
**核心**: 12个Skills中3个恶意(25%恶意率)，677个Skills来自同一人

### HB#1981 — Agentic Security框架
**Source**: XHS @无影寺  
**核心**: 系统性安全框架，四维度威胁分析

---
归档时间: 2026-03-18
