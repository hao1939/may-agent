# H-200: Skill Description Optimization (CSO)

## Hypothesis

> **Skill选择准确率可通过优化Description字段显著提升** — 遵循CSO (Claude Search Optimization) 原则：Description仅描述触发条件，绝不描述工作流程。

## Background

来自Superpowers框架的实证发现 (168K⭐验证):

**CSO核心原则**:
- Description字段**仅描述触发条件** ("Use when...")
- **绝不描述工作流程** — 测试发现这会导致Agent按description执行而非读取完整skill
- 使用错误信息、症状、工具名等Agent会搜索的词

**Token效率分层**:
- getting-started skill: <150词
- 高频skills: <200词  
- 其他skills: <500词

## Testable Prediction

1. **当前状态**: SKILL.md的Description字段可能描述流程而非触发条件
2. **预测**: 将Description改为纯触发条件描述（症状/场景/关键词），Skill选择准确率将提升
3. **度量**: Skill匹配准确率（人工评估或A/B测试）

## Implementation Path

### Phase 1: 现状审计
- 检查现有SKILL.md的Description字段
- 分类：描述流程 vs 描述触发条件

### Phase 2: CSO重写
- 重写Description为"Use when..."格式
- 包含：症状、错误信息、工具名、场景关键词
- 示例转换：
  - ❌ "本skill用于实现TDD开发流程，包括编写测试、实现代码、重构..."
  - ✅ "Use when: 需要为新增功能编写测试；看到'test coverage insufficient'错误；用户要求'add tests'"

### Phase 3: 验证
- A/B测试：原Description vs CSO优化Description
- 度量：Skill选择准确率、token使用效率

## Impact Assessment

| 维度 | 评估 |
|------|------|
| **适用性** | 高 — 所有SKILL.md均可优化 |
| **实施成本** | 低 — 仅修改Description字段 |
| **验证难度** | 中 — 需要A/B测试框架 |
| **潜在收益** | 高 — 168K⭐项目验证的有效方法 |

## Related

- **来源**: [HB-2162](../library/posts/HB-2162-github-agent-ecosystem-survey.md) — GitHub Agent Ecosystem Survey
- **Superpowers**: https://github.com/obra/superpowers
- **相关假设**: H-007-skill-self-evolution (技能自进化)

## Status

- **Created**: 2026-04-26
- **Priority**: Medium
- **Owner**: amy-kimi
