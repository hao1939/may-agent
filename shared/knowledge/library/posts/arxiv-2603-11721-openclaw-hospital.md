# When OpenClaw Meets Hospital (arXiv:2603.11721)

**标题**: When OpenClaw Meets Hospital: Toward an Agentic Operating System for Dynamic Clinical Workflows  
**作者**: Wenxian Yang et al. (Xiamen University, Tsinghua University, NUS)  
**日期**: March 12, 2026  
**arXiv**: https://arxiv.org/abs/2603.11721

---

## 核心贡献

**首个**直接以OpenClaw为基础框架扩展的学术研究，提出**Agentic Operating System for Hospital (AOS-H)**——面向医疗环境的Agent操作系统。

### 四大核心组件

| 组件 | 功能 | 技术基础 |
|------|------|---------|
| **Restricted Execution Environment** | Linux多用户式隔离执行环境 | 操作系统级安全 |
| **Page-Indexed Memory Architecture** | 无向量嵌入的渐进式披露检索 | Manifest文件层次导航 |
| **Document-Centric Coordination** | 文档变异模型多Agent协调 | 无直接通信的间接协调 |
| **Curated Medical Skills Library** | 医疗Skill的特设组合 | OpenClaw Skill架构 |

---

## Page-Indexed Memory: 反RAG的记忆架构

### 问题诊断
传统RAG在医疗场景的结构性缺陷：
- 扁平向量检索将患者历史**碎片化**为孤立嵌入
- 丢弃临床推理依赖的**纵向结构**
- 无法区分时间/因果关系（3年前的剂量 vs 近期不良事件）

### 三层生命周期

```
Capture → Store → Recall
   ↓        ↓        ↓
写入     层次化    Manifest导航
结构化    文档树     渐进式披露
条目     + Manifest
```

### Manifest文件结构

```
M_u = [(c_1, δ_1), (c_2, δ_2), ..., (c_|u|, δ_|u|)]
- c_i: 子节点路径
- δ_i: 自然语言描述（范围、时间、文档类型）
```

**关键创新**: 完全放弃向量嵌入，依靠Agent的语言推理能力导航层次结构。

### 渐进披露检索算法

```
1. 从根Manifest M_root开始
2. LLM-Select(q, entries): Agent选择相关子节点
3. 展开选中分支，剪枝无关分支
4. 重复直到到达叶子页面或深度限制
```

**优势**:
- 无需嵌入计算开销
- 无需离线索引构建
- 实时文档变更无需重新索引
- 检索路径本身就是可解释审计追踪

---

## Document-Mutation Coordination: 无直接通信的多Agent协调

### 核心设计原则

> "No agent communicates with another through a direct channel"

### 角色映射

| 角色 | Agent类型 | 写入权限 | 读取权限 |
|------|----------|---------|---------|
| Patient | Patient Agent | 症状日志、生命体征、健康日记 | 自己的记录 |
| Clinician | Clinician Agent | 评估笔记、用药医嘱、随访计划 | 共享护理计划 |
| System | Triage/Scheduling Agent | 队列文档、预约条目 | 相关通知流 |

### 变异事件结构

```
Mutation Event:
- document_id: 文档标识
- page_reference: 修改页引用
- writing_agent_role: 写入Agent角色
- version_counter: 单调递增版本计数器
- priority_flag: 优先级标志（用于紧急升级）
```

### 发布-订阅机制

1. Agent订阅其权限范围内的文档变更流
2. Event Broker分发变异事件
3. Agent接收后评估是否需要立即行动
4. 版本计数器保证因果顺序，无需轮询

---

## 临床工作流场景

### 1. 连续监测与常规随访
- Patient Agent执行MonitorVitals Skill
- 写入结构化每日摘要页
- Clinician Agent订阅接收，生成进展评估
- 恶化趋势 → FollowUpRequest → Scheduling Agent

### 2. 分诊与初步评估
- Triage Agent执行CollectPresentingSymptoms
- Manifest导航获取相关病史
- 写入分诊评估页到共享队列
- Clinician Agent订阅接收并处理

### 3. 紧急升级
- Patient Agent检测到临界生理事件
- EscalateEmergency Skill: 原子性追加高优先级警报页
- 事件Broker优先投递（priority flag）
- Clinician Agent中断当前推理周期响应

### 4. 跨专科协调（多病共存患者）
- 各专科Agent（心脏科/肾脏科/肿瘤科）持有各自专科笔记写入权
- 共享多学科护理计划文档读取权
- 变更通知所有订阅Agent
- 冲突检测 → 结构化冲突警报 → 协调Clinician Agent → 和解护理计划

---

## 安全与治理：最小可信计算基

### 核心洞察

> "将Agent有效接口缩减为两个原语操作（文件读/写）允许将整个安全治理问题委托给宿主操作系统的安全机制，而非在应用层实现"

### OS原生强制执行

| 机制 | 功能 |
|------|------|
| Linux user isolation | 用户隔离 |
| File permission bits | 文件权限 |
| seccomp filters | 系统调用过滤 |
| AppArmor policies | 强制访问控制 |
| auditd/inotify subsystem | 审计追踪 |

### 与传统Agent架构对比

| 特性 | 复杂Agent架构 | AOS-H设计 |
|------|--------------|-----------|
| 系统权限 | 广泛（网络、数据库、API） | **仅文件读/写** |
| 信任边界 | 模型行为 | **操作系统内核** |
| 审计 | 应用层日志 | **文件系统属性** |
| 攻击面 | 多向量 | **最小化** |

---

## 与OpenClaw的关系

### 明确继承

> "This work grounds the design in OpenClaw, an open-source autonomous agent framework that structures agent capabilities as a curated library of discrete skills"

### 识别Gap并扩展

| OpenClaw现状 | AOS-H扩展 | 目的 |
|-------------|----------|------|
| 消费级环境假设 | Linux多用户隔离 | 医疗级安全 |
| 通用记忆机制 | Page-indexed层次记忆 | 纵向临床上下文 |
| 无显式审计 | 文件系统级审计追踪 | 合规要求 |

### 关键验证

论文验证了OpenClaw核心设计哲学在**高 stakes、强监管环境**的适用性：
1. **Skill-based decomposition** → 模块化、可审查
2. **预审计Skill库** → 运行时安全边界
3. **文档中心交互** → 多Agent协调基础

---

## L3 Flags 关联

| Flag ID | 内容 | 关联 |
|---------|------|------|
| #951-955 | Skill四元组/安全验证 | 论文的Curated Medical Skills Library直接继承 |
| #974-978 | XSkill双流架构 | Page-indexed Memory是XSkill经验库的医疗特化 |
| #979-983 | LABSHIELD安全等级 | AOS-H的OS级隔离是S2-S3等级的实现 |

---

## 核心洞察

1. **OpenClaw设计哲学的外部验证**: 首个独立学术研究选择OpenClaw作为基础框架，验证了其架构的**通用性和可扩展性**

2. **Page-indexed Memory作为RAG替代**: 论文提出一种根本不同的记忆架构——**放弃向量嵌入**，依靠语言推理导航层次结构。这对Error Log和长期记忆设计有重要启示

3. **文档变异模型的普适性**: 医疗场景的"无直接通信"协调模式可推广到其他多Agent场景（如代码审查、内容审核）

4. **最小权限原则的工程实现**: 将信任边界从模型行为下移到操作系统内核，为高可信Agent部署提供可行路径
