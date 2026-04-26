# H-014: Token效率危机 — OpenClaw存在伪进化问题

**Status**: 🔴 **CRITICAL - Requires Immediate Investigation**
**Created**: 2026-04-26
**Source**: SEA-Eval paper (arXiv:2604.08988) + AgentEvolver framework analysis

---

## Hypothesis

**OpenClaw的当前架构存在严重的Token效率问题，呈现"伪进化"特征而非真正的自进化。** 具体表现为：

1. **高Token消耗**: 比同类框架(GenericAgent)高7倍Token消耗
2. **缺乏收敛性**: 序列任务中Token消耗剧烈波动而非单调收敛
3. **飞轮失效**: 执行→蒸馏→增强的进化飞轮未能有效闭环

## Evidence

### SEA-Eval论文数据

| Metric | OpenClaw | GenericAgent | Ratio |
|--------|----------|--------------|-------|
| Total Tokens | 27,364K | 3,918K | **7×** |
| Task 1 (DB Retrieval) | ~520K | ~520K | 1× |
| Task 5 (DB Retrieval) | **Crash** | **117K** | N/A |
| Success Rate | 100% | 100% | Same |

**关键发现**: 相同成功率下，Token效率相差7倍，OpenClaw在序列第5个任务崩溃。

### 失败模式诊断

**Distillation Failure (Φ函数失效)**:
- 现象: 完成任务但记忆库充满"死知识"
- 根因: 经验蒸馏函数未能从轨迹提取可复用策略

**Retrieval Failure (Ψ函数失效)**:
- 现象: 有历史策略但认不出相似任务
- 根因: 选择性记忆转移函数无法识别结构相似性

## Implications

### 🚨 Critical Issues

1. **成本不可持续**: 7倍Token消耗意味着7倍成本
2. **用户体验差**: 重复任务没有变快
3. **架构缺陷**: 可能存在系统性设计问题

### 🔬 Research Directions

1. **Keff指标**: 引入进化效率系数 = 初始Token / 第N次Token
2. **飞轮验证**: 建立执行→蒸馏→增强三步闭环检查
3. **CuES借鉴**: 引入AgentEvolver的三大机制

## Test Plan

### Phase 1: 现状测量 (Immediate)

- [ ] 测量当前OpenClaw跨session的Token消耗趋势
- [ ] 选择3个代表性Skill，各执行5次，记录Token消耗序列
- [ ] 计算Keff = Token_1 / Token_5

**预期结果**:
- 如果Keff < 2: 确认伪进化问题
- 如果Keff > 5: 飞轮有效运转

### Phase 2: 根因分析 (1 week)

- [ ] 检查Skill系统是否真正减少了重复推理
- [ ] 分析session数据是否被有效蒸馏到insights
- [ ] 验证相似任务是否能正确检索历史策略

### Phase 3: 改进实验 (2 weeks)

- [ ] 引入Self-Navigating: 经验引导执行
- [ ] 实现Attribution: 因果信用分配
- [ ] 重新测量Keff指标

## Related Work

- **SEA-Eval**: arXiv:2604.08988 — Token收敛是进化金标准
- **AgentEvolver**: CuES累积经验策略框架
- **Evolutionary Flywheel**: 执行→蒸馏→增强三步闭环

## Updates

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-26 | Created | Initial hypothesis based on SEA-Eval findings |

---

**Next Action**: 立即启动Phase 1测量，验证Token效率现状。
