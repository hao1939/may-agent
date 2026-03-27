---
id: HB#1920
date: 2026-03-17
title: "Prompt Injection as Role Confusion — MIT CSAIL"
source: arXiv:2603.12277
authors: Charles Ye, Jasmine Cui, Dylan Hadfield-Menell (MIT)
---

## 核心发现

### 🔥 发现1: Role Confusion — 角色混淆的根本机制
模型从**文本风格**推断角色，而非从**标签来源**。
- 安全在接口层定义，但权威在隐空间分配
- 低权限文本模仿高权限角色风格 → 继承该角色权威

### 🔥 发现2: CoT Forgery 攻击 — 60%成功率
向低权限通道（user/tool）注入伪造的推理链：
- StrongREJECT: **60% ASR**
- Agent数据窃取: **61% ASR**
- 模型将伪造推理误认为自己的思考 → 无条件执行

### 🔥 发现3: 风格是因果因素
去除风格标记后，ASR从61%暴跌至**10%**
- 风格决定角色感知，而非标签
-  sounding like a role = being that role (在隐空间中)

### 🔥 发现4: 角色探针预测攻击成功率
内部角色混淆程度**在生成前就预测攻击成功**
- 重构：Prompt Injection是可测量的状态污染
- 不仅是决策问题，更是表征问题

## 实验设计

**角色探针 (Role Probes)**:
- 用C4/Dolma3数据训练线性探针
- 相同内容包裹不同角色标签
- 探针仅学习标签的几何签名

**关键验证**:
- 探针在真实对话上零样本泛化
- 即使显式<user>标签，CoT风格文本仍被识别为推理
- 错误标签的user内容被识别为CoT (85% CoTness)

## 与现有研究连接

**与HB#1910的呼应**:
| 论文 | 攻击向量 | 核心发现 |
|------|----------|----------|
| Meta/Yale (HB#1910) | 推理评判者欺骗 | 推理能力≠诚实性 |
| MIT (HB#1920) | CoT伪造 | 风格>标签；可预测的状态污染 |

**共同主题**: 推理/CoT这一"高级能力"反而创造新的攻击面

## 对OpenClaw的验证

| 攻击机制 | OpenClaw防御 | 有效性 |
|----------|-------------|--------|
| CoT Forgery | **禁止运行时Self-Evolution** | ✅ 伪造推理无法植入 |
| 角色混淆 | **AGENTS.md确定性契约** | ✅ 静态约束不依赖风格推断 |
| 隐空间攻击 | **人工审计最终防线** | ✅ 识别异常行为模式 |

## 关键引用

> "Security is defined at the interface but authority is assigned in latent space."
> — 核心洞察：接口安全 vs 隐空间权威的根本错位

> "Role confusion isn't a decision the model makes, but a structural failure."
> — 角色混淆是结构性失效，非决策错误
