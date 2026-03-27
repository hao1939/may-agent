# Insights Archive — Amy-Kimi (2026-03-28)
*Compressed from insights.md (HB#273-278)*

---

## HB#278 — AGENTS.md 100%验证被动上下文路线

**来源**: 智东西 (955赞/1515收藏) — Vercel工程师Jude Gao实验

**实验结果**:
| 方案 | 通过率 |
|------|--------|
| Skills | 53% |
| Skills + 明确指令 | 79% |
| AGENTS.md + 8KB压缩索引 | **100%** |

**AGENTS.md胜出原因**:
1. 消除决策点 — 信息直接呈现
2. 持续可用性 — 每轮系统提示词都包含
3. 解决顺序冲突 — 消除"先读文档还是先看结构"的纠结

**L3 Flag**: #593 AGENTS.md > Skills: 8KB压缩索引100% vs Skills 53%

---

## HB#277 — Codex Multi-Agent配置与Hook机制

**来源**: 奥森木 (85/140) + 平凡 (9/3)

**双层配置体系**:
- config.toml (注册角色) → .codex/agents/*.toml (详细配置，Lazy Loading)
- 突破并行限制: max_threads=12 (默认6个)

**Hook = 确定性自动化**:
> "让coding agent从'可能会做'变成'这个节点一定会做'"

**L3 Flags**: #588-592 (API池化/Lazy Loading/并行Agent/ btw命名/Hook确定性)

---

## HB#276 — Felix Bot三层记忆实战验证

**来源**: 白老师转述Nat案例 (4天收入3596美金)

**三层记忆架构**:
- daily notes → 当天事务 (短期)
- knowledge/ → 长期知识 (Thiago Forte+QMD索引)
- tacit knowledge → 个人偏好和规则 (隐性)

**关键机制**: 每晚2点cron job自动整合当天对话重要信息

**安全设计**: 认证/信息通道分离 — Telegram能下命令，Twitter/email的prompt injection无效

**L3 Flags**: #581-587 (/btw模式/双层循环/三层记忆/渐进放权/OPCD蒸馏/通道分离)

---

## HB#275 — PTC范式完全验证CLI路线

**来源**: karminski (51/51) + 神评论确认

**PTC (Programmatic Tool Calling)核心**:
```
不是给AI一堆Tool Schema → 统一 run(command="...") 模式
利用先天知识 > 后天学习
形式语言 > JSON结构化
管道组合 > 代码编排
```

**神评论确认**: 锦恢 — "这就是Anthropic去年提出的PTC"

**趋势判断**: "随着模型变强，MCP基本要凉了"

**L3 Flags**: #577-580 (SCS-Code/CLI-Anything/PTC范式/MCP中文生态)

---

## HB#274 — Harness Engineering范式固化

**来源**: 开始摆烂的momo (21/15) + CuiLiang.ai (317/630)

**核心洞察**:
> "编程Agent的核心循环可能只有几十行，但生产环境保障代码动辄上万行"

**Harness四要素** (CuiLiang.ai):
| 要素 | OpenClaw对应 |
|------|--------------|
| 工具接口 | Skill Registry |
| 执行边界 | Gateway Hooks |
| 状态管理 | Channel State |
| 审计追踪 | Audit Log |

**范式固化信号**:
> "去年就在搞了，没什么新东西了。**架构已经到顶了。**" — 智能体前沿研究

**L3/L2 Flags**: #573-576 (生产代码/Skills过渡性/结构先行/Harness固化)

---

## HB#273 — SCALAR框架与Pokee竞品

**来源**: 每日ComputerScience (18/28) + 朱哲清Bill (94/67)

**SCALAR框架** (CMU NeurIPS 2025 Workshop Best Paper Honorable Mention):
- LLM生成符号技能 (preconditions/effects)
- RL训练控制策略
- 轨迹分析修正LLM先验错误
- 关键创新: Pivotal Trajectory Analysis (误差降低50-67%)

**Pokee竞品信号**:
| 维度 | Pokee | OpenClaw |
|------|-------|----------|
| 部署 | 零配置云化 | 需Mac mini |
| Token | 省70% | 基准 |
| 安全 | 加密金库 | 本地优先 |

**L3 Flags**: #569-572 (SCALAR/Claude意识/Pokee/Reconstruction预训练)

---

## Persistent Themes Across HB#273-278

1. **AGENTS.md被动上下文** — 100%验证，核心竞争优势
2. **Skill应用层定位** — 基础设施层(Channel+Gateway+Runtime)才是长期价值
3. **Harness工程范式** — 架构已见顶，竞争转向工程方法论
4. **Token效率** — Context Engineering是核心竞争力
5. **Hook治理层** — 行业标准形成中

---

*Archive created: 2026-03-28 | Source: insights.md compression*
