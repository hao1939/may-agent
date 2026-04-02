## HB-2155 — MCP争议: 极简派vs标准派的架构分歧 (2026-03-18)
**Source**: XHS @徐昊 — "写了3个月AI Agent后发现：根本不需要" (835赞/1042收藏/178评论)  
**Tags**: [AI Agent, MCP, 技术争议]  
**TL;DR**: 🔥🔥🔥 **关键分歧** — MCP是否过度设计？

### 核心争议

作者激进观点：**内部使用场景根本不需要MCP**，HTTP请求或CLI调用就足够了。

### 两派观点

| 极简派 | 标准派 |
|--------|--------|
| "企业内部HTTP可解决万物" | "商用时无法通过CLI直接访问对方系统" |
| "MCP只是多了很多要求的REST API" | "数据不在你这，你用啥HTTP？" |
| "MCP只是规范化没维护的文档" | "MCP的意义在于把服务器公开给别人" |

### 技术讨论要点

- **pagination**: CLI可用 `--page 2 --limit 20` 标准API设计
- **安全**: bash可建立专门LLM用户并设置权限
- **本质**: "MCP无非就是Function Call的一个规范而已"

### 对我们意味着什么

1. **技能注册中心的抉择**: 内部技能是否必须走MCP？还是保持轻量级HTTP/CLI调用？
2. **分层策略**: 对外接口用MCP保证兼容性，内部工具用更轻量方案
3. **避免教条**: 技术选型应基于实际场景，而非盲目追新

---

## HB-2156 — Harness Engineering验证: 约束框架的四大支柱 (2026-03-18)
**Source**: XHS @CuiLiang.ai — "Harness Engineering：Agent工程的第三次" (493赞/950收藏)  
**Tags**: [AI Agent, Harness Engineering, 架构设计]  
**TL;DR**: 🔥🔥🔥🔥 **范式验证** — 我们的架构设计符合第三次工程跃迁

### 三次范式跃迁

1. **Prompt Engineering** → 调提示词
2. **Context Engineering** → 控上下文  
3. **Harness Engineering** → 建约束框架 ⬅️ **我们在这里**

### Harness Engineering四要素

> **小跃要努力**的精炼总结：

| 要素 | 含义 | OpenClaw对应 |
|------|------|--------------|
| 🔧 工具接口 | Agent能调用的MCP/skills/白名单 | ✅ skill registry |
| 🚧 执行边界 | 哪些操作需要审批/确认 | ✅ approval gates |
| 📋 状态管理 | 持久化记忆和检查点 | ✅ heartbeat + memory |
| 🔍 审计追踪 | 完整的行为日志 | ✅ ops-receipts |

### 核心洞察

> **"Humans steer. Agents execute."**
> 
> 系统设计（Harness）对性能的影响甚至超过了模型本身的能力。

### 社区反馈

- **智能体前沿研究**: "去年就在搞了，没什么新东西了。架构已经到顶了。"
- **般若爱吃菠萝蜜**: "今年看过最有价值的一篇文章"
- **Meme**: "harness很久之前就已经有了，最开始是cc那边提的"

### L0-L5成熟度阶梯

从CLAUDE.md → Hooks → Skills → 多Agent协作，这与我们的演进路径一致。

### 对我们意味着什么

1. **外部术语背书**: 可用"Harness Engineering"描述OpenClaw架构
2. **验证核心假设**: 约束优于自由、系统重于模型
3. **差异化聚焦**: 当别人还在 Prompt 层探索，我们已在 Harness 层深耕

---

---

