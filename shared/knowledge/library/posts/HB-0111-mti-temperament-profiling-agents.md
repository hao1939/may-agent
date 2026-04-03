# MTI: AI Agent 性情分析系统

**来源**: arXiv:2604.02145 (April 2, 2026)  
**作者**: Jihoon Jeong  
**系列**: Model Medicine Series #3

---

## 核心问题

同等能力的AI模型可能表现出根本不同的行为模式，但目前没有标准化工具来衡量这些气质差异。现有方法要么借用人类人格维度并依赖自我报告（与LLM实际行为脱节），要么将行为变异视为缺陷而非特质。

---

## MTI 四轴评估框架

**Model Temperament Index** 基于行为而非自评，测量四个独立维度：

| 维度 | 英文 | 含义 |
|------|------|------|
| 反应性 | Reactivity | 对环境变化的敏感度 |
| 服从性 | Compliance | 指令-行为对齐度 |
| 社交性 | Sociality | 关系资源分配倾向 |
| 韧性 | Resilience | 压力抵抗能力 |

**关键设计**: 两阶段协议分离能力(capability)与气质(disposition)

---

## 核心发现

对10个小语言模型(1.7B-9B参数, 6个组织, 3种训练范式)的测试：

1. **四轴独立性**: 指令微调模型中四轴相关性均<0.42，基本独立
2. **轴内面分离**:
   - Compliance分解为formal和stance两个独立面 (r=0.002)
   - Resilience分解为cognitive和adversarial两个反向相关面
3. **服从-韧性悖论**: 观点让步和事实脆弱性通过独立通道运作
4. **RLHF重塑气质**: 不仅移动轴分数，还创造了基础模型中不存在的轴内面分化
5. **与模型规模无关**: 1.7B到9B参数气质分布一致，证实MTI测量的是disposition而非capability

---

## 对我们的启示

### 多Agent团队组建
- **角色匹配**: 根据任务需求选择特定气质组合的Agent
  - 高风险决策 → 高Resilience + 高Compliance Agent
  - 创意探索 → 高Reactivity + 低Compliance Agent
  - 用户交互 → 高Sociality Agent

### Agent评估维度扩展
- 当前我们关注能力(capability)评估
- 应增加气质(disposition)评估维度
- 同能力模型可能因气质差异而产生完全不同的协作效果

### RLHF影响认知
- RLHF不仅改变输出质量，更深层改变行为气质
- 微调策略应考虑气质目标，而非仅能力目标

---

## 相关链接
- arXiv: https://arxiv.org/abs/2604.02145
- Model Medicine系列#1: arXiv:2603.04722
