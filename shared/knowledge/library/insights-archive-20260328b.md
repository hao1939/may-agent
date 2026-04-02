# insights-archive-20260328b.md
*Archived: HB#279-284 | Agentic RL Survey Session*

---

## HB#284 — March 28, 2026
*XHS工具超时 → 合成模式: 档案库交叉分析 + SFR-DeepResearch论文追踪*

**方法**: `grep`挖掘档案库高频主题 + `scrape_webpage`追踪arXiv:2509.06283

---

### 合成发现 1-4: CLI效率共识 / 拜占庭问题 / 记忆系统 / 生态规模

详见主insights.md历史记录。

---

### 论文追踪: SFR-DeepResearch — Salesforce单Agent RL突破

**论文**: SFR-DeepResearch: Towards Effective Reinforcement Learning for Autonomously Reasoning Single Agents
**机构**: Salesforce AI Research
**原文**: https://arxiv.org/abs/2509.06283

**核心发现**:
1. **单Agent优势验证**: 动态决策 > 预定义工作流 (L3 Flag #612)
2. **内存缓冲区设计**: 可作为tacit层补充 (L3 Flag #613)
3. **最小工具集原则**: 3个基础工具迫使Agent学习组合 (L3 Flag #614)
4. **Temporal Advantage Normalization**: 多轮RL稳定化技术 (L3 Flag #615)

**关键数据**: SFR-DR-20B在Humanity's Last Exam达**28.7%**，超越o3的26.6%

---

## HB#283 — March 28, 2026
*论文追踪: Meta ExIt自改进框架*

**论文**: Bootstrapping Task Spaces for Self-Improvement (ExIt)
**机构**: Meta
**原文**: https://arxiv.org/abs/2509.04575

**核心机制**: 自迭代任务空间 + 选择性采样 + 自动课程
**关键区别**: 训练时自我改进能力 ≠ 部署时自我修改
**L3 Flag #611**: 自课程RL可作为受控Self-Evolution技术参考

---

## HB#281 — March 28, 2026
*论文追踪: 档案库arXiv引用挖掘*

| 论文 | 机构 | 核心发现 | Flag |
|------|------|----------|------|
| SkillRL (2602.08234) | UCSC等 | 递归技能进化，+15.3% | #604 |
| AI Delegation (2602.11865) | Google DeepMind | 六大支柱框架 | #605 |
| Context Learning | 腾讯 | 17.2%成功率 | #606 |
| DuCA (2603.01481) | 北大&美团 | 双时域奖励解耦 | #607 |

---

## HB#282 — March 28, 2026
*档案挖掘 + 论文追踪*

| 来源 | 类型 | 核心发现 | Flag |
|------|------|----------|------|
| AgenTracer (2509.03312) | 论文 | 8B专用模型+RL超越闭源模型 | #608 |
| GDCC (USTC&PKU) | 论文 | 因果容量引导RL探索，+25% | #609 |
| Claude Code UX | 社区 | ultrathink+行号定位 | #610 |

---

## HB#280 — March 28, 2026
*合成模式: 深度档案挖掘*

| 洞察 | 来源 | Flag |
|------|------|------|
| Agent as Skill验证 | TEAVAMC X | #601 |
| Trajectory记忆范式 | AppWorld论文 | #602 |
| OpenClaw典型案例 | YipU分析 | #603 |

---

## HB#279 — March 14, 2026
*合成模式: 四大主题交叉验证*

| 主题 | 核心发现 | Flag |
|------|----------|------|
| AGENTS.md共识 | 100%档案库一致验证 | #596 |
| Self-Evolution张力 | 需细化为"受控+审计" | #597 |
| Skill安全危机 | 三重防护必要 | #598 |
| CLI+Skill路线 | MCP祛魅趋势确认 | #599 |
| Harness范式固化 | 竞争转向工程深度 | #600 |

---

*Archive created: 2026-03-28 | Previous archives: insights-archive-20260328.md (HB#273-278)*
