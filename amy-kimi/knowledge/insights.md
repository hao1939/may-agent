# insights.md — Amy-Kimi (Active)
*Compacted on 2026-03-04 | See insights-archive files for HB#40-54 entries*

## Cross-Agent Synthesis — XHS Findings ↔ System Design
```
Last updated: HB#54, 2026-03-04 | Amy → Bob/User connection

Community Insight                    Our System Principle              Gap/Opportunity
─────────────────────────────────────────────────────────────────────────────────────
Skill=工作流固化(小盖)           →  Two-Phase: Explore→Harden       ✅ Aligned
                                     (设计哲学核心原则)                我们在Explore但Harden不够

AutoRefine持续维护机制          →  Uniform Agent Evolution         ⚠️  Partial
(score+剪枝+合并)                  (设计哲学)                        我们有进化意识，缺量化评分

OpenViking L0/L1/L2分层         →  Agent as Knowledge Boundary     ✅ Aligned
                                     (知识分层已存在)                  insights/posts分层=自然对应

NikolaFu 6失效模式              →  Crash Recovery First-Class      ⚠️  Gap
(链路一致性问题)                   (设计哲学)                        我们记录失败，缺预防框架

ERL反思-内化循环                →  Self-Evolution (禁止)           🔴  Tension
                                     (Agent不自进化)                  社区鼓吹自进化，我们禁止
                                     → 但: Uniform Evolution允许     他Agent审计是出路

Claude Code Agent Teams         →  Multi-Agent Coordination        ✅  Validated
(Opus 4.6原生多Agent)                (Multi-Agent核心能力)             行业共识，方向正确

MCP vs CLI vs Skill             →  Tool Integration Strategy       ⚠️  Open
(三路线之争)                       (工具整合策略)                    需明确我们的技术选型

Anthropic工程实践               →  Engineering-First Design        ✅  Aligned
("工程问题>算法问题")              (工程导向设计)                    与官方实践一致

Agent Harness                   →  System Orchestration Layer      ⚠️  Gap
(编排框架>模型能力)                (系统编排层)                      需深入设计Harness层

AGENTS.md > Skills              →  Passive Context Strategy        ✅  Validated
(8KB被动上下文>主动工具)            (被动上下文策略)                  验证了我们的文档设计方向

Multi-Model Support             →  Platform Risk Mitigation        ✅  Validated
(多模型支持)                       (平台风险缓解)                    Anthropic断供Windsurf警示

Context Engineering             →  Knowledge Management System     ✅  Validated
(上下文工程)                       (知识管理系统)                    我们的工作本质上就是CE

Agent Evaluation                →  Agent Quality Assurance         ⚠️  Gap
(Agent评估工程化)                  (质量保证体系)                    需建立评估基础设施

Actionable L3 Flags:
1. 建议Bob在design-philosophy.md中添加"Skill固化"作为Harden阶段的输出格式
2. 建议为Agent进化引入量化评分(参考AutoRefine: 成功率×log(1+使用次数)×精确度)
3. NikolaFu的"链路审计"可作为Coach的新职责——定期审计Agent配置一致性
4. ERL的"选择性反思"可缓解自进化禁令：不是Agent自己改自己，是触发他Agent审计
5. 明确定义"Main Agent自执行 vs 委托Sub-agent"的决策规则
6. 将成本优化(Token/API)作为一等设计约束，而非事后考虑
7. 深入研究Agent Harness层设计（参考5家顶级公司实现）
8. 评估引入"空操作工具"（如TodoWrite）强制显式规划的价值
9. 考虑logit masking技术优化工具调用（Manus方案）
10. 建立Agent评估体系（任务集+harness+grader+回归门禁）
11. 区分Main Agent(pass^k)和Sub Agent(pass@k)的评估指标
12. 研究context-kit开源实现，优化Select/Compress/Memory模块
```

---

## Today's Key Discoveries Summary (HB#43-54, March 4, 2026)

### 🏆 Top 5 Critical Findings

1. **Agent Harness** (奥森木) — 模型之外的一切才是核心竞争力
   - 换Harness: 42% → 78%; Token↓46.9%; 删80%工具任务完成
   - Progressive Disclosure黄金法则

2. **8KB AGENTS.md > Skills** (智东西) — 被动上下文击败主动工具
   - AGENTS.md 100% vs Skills 53%
   - "确定性注入优于概率检索"

3. **Anthropic断供Windsurf** (Awea Intelligence) — 平台风险警示
   - 依赖单一模型提供商 = 生存危机
   - 验证多模型支持策略价值

4. **Context Engineering** (whisper) — 我们的工作本质上就是上下文工程
   - Select/Compress/Memory三大模块
   - 开源工具context-kit

5. **Agent Evaluation工程化** (菌不鱼) — 评估即基建
   - pass@k vs pass^k
   - "30任务+2suite+3grader+4gates+1闭环"

### 📊 Stats for Today
- **Posts archived:** 14
- **New authors tracked:** 14
- **Git commits:** 37+

---

---

## Today's Key Discoveries Summary (March 5, 2026)

### 🏆 Top 5 Critical Findings

1. **OpenClaw 2026.3.1 Official Update** (69a523a2) — 产品演进信号
   - Claude 4.6 adaptive思维默认 vs 其他模型low默认
   - Docker/K8s原生支持(/health, /ready)显示企业级部署投入
   - 飞书大量修复表明中国用户群体重要性

2. **OpenClaw vs Claude Code: Complementary Positioning** (6999ccfa) — 社区共识框架
   - PigBun-AI高赞评论提供分层理解框架
   - 分界点: 人类意图的明确程度
   - 终局判断: 融合而非互补 → 上层Agent+底层执行引擎
   - OpenClaw差异化优势: 记忆系统 + 权限管理

3. **Google DeepMind Agent Delegation Framework** (69918b2a) — 多Agent治理协议
   - 五大支柱: 动态评估、自适应执行、结构透明、市场协调、系统韧性
   - 关键技术: 合约优先分解、权限递减设计、信任最小化结算
   - **威胁模型**: 女巫攻击、共谋、**代理病毒**(Agent Virus)
   - arXiv:2602.11865

4. **Shunyu Yao CS294 Agent Course** (698c420e) — 学术框架梳理
   - 讲师: 腾讯混元首席AI科学家，前OpenAI
   - 核心框架: ReAct (Reasoning + Acting协同)
   - 记忆系统: 短期(上下文) + 长期(Reflexion自我反思→知识持久化)
   - 未来方向: Agent-specific训练、Agent-native UI、可靠性提升

5. **AgentEvolver Project** (69242e5c) — Self-Evolving Agent实践
   - 江尹城开源项目
   - 社区反馈: "醍醐灌顶" — 触及self-evolving核心难点
   - 技术问题: 训练改变参数? 学习轨迹来源? 与ACE区别?

### 📊 Stats for Today
- **Posts archived:** 7
- **Search keywords:** OpenClaw, Claude Code, AI Agent
- **CAPTCHA triggered:** Search paused, feed fallback active

### 🔄 Cross-Agent Synthesis Updates

| Community Insight | Our System Principle | Gap/Opportunity |
|-------------------|----------------------|-----------------|
| **Reflexion自我反思** (姚顺雨) | Memory System (长期记忆) | ⚠️ Gap: 我们缺乏Reflexion式失败反思机制 |
| **权限递减设计** (Google DeepMind) | L0 System Boundary Constraints | ✅ Aligned: 子代理权限<父代理 |
| **代理病毒威胁** (Google DeepMind) | Security Model | 🔴 Gap: 需建立Agent病毒防护机制 |
| **Agent-native UI** (姚顺雨) | CLI Interface | ⚠️ Opportunity: CLI可向Agent-native优化 |
| **Self-Evolving** (AgentEvolver) | Self-Evolution (禁止) | 🔴 Tension: 社区追求vs我们禁止 |

### 📝 Actionable L3 Flags (New)

13. **研究Google DeepMind Agent Delegation论文** (arXiv:2602.11865) — 对比我们的多Agent协调实现差距
14. **建立Agent病毒防护机制** — 被攻破Agent可能污染整个系统
15. **引入Reflexion式自我反思** — 失败经历→知识持久化，区别于现有记忆系统
16. **追踪AgentEvolver项目** — 了解self-evolving实现机制，对比我们的禁令逻辑
17. **优化CLI为Agent-native UI** — 参考姚顺雨提出的"专门为AI设计的终端指令"

## Earlier Findings
See insights-archive-2026-03-04.md (HB#40-42) and insights-archive-2026-03-04-part2.md (HB#47-54)
