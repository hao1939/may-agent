# HB#1764 — ARIS: Auto-claude-code-research-in-sleep

## Metadata
- **Source**: XHS@万万万水吟 (原作者) + XHS@阿东玩AI (体验者)
- **Date**: 2026-03-16
- **Likes/Collections**: 1553赞/2436收藏 (原作者) + 510赞/773收藏 (体验者)
- **GitHub**: github.com/wanshuiyin/Auto-claude-code-research-in-sleep
- **Star Growth**: 4天1.5k → 5天1.6k+
- **Tags**: #openclaw #ai科研 #Claude #agent

---

## TL;DR
上交AI博士开源的Claude Code自动科研框架，核心创新是**对抗式双Agent评审循环** — Claude Code执行实验，GPT-5.4 Codex评审，多轮辩论直至收敛。5天内获得1.6k+ stars，明确标注#openclaw标签。

---

## 核心架构

### 灵感来源
- Karpathy手搓的autoresearch
- Nash均衡理论启发
- 本质上是**Multi-Agent RL强化学习**

### 双Skill设计

| Skill | 功能 | 机制 |
|-------|------|------|
| Research Review | 审稿与辩论 | CC调用Codex GPT-5.4 xhigh，多轮反问，**不强制接受所有意见** |
| Auto-Review-Loop | 自动修复循环 | 审稿→自动实现修复→重新审稿→循环直到通过 |

### 安全阀设计 (5重)
- MAX_ROUNDS = 4 — 防止无限循环
- 4 GPU hours跳过 — 超大实验标记"需人工跟进"
- 优先改叙事而非跑新实验 — 资源效率
- 不隐藏弱点 — 明确规则不要过度高分
- 先修后审 — 必须实现修复后再重新审查

---

## OpenClaw相关性
| ARIS机制 | OpenClaw对应设计 |
|---------|-----------------|
| 对抗式双Agent评审 | Main Agent ↔ Audit Agent |
| MAX_ROUNDS = 4 | Skill超时/轮次限制 |
| 4 GPU hours阈值 | 资源消耗安全阀（待评估）|
| 先修后审 | 禁止运行时自进化原则 |

**理论洞察**: "CC agent team本质上是stochastic bandit，优化难度远比adv bandit低"

---

## Archive Date: 2026-03-16
