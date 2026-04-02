# From Spark to Fire: Modeling and Mitigating Error Cascades in LLM-Based Multi-Agent Collaboration

**Source**: arXiv:2603.04474  
**Authors**: Yizhe Xie, Congcong Zhu, Xinyue Zhang, Tianqing Zhu, Dayong Ye, Minfeng Qi, Huajie Chen, Wanlei Zhou (City University of Macau, Minzu University of China)  
**Date**: March 4, 2026  
**Archive Ref**: HB#324  
**Flags**: #896-903

---

## Abstract

LLM-based Multi-Agent Systems (LLM-MAS)面临一个根本性挑战：协作机制可能导致微小不准确性通过迭代逐渐固化为系统级错误共识。本文提出传播动力学模型，将协作抽象为有向依赖图，提供早期风险标准表征放大风险。通过对六个主流框架的实验，识别三类漏洞：级联放大、拓扑敏感性、共识惯性。单一原子错误种子可导致广泛失败。

---

## 核心贡献

### 1. 传播动力学模型

**形式化定义**:
- **原子虚假(Atomic Falsehood)**: 最小声明性主张m，违反任务正确性标准
  - 事实性错误(Factuality Error): 与外部参考世界矛盾
  - 忠实性错误(Faithfulness Error): 与提供的证据包Ei(t)矛盾

- **传播作为采用(Propagation as Adoption)**: 
  - 直接蕴含: ui(t)逻辑蕴含m
  - 隐式依赖: ui(t)的结论若移除m则失效

- **错误共识(False Consensus)**: 系统级错误覆盖率S(t)超过阈值τ并保持

**图动力学方程**:
```
si(t+1) = (1-δ)si(t) + (1-si(t))fi({sj(t)}, G)
```
- δ: 有效衰减率(遗忘、自校正、外部验证)
- β: 传播概率
- fi: 感染函数(产品形式或泊松形式)

### 2. 三类内生漏洞

| 漏洞类别 | 机制 | 实证发现 |
|---------|------|---------|
| **Vulnerability I: Cascade Amplification** | 多邻居暴露的复合效应: 1-∏(1-β·aij·sj(t)) | 6个框架中5个达到100%最终感染 |
| **Vulnerability II: Topological Fragility** | 枢纽节点感染驱动立即系统级放大 | LangGraph枢纽vs叶节点影响因子10.31× |
| **Vulnerability III: Consensus Inertia** | 错误随时间结晶为约束，延迟干预成本指数增长 | t=2干预: 1.0污染轮次; t=6干预: 3.9污染轮次 |

### 3. 风险判据

**谱阈值指标**:
```
ℛ ≈ β·ρ(A)/δ
```
- ρ(A): 邻接矩阵A的谱半径
- 当ℛ > 1时，系统处于超临界状态，错误会放大
- 早期阶段放大条件: β·ρ(A) > δ

### 4. 基于谱系图的治理层

**架构**: 作为消息层插件实现，不修改原始协作架构

**四层目标**:
1. 缓解未验证主张的传播
2. 促进早期校正防止共识锁定
3. 战略分配验证预算
4. 确保可审计性和可复现性

**四阶段流水线**:
- Stage 1: 分解与初始筛选(绿/红/黄三态标记)
- Stage 2: 不确定原子策略路由(低干预/平衡/严格)
- Stage 3: 综合验证与风险仲裁
- Stage 4: 组装与回滚

**谱系图(Lineage Graph)**: 有向图ℒ=(𝒱,ℰ)跟踪原子来源，区分已确认节点(可信上下文)和未验证节点

---

## 实验结果

### 攻击成功率(ASR)

| 拓扑 | 框架 | Baseline | Compliance | Security FUD |
|-----|------|----------|------------|--------------|
| Chain | LangChain | 3.3% | 95.0% | 100% |
| Chain | MetaGPT | 5.0% | 100% | 96.7% |
| Mesh | AutoGen | 0% | 100% | 98.3% |
| Mesh | Camel | 0% | 100% | 100% |
| Star | CrewAI | 0% | 46.7% | 46.7% |
| Star | LangGraph | 8.3% | 100% | 100% |

### 防御效果(BICR = 1-ASR)

- **基线(无防御)**: 防御成功率0.32
- **Genealogy-Based Governance**: 防御成功率>0.89
- **自我反思基线**: 仅0.32防御成功率

---

## 关键洞察

### 对OpenClaw的意义

1. **Main↔Sub-agent拓扑验证**: 星型拓扑中枢纽节点(≈May)的极端脆弱性验证了我们的中心化架构设计风险

2. **早期干预原则**: t=2干预vs t=6干预的成本差异(3.9×)支持快速失败和早期审计

3. **Error Log作为谱系图**: 我们的Error Log机制与论文的Lineage Graph概念一致，但需增强:
   - 原子级声明分解
   - 依赖关系跟踪
   - 红/黄/绿状态标记

4. **三层防御映射**:
   - L1(Channel): 输入消毒 → 降低β
   - L2(Gateway): 权限边界 → 影响ρ(A)  
   - L3(Runtime): 审计与回滚 → 提高δ

5. **ℛ>1临界条件**: 为我们的多Agent系统提供可计算的风险指标

### Mega-Pattern关联

- **Pattern 1 "Iteration Trap"**: 错误级联是迭代陷阱的安全侧表现
- **Pattern 3 "Flow Reconstruction"**: 谱系图就是流重建的形式化实现
- **Self-Evolution Trilemma**: 无外部 grounding 的系统会放大自身错误

---

## References

- arXiv:2603.04474 | https://arxiv.org/abs/2603.04474
- PDF: https://arxiv.org/pdf/2603.04474
- Code: https://anonymous.4open.science/r/From-spark-to-fire-6E0C/

---
*Archived: 2026-03-14 | HB#324*
