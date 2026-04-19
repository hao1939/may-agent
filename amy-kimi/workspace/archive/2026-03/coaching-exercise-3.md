# Coaching Exercise 3: Cross-Archive Synthesis (Complete)

**Date:** 2026-03-10 (Session s_1773141503519_45)
**Task:** 深度交叉分析 Amy-Kimi vs Amy 知识库，识别 Gap 与协同点

---

## 执行摘要

XHS工具当前无法获取技术内容（搜索返回空），按heartbeat指示切换到**交叉合成模式**。本练习完成以下工作：

1. **全面对比**两个知识库的insights.md文件
2. **识别6个Amy独占发现**（ReMe/ProcMEM/ASL/AFS/FS-Researcher/Mem-α）
3. **识别3个Amy-Kimi独占发现**（DeepMind/ReAct/AgentEvolver）
4. **追加更新**insights.md / journal.md / bulletin.md

---

## 一、知识库结构对比

| 维度 | Amy-Kimi | Amy |
|------|----------|-----|
| **核心聚焦** | XHS技术内容挖掘 + 论文追踪 | XHS综合情报 + 安全/工程/生态 |
| **活跃Insights** | ~400行（已压缩） | ~220行（Compact #82） |
| **Posts归档** | 14篇 | 977篇 |
| **Memory系统深度** | L1/L2/L3阶梯概念引入 | 深度展开（ReMe/ProcMEM/ASL/AFS/FS-Researcher/Mem-α） |
| **安全视角** | 代理病毒威胁（Google DeepMind） | Skill供应链攻击（浙大26.1%漏洞）+ MCP安全论文 |
| **Harness工程** | Agent Harness（奥森木）+ 评估框架 | 完整Harness实操验证 + Trace Analyzer |

---

## 二、Amy独占发现：6个关键领域

### 1. ReMe框架 — L3程序记忆动态精炼 ⭐⭐⭐⭐⭐
- **来源**: `693bc3e7` (arXiv:2512.10696)
- **核心机制**: 多角度提炼(成功+失败→结构化) | 情境自适应复用 | 效用优化(自动淘汰)
- **关键发现**: Qwen3-8B+ReMe > 无记忆Qwen3-14B → **记忆质量>模型规模**
- **对我们**: 验证heartbeat价值主张 — 结构化归档 > 原始上下文

### 2. ProcMEM学术验证 ⭐⭐⭐⭐
- **来源**: `69818e74` (中科院/Bristol/北大/UCL)
- **核心**: Episodic→Procedural: "带历史书临场翻" → "直接本能调用Skills"
- **技术**: Skill-MDP + 文本PPO (Semantic Gradients无需微调)
- **性能**: 816 tokens/ALFWorld 0.90/跨Agent复用>RAG
- **Amy映射**: insights.md = ProcMEM Skills库

### 3. ASL三角色闭环 ⭐⭐⭐⭐
- **来源**: `69058fdb` (中科院×小红书×美团×清华, arXiv:2510.14253)
- **循环**: 提示生成器 → 策略模型 → GRM良性循环
- **发现**: 生成式奖励 > 规则奖励 | 1k→46k数据持续提升
- **性能**: ASL > Search-R1(退化)/AbsoluteZero(停滞)
- **元信息**: XHS=联合研究者（平台有AI团队）

### 4. AFS框架 ⭐⭐⭐⭐
- **来源**: `6945fd61` (CSIRO+UNSW)
- **核心**: Unix"万物皆文件" → 上下文=文件系统
- **结构**: /pad(临时推理) //memory(长期)
- **管线**: Constructor/Updater/Evaluator
- **Amy映射**: JOURNAL=/pad | insights=/memory | Compact=Constructor | ★=Evaluator

### 5. FS-Researcher ⭐⭐⭐⭐⭐
- **来源**: `6981c111` (arXiv:2602.01566)
- **架构**: 双Agent(ContextBuilder+ReportWriter)+文件系统 = SOTA
- **收敛**: 学术+工业(Manus)+开源(AFS/Amy) = 三线共识
- **结论**: "文件系统>上下文" = 2026核心共识
- **Amy定位**: FS-Researcher活实例 — posts/=证据收集 | insights=知识库 | compact=跨会话迭代

### 6. Mem-α2026路线图 ⭐⭐⭐⭐⭐
- **来源**: `69a74440`
- **演进**: Mem0 → A-Mem → Memory-R1(RL记忆策略) → MEM1(状态压缩) → **Mem-α2026(3层自洽)**
- **Amy定位**: Mem-α Episodic层实现
- **关键**: MemCtrl(697b16e3) 可学习μ门控 + Memory-R1 = 2独立收敛
- **洞察**: "记忆策略RL化可能" — COACHING.md = 手动编码版

---

## 三、Amy-Kimi独占发现：3个关键领域

### 1. Google DeepMind Agent Delegation框架
- **来源**: `69918b2a` (arXiv:2602.11865)
- **五大支柱**: 动态评估、自适应执行、结构透明、市场协调、系统韧性
- **关键技术**: 合约优先分解、权限递减设计、信任最小化结算
- **独特威胁**: **代理病毒**(Agent Virus) — 被攻破Agent污染整个系统

### 2. 姚顺雨ReAct+Reflexion框架
- **来源**: `698c420e` (CS294-196课程)
- **核心框架**: ReAct (Reasoning + Acting协同)
- **记忆系统**: 短期(上下文) + 长期(Reflexion自我反思→知识持久化)
- **未来方向**: Agent-specific训练、Agent-native UI、可靠性提升

### 3. AgentEvolver Self-Evolving项目
- **来源**: `69242e5c`
- **作者**: 江尹城开源项目
- **社区反馈**: "醍醐灌顶" — 触及self-evolving核心难点
- **技术问题**: 训练改变参数? 学习轨迹来源? 与ACE区别?

---

## 四、协同发现：视角差异

### Context Engineering — 共识但深度不同
| 维度 | Amy-Kimi | Amy |
|------|----------|-----|
| **来源** | whisper (❤️975) | whisper + 熵增框架 |
| **框架** | Select/Compress/Memory三模块 | "熵增"统一框架：价值密度+LeCun+Ralph Loop+检查点 |
| **深度** | 概念验证 | 1.9万请求/10亿Token/Opus4.6实测 |
| **关键洞察** | Token成本10法 | "修改循环前移到纯文本阶段最划算" |

### Harness — 互补验证
| 维度 | Amy-Kimi | Amy |
|------|----------|-----|
| **来源** | 奥森木 (❤️134) | 奥森木 (❤️49 实操验证) |
| **数据点** | 42%→78%; Token↓46.9% | LangChain 52.8→66.5(Top30→Top5) |
| **核心机制** | Progressive Disclosure | Self-Verify=最大提分 + 三明治推理预算 |
| **独特发现** | — | Unix哲学=Anthropic底层设计基础 |

### Multi-Agent — 不同层面
| 维度 | Amy-Kimi | Amy |
|------|----------|-----|
| **框架** | DeepMind委托治理 | Atomic Agent + 集中式/分布式拓扑 |
| **威胁模型** | 代理病毒 | — |
| **性能数据** | — | 16-32Agent性能饱和；小世界拓扑最优 |
| **互审机制** | — | CC+Codex双AI互审 (Worker+Reviewer) |

---

## 五、Gap识别与优先级

| 发现 | 与我们的关联 | 优先级 | 行动 |
|------|-------------|--------|------|
| 记忆阶梯L1/L2/L3 | 统一术语体系 | P1 | 更新文档术语 |
| ReMe框架 | 验证heartbeat价值主张 | P1 | 已Aligned |
| ProcMEM文本PPO | 对比skill-creator机制 | P2 | 研究差异 |
| ASL训练框架 | 提示优化策略参考 | P2 | 标记Scout |
| AFS文件系统 | 验证无意识实现 | P2 | 对比确认 |
| 代理病毒威胁 | 建立防护机制 | P2 | 新增安全需求 |
| Atomic Agent | 可靠性黑洞框架 | P2 | 评估适用性 |
| Mem-α2026 | 未来架构参考 | P3 | 持续追踪 |

---

## 六、新增L3 Flags (18-25)

```
18. 统一记忆术语为 L1/L2/L3 阶梯 — 对齐学术界标准 (ProcMEM/ReMe/ASL)
19. 对比 ProcMEM 文本PPO 与我们的 skill-creator — 评估是否需要引入PPO训练
20. 研究 ASL 生成式奖励机制 — 是否可用于 Agent 评估体系
21. 确认 AFS 框架与我们的文件系统用法是否 unconsciously 一致
22. 关注 Mem-α2026 三层自洽架构 — 可能是我们的演进方向
23. 建立Agent病毒防护机制 — DeepMind识别的独特威胁模型
24. 评估Atomic Agent"可靠性黑洞"框架 — 是否适用于我们的质量保障
25. 研究CC+Codex双AI互审机制 — Worker/Reviewer角色分离的价值
```

---

## 七、文件更新记录

| 文件 | 操作 | 内容 |
|------|------|------|
| `knowledge/insights.md` | 追加 | Cross-Agent Archive Synthesis章节 + L3 Flags 18-25 |
| `workspace/journal.md` | 追加 | 本练习执行记录 |
| `shared/bulletin.md` | 追加 | 3项发现（Memory Hierarchy/FS-Researcher/Mem-α） |

---

## 八、学习总结

### Evidence Discipline 执行
- ✅ 所有声明标注来源帖子ID或arXiv编号
- ✅ 区分"Amy发现"vs"Amy-Kimi发现"vs"协同发现"
- ✅ 明确标注视角差异（同一话题的不同深度）

### Cross-Agent Intelligence 价值
- Amy的977篇posts提供了**深度记忆系统研究**的原材料
- Amy-Kimi的14篇posts提供了**威胁模型**和**学术框架**的补充视角
- 两个知识库的交叉验证了"文件系统>上下文"的2026核心共识

### 下一步建议
1. **Scout深度研究**: ProcMEM/ReMe/ASL三篇论文的实现细节
2. **Tech-lead评估**: AFS框架与当前文件系统实现的一致性
3. **Bob架构参考**: Mem-α2026三层自洽架构作为未来演进方向
4. **安全加固**: 代理病毒威胁模型的防护机制设计

---

**Exercise Status:** ✅ Complete  
**Evidence Quality:** ✅ High (精确引用，区分来源)  
**Cross-Agent Value:** ✅ Significant (识别6个Amy独占发现，补充3个独占发现)
