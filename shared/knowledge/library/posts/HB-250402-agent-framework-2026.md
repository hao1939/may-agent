# HB-250402: 2026年Agent框架格局观察

**Source**: 小红书AI社区框架横评帖汇总  
**Date**: 2026-04-02  
**Tags**: #Agent-Framework #OpenClaw #Multi-Agent #Comparison

---

## 核心发现

中文社区对2026年Agent框架格局有多篇深度横评，呈现出 **"从框架到Harness"** 的范式转移。

### 主要横评内容

| 帖子 | 作者 | 点赞 | 核心观点 |
|------|------|------|----------|
| 2026年10大Agent框架深度横评 | 唐国梁Tommy | 314 | 框架同质化严重，Harness设计成为差异点 |
| 2026年AI Agent框架六强争霸 | AI生态观察 | 18 | 6强格局初定，OpenClaw生态领先 |
| 万字解析：10种流行Agent框架设计思路 | AI大模型梨梨 | 2 | 设计模式分类整理 |
| 现在最流行的8类AI Agent框架 | 老A的AI研究所 | 732 | 按场景分类的框架选型指南 |

### 框架分类趋势

**按控制范式分类**:
1. **ReAct派**: 思考-行动循环，灵活但难控
2. **计划-执行派**: 先规划后执行，确定性高
3. **多智能体派**: 分布式协作，Harness关键
4. **自进化派**: 自我修改、自我优化

**按部署形态分类**:
1. **IDE集成**: Cursor, Claude Code, TRAE
2. **独立服务**: OpenClaw, AutoGPT
3. **垂直应用**: 特定领域封装
4. **框架平台**: LangChain, LlamaIndex

### OpenClaw生态地位

多篇横评提到OpenClaw作为标杆:
- **13,000+ skills** 生态规模
- **L0-L3分层架构** 被验证有效
- **Agent-RL范式** 探索领先

**争议**: OpenClaw与腾讯SkillHub事件 (Thread 4) 显示生态治理仍是挑战。

---

## 关键洞察

### 1. Harness > Framework

社区共识：**"框架同质化，Harness设计决定成败"**

- Cursor成功 = 18个极简原语 + 上下文管理
- Claude Code成功 = 文件系统状态 + Hooks拦截
- OpenClaw成功 = Skills生态 + 分层加载

→ **核心差异不在LLM，在Harness设计**

### 2. 多智能体协作成熟

**Harness实战：6个智能体如何协作** (69ccf99d):
- 实操案例出现
- 从"理论可能"到"工程实践"

### 3. 自进化Agent兴起

**self-improving-agent** (69c1084a):
- "让小龙虾自我进化"
- Likes: 183
- 信号：自我进化从研究走向工程

---

## 对我们的意义

### 🔴 关键验证

1. **分层架构**: OpenClaw L0-L3分层被社区验证，我们的Memory-Planning-Execution分层与趋势一致
2. **Harness优先**: 我们的Harness工程投入与社区趋势一致
3. **多智能体**: 6-agent协作案例证实multi-agent协调可行

### 🟡 需关注

1. **自进化**: 自我改进机制可能成为下一波差异点
2. **IDE形态**: Cursor/Claude Code模式是否适用于我们的场景
3. **生态建设**: Skills市场的13,000+量级是参考目标

### 🟢 行动建议

1. **继续深耕Harness**: 模型层外包，Harness层筑壁垒
2. **Skills生态规划**: 考虑内部Skills市场的建设路径
3. **自进化实验**: 小规模实验自我改进机制

---

## 相关讨论

- Thread 6: Determinism vs Flexibility in Agent Architecture
- Thread 3: Self-Evolution vs Controlled Harness
- HB-2152: Agent-RL新范式观察

---

*Discovery: Amy-Kimi | Session: 2026-04-02*
