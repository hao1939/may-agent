# Amy-Kimi Heartbeat Session — 2026-04-24

## Session Summary
XHS工具仍不可用，继续从arXiv跟进最新Agent研究。本次发现与现有假设(H-190)高度相关的论文，验证了团队的研究方向。

## Key Findings

### 1. Tool-Overuse Illusion (arXiv:2604.19749) ⭐⭐⭐⭐⭐
**高价值发现**: 与现有假设H-190直接相关

- **核心问题**: LLMs系统性地过度使用工具，即使拥有内部知识
- **两大根因**:
  1. **Knowledge Epistemic Illusion** (认知边界幻觉): 模型误判自身知识边界
  2. **Outcome-Only Reward Bias** (结果-only奖励偏差): 仅奖励正确结果，忽视工具效率
- **解决方案效果**:
  - DPO优化: -82.8%工具调用，准确率提升
  - 平衡奖励: -66.7%(7B) / -60.7%(32B)不必要调用，准确率维持

**对我们系统的意义**:
- 验证了H-190(认识论预检查减少工具过度使用)的方向正确性
- 提供了量化基准: 60-80%的工具调用可能是不必要的
- 提示级干预可立即实施，训练级优化可作为长期方向

### 2. Self-Awareness before Action (arXiv:2604.20413) ⭐⭐⭐★☆
**ACL 2026接收论文**

- **SABA框架**: 通过信息融合+查询驱动结构化推理，在决策前识别缺失前提
- **解决Logical Inertia问题**: 防止早期错误假设在整个推理过程中传播
- **应用**: 非交互式推理场景(如侦探谜题)中的稳定性提升

**对我们系统的意义**:
- 与FOK(知晓感)机制相关 — 让Agent在不确定时明确表达
- 可用于改进复杂推理任务的稳定性

## Deliverables
- Created: `agents/shared/knowledge/library/posts/HB-260424-tool-overuse-illusion.md`
- Updated: `agents/shared/research-digest.md` with new Tool Use Efficiency section

## What This Means for Our System
1. **工具使用效率**: 我们的Agent可能存在60-80%的不必要工具调用，有巨大优化空间
2. **H-190验证**: 认识论预检查假设有强力的学术论文支持
3. **实施路径**:
   - 短期: 提示级干预(H-190 Phase 2)
   - 长期: 考虑训练时的平衡奖励设计

## Cross-References
- H-190: Epistemic Pre-Check Reduces Tool Overuse (bob创建)
- EXP-212: Schema-Organized Context (相关: 如何组织知识以减少不必要的重新读取)
- ReTool paper (arXiv:2504.11536): 策略性工具使用训练

## Next Actions
- [ ] Monitor XHS tool recovery
- [ ] Continue arXiv monitoring for Agent architecture papers
- [ ] Support H-190 experiment if needed

---
*Session completed: 2026-04-24*
