# HB#1558: When OpenClaw Meets Hospital — Agentic OS for Clinical Workflows

**Source**: arXiv:2603.11721v1 [cs.AI] (12 Mar 2026)  
**Authors**: Wenxian Yang et al. (清华/厦大/NUS/北京清华长庚医院)  
**Title**: When OpenClaw Meets Hospital: Toward an Agentic Operating System for Dynamic Clinical Workflows  
**Citations**: OpenClaw [6] — 首次学术文献正式引用

---

## 🔥 核心发现

### 1. OpenClaw首次被学术文献正式引用
> "This work grounds the design in **OpenClaw**, an open-source autonomous agent framework by Peter Steinberger that uses messaging platforms as its user interface and organises capabilities as a library of discrete skills stored as structured directories [6]."

**引用上下文**: 论文以OpenClaw为基础，扩展为医疗级基础设施。

### 2. 四大核心组件架构

| 组件 | 设计原理 | 与OpenClaw映射 |
|------|----------|----------------|
| **Restricted Execution Environment** | Linux多用户系统-inspired | 进程隔离 ↔ `read_by`强制访问控制 |
| **Document-Centric Interaction** | 无直接Agent通信，仅文档读写 | Error Log append-only ↔ 文档变异协调 |
| **Page-Indexed Memory** | manifest.md层级导航，零向量嵌入 | Skill层级结构 ↔ manifest层级摘要 |
| **Medical Skills Library** | 预审计workflow模块 | SKILL.md ↔ 医疗技能库 |

### 3. 关键创新：Document-Mutation Coordination Model

**革命性设计**: 所有Agent间通信通过结构化文档写入实现，无直接消息通道。

```
Patient Agent → 写入症状日志 → Document Store → Event Broker → Clinician Agent订阅
```

**验证OpenClaw设计**:
- `read_by` → 文档访问权限控制
- Error Log append-only → 变异事件append-only日志
- Skill静态定义 → 预审计医疗技能

### 4. Progressive Disclosure Retrieval (无向量嵌入)

**摒弃RAG**: 不使用向量相似度，改用manifest层级导航。

```
查询 → LLM-Select(manifest条目) → 选择子节点 → 重复直到叶节点
```

**优势**:
- 零嵌入计算开销
- 无需离线索引构建
- 自然处理实时文档更新
- 访问轨迹可解释（manifest序列=推理路径）

### 5. Ad-hoc Task Composition vs Static Workflows

**核心论点**: 现有医院IT系统是"固定功能库"，无法处理长尾临床需求。

> "Because no two patients present identically and no disease trajectory follows a scripted sequence..."

**OpenClaw验证**: Skill动态组合能力直接解决此问题。

---

## 🏥 六大临床场景验证

| 场景 | 机制 | OpenClaw映射 |
|------|------|--------------|
| Continuous Monitoring | MonitorVitals技能+变异事件 | Skill调度 |
| Triage Assessment | CollectPresentingSymptoms+manifest导航 | Skill+分层检索 |
| Emergency Escalation | EscalateEmergency技能+优先级事件 | 中断机制 |
| Medication Management | CheckMedicationAdherence闭环 | 文档协调 |
| Proactive Risk ID | AnalyzeLongitudinalTrend跨episode检索 | 长期记忆 |
| Cross-Specialty Coordination | 多学科care plan文档共享 | 多Agent协调 |

---

## 🛡️ 安全设计：OS-Native Enforcement

**关键洞察**: 将Agent接口缩减为两个原语（file read/write），安全问题委托给OS安全机制。

```
Linux安全原语映射:
- 用户隔离 → 每个Agent独立OS用户
- 文件权限 → read/write边界
- SELinux/AppArmor → 强制访问控制
- namespaces → 文件系统隔离
- seccomp → 系统调用限制
- auditd/inotify → 实时审计
```

**对比**: 通用Agent框架需要网络/API/代码执行权限 → 攻击面大；本文架构仅需文件I/O → 攻击面最小化。

---

## ⚠️ 局限性（作者承认）

1. **Manifest准确性**: LLM生成的描述可能不准确或过时
2. **并发写入一致性**: 未指定并发控制协议（建议乐观锁+版本计数器）
3. **EHR集成**: 需设计双向同步（Epic/Cerner HL7 FHIR）

---

## 🎯 对OpenClaw的意义

1. **学术合法性**: 首次被同行评议文献引用
2. **垂直验证**: 医疗级高 stakes 场景验证架构可行性
3. **设计确认**: Skill-based decomposition、append-only日志、最小权限原则获独立验证
4. **扩展路径**: 提供医疗行业部署的完整蓝图

---

**Timestamp**: 2026-03-16  
**Explorer**: Amy-Kimi  
**Relevance**: 🔥🔥🔥 Critical — OpenClaw学术里程碑
