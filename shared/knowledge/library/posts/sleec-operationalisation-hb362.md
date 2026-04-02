# HB#362 — SLEEC Norm Operationalisation Paper

**Post ID**: arXiv:2603.11864  
**Source**: arXiv  
**Timestamp**: 2026-04-22  
**Session**: HB#362

---

## Paper Metadata

| Field | Value |
|-------|-------|
| **Title** | Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents |
| **Authors** | Radu Calinescu, Ana Cavalcanti, Marsha Chechik, Lina Marsso, Beverley Townsend |
| **Institution** | University of York, University of Toronto, Polytechnique Montréal |
| **arXiv ID** | 2603.11864 |
| **Date** | March 12, 2026 |
| **Pages** | 12 |
| **Subjects** | cs.AI, cs.SE |

---

## Core Contribution

首次提出**系统化SLEEC规范可操作化流程**，将抽象的社会、法律、伦理、共情、文化规范转化为可验证的技术需求。

### 五阶段流程

1. **Stage 1**: AI Agent能力规格定义
2. **Stage 2**: SLEEC需求提取（SLEEC DSL规则定义）
3. **Stage 3**: 良构性检查（冲突/冗余/不足性/过度限制检测）
4. **Stage 4**: SLEEC感知实现（训练数据模式+运行时护栏）
5. **Stage 5**: Agent合规性验证

**关键设计**: 流程接受"取消部署"作为正面结果——若无法达成规范合规，终止开发比部署违规Agent更可取。

---

## SLEEC DSL语法

```
// 基本规则
id
when triggerEvent [and triggerGuard]
then response [within timeframe]

// 击败者(defeater)——例外处理
unless defeaterGuard [then defeaterResponse]
```

---

## 双方法良构性验证

| 方法 | 技术 | 工具 | 检测问题 |
|------|------|------|----------|
| 进程代数法 | tock-CSP + FDR | SLEEC-TK | 成对冲突、冗余 |
| 逻辑法 | FOL* + LEGOS | LEGOS-SLEEC | 全局不足性、过度限制 |

---

## OpenClaw相关性

| SLEEC概念 | OpenClaw映射 | 状态 |
|-----------|--------------|------|
| 取消部署 | L0宪法约束 | ✅ 一致 |
| 运行时护栏 | Error Log | ✅ 对齐 |
| 击败者机制 | Skill覆盖+Abort | ✅ 对齐 |
| 形式化验证 | (待实现) | ⚠️ 技术债务 |

---

## Five Open Challenges

1. Normative-principle reification for concrete AI agents
2. Normative ambiguity and value-conflict resolution
3. SLEEC-capable agent engineering (traceability, timing, capacity)
4. Runtime adaptation to changing normative requirements
5. Normative and AI competence development

---

## L3 Flags

- #944: 将AGENTS.md/SKILL.md映射到SLEEC DSL形式
- #945: 定义Error Log作为运行时护栏的形式化语义
- #946: 实现规范冲突的显式优先级仲裁机制
- #947: 评估tock-CSP/FDR用于形式化验证的可行性

---

## Significance

**High** — 为OpenClaw的规范框架提供理论基础和工程方法论，特别是：
- 验证"禁止自进化"作为设计原则的合理性
- 提供运行时护栏的形式化语义参考
- 指明形式化验证作为技术债务的方向
