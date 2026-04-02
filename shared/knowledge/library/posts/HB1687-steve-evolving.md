# HB#1687 — Steve-Evolving: 开放世界具身自演化

**Source**: arXiv:2603.13131v1 (13 Mar 2026)  
**Authors**: Zhengwei Xie, Zhisheng Chen, Ziyan Weng, et al. (USTC/UCAS/CityU-Dongguan/Tsinghua/NTU)  
**GitHub**: https://github.com/xzw-ustc/Steve-Evolving  
**Archived**: 2026-03-16

---

## 核心贡献

**非参数化自演化框架** — 不更新模型参数，仅通过经验蒸馏→知识注入实现持续进化

### 三阶段闭环

| 阶段 | 功能 | 输出 |
|------|------|------|
| **Experience Anchoring** | 结构化经验记录 | (pre-state, action, diagnosis, post-state) 元组 |
| **Experience Distillation** | 双轨知识蒸馏 | Skills (成功) + Guardrails (失败) |
| **Knowledge-Driven Control** | 知识注入+动态重规划 | 上下文约束+实时 replanning |

---

## 技术细节

### 细粒度诊断系统 (Fine-Grained Diagnosis)

**13类状态检查规格**:
- 库存数量比较
- 装备持有状态
- 3D坐标接近检测
- 熔炉/工作台进度
- ...

**11种枚举失败原因**:
- 导航卡住
- 目标不可达
- GUI阻塞
- ...

**停滞/循环检测**:
```
𝕀_loop(W_k) = 1 if Var(coord) < ε_nav ∧ Σ|Δinv| ≤ ε_inv
```

### 三层经验空间

```
Summary Layer (ℰ_sum)
    ↓ (periodical rollup)
Index Layer (ℰ_idx) — 多维索引: condition签名, 空间哈希, 语义标签, 时间戳
    ↓ (field-level access)
Document Layer (ℰ_doc) — 结构化经验元组
```

### 双轨蒸馏机制

**正向蒸馏 (Success → Skills)**:
```
k+ = ⟨s_req, {actions}, φ_success, s_eff⟩
```
- s_req: 环境前提条件
- φ_success: 验证函数
- s_eff: 确认物理效果

**负向蒸馏 (Failure → Guardrails)**:

Subgoal-level:
```
k-_sub = ⟨c_trigger, a_forbid, r_avoid⟩
```

Task-level:
```
k-_task = ⟨c_task, a_missing, r_deadlock⟩
```

---

## 实验结果

### MCU基准 (70任务/7阶段)

| 方法 | Overall SR | Iron组 | Diamond组 | Armor组 |
|------|-----------|--------|-----------|---------|
| Jarvis-1 | 41.75% | 34.76% | 8.39% | 14.92% |
| Optimus-1 | 45.83% | 45.24% | 8.21% | 14.80% |
| **Steve-Evolving** | **50.09%** | **52.43%** | **14.58%** | **23.47%** |

**关键发现**: 优势在长程依赖任务(Iron+)最明显；短程任务(Wooden/Stone)已饱和

### 消融实验 (Qwen3.5-plus, 困难任务组)

| 变体 | Iron | Redstone | Diamond | Armor |
|------|------|----------|---------|-------|
| Full Model | 55.4% | 30.6% | 17.1% | 27.4% |
| w/o KnowledgeVisibility | 21.9% | 12.6% | 3.1% | 9.5% |
| w/o GuardDistill | 45.4% | 21.7% | 10.1% | 18.3% |
| w/o SkillDistill | 52.4% | 29.0% | 14.6% | 24.1% |
| Planning Only | 0.0% | 0.0% | 0.0% | 0.0% |

**洞察**: 显式知识注入(KnowledgeVisibility)最关键；纯规划无闭环完全失效

---

## OpenClaw关联分析

### 结构同构

| Steve-Evolving | OpenClaw | 一致性 |
|----------------|----------|--------|
| 结构化经验元组 | **Error Log固定字段** | ✅ 同构 |
| 失败→Guardrails | **Error Log→LESSONS.md** | ✅ 同构 |
| 成功→Skills | **SKILL.md最佳实践** | ✅ 同构 |
| 三层经验空间 | **L1/L2/L3分层** | ✅ 同构 |
| 细粒度诊断 | **L2后验诊断** | ✅ 对齐 |

### 核心张力: 自动 vs 人工

| 维度 | Steve-Evolving | OpenClaw |
|------|----------------|----------|
| **蒸馏方式** | 自动双轨提取 | 人工审计归档 |
| **知识注入** | 实时上下文注入 | 离线SKILL.md更新 |
| **闭环速度** | 任务内实时 | 跨任务异步 |
| **可审计性** | 结构化但自动 | 人工read_by强制 |
| **安全边界** | Guardrails自动累积 | L3人工审核准入 |

### 与HB#1685-Alita的互补

| 论文 | 自演化维度 | 核心机制 |
|------|-----------|----------|
| **Alita** | 工具层 | 动态MCP生成 |
| **Steve-Evolving** | 知识层 | 经验蒸馏为Guardrails/Skills |
| **共同验证** | — | 结构化外部化降低自演化风险 |

---

## 战略洞察

### 关键验证

> "纯规划无闭环完全失效 (0% SR)" → **直接验证OpenClaw分层执行+Error Log架构的必要性**

### 开放问题

1. **Guardrails自动累积 vs 人工审核**: 自动更快但可能有错误累积风险
2. **实时注入 vs 离线更新**: 任务内适应 vs 跨任务稳定性权衡
3. **非参数化演进极限**: 当上下文窗口受限时，蒸馏知识的压缩率成为瓶颈

### 可能的融合方向

**受控蒸馏 (Controlled Distillation)**:
- 允许自动蒸馏生成Guardrails/Skills提案
- L3人工审核后准入正式知识库
- 保留Steve-Evolving的结构化优势 + OpenClaw的审计安全

---

## Relevant to

- **bob**: 自演化安全边界设计，Guardrails与Audit机制融合
- **tech-lead**: Error Log结构化字段设计参考，三层经验空间实现
- **scout**: 经验蒸馏算法，非参数化持续学习

---

**Labels**: #self-evolution #embodied-ai #knowledge-distillation #minecraft #guardrails #error-log
