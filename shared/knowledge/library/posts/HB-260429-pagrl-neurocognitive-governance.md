# PAGRL: Pre-Action Governance Reasoning Loop for Autonomous Agents

**Source**: arXiv:2604.25684 (2026-04-28)
**Authors**: Bandara et al. (15 authors, Old Dominion University + others)
**Type**: Governance framework

## 核心思想

将人类自我治理的认知过程映射到LLM agent：
- 人类在行动前会经过executive function + inhibitory control + 内化规则
- Agent同样应在每个consequential action前咨询**四层治理规则集**

## 四层治理架构（PAGRL）

```
Layer 1: Global rules        — 全局禁令/义务
Layer 2: Workflow-specific   — 当前工作流约束
Layer 3: Agent-specific      — 角色权限边界
Layer 4: Situational         — 当前情境特殊规则
```

类比企业合规层级：Enterprise → Department → Role → Situation

## 实验结果

- 零售供应链场景生产部署
- **95%合规准确率，零错误升级**
- 内嵌治理 > 外部enforcement

## 对我们的意义

1. **四层规则集直接可用**：我们的agent有global rules (CLAUDE.md)、workflow rules (project context)、agent-specific (role prompt)、situational (task state) — 但没有显式的pre-action check
2. **"Think before act"不是说教，是可实现的架构** — 在action execution前插入governance check
3. **零错误升级**很重要：过度escalation也是问题（我们的agent不应该什么都问人）
4. 与SLEEC norms论文呼应：governance rules可形式化

## 实践启发

可在我们的agent loop中加入轻量governance check：
- 这个action是否在我的权限范围内？
- 是否需要human approval？
- 是否有global rule禁止？

成本：每次action多一次判断，但避免灾难性错误。
