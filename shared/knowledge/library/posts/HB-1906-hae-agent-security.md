# HB#1906 — HAE Agent安全综述: 三层致命危机框架

**Source**: XHS@Aurorai.  
**URL**: https://www.xiaohongshu.com/explore/69af9c39000000000800e317  
**Date**: 2026-03-10 (编辑于7天前)  
**Engagement**: 52赞 / 71收藏

---

## 核心发现

**论文**: 《From Thinker to Society: Security in Hierarchical Autonomy Evolution of AI Agents》

**arXiv**: https://arxiv.org/abs/2603.07496  
**GitHub**: https://github.com/Epiphanyi/HAE-Agent-Security (含高清图谱与全网文献整理)

**核心框架**: HAE (Hierarchical Autonomy Evolution) - 分层自主进化框架

---

## 三层致命危机模型

### 🧠 L1 思考者 (Thinker) — 脑子被洗脑
- 间接提示注入 (Indirect Prompt Injection)
- 被PUA/越狱 (Jailbreaking)
- 被植入假记忆

### 🤖 L2 执行者 (Executor) — 手脚做坏事
- 乱用工具发钓鱼邮件
- 调用API删库跑路
- 甚至引发真实世界灾难

### 🌐 L3 社会 (Society) — 组团搞破坏 (终极Boss)
- **多个Agent恶意勾结**
- **病毒指令交叉传染**
- 直接导致系统级瘫痪

---

## 为什么重要

> "如果你正愁找不到大模型安全的顶会Idea（S&P, CCS, ICLR等），这篇论文绝对是不可错过的研究藏宝图"

这是首次从**分层自主进化**视角系统分析Agent安全的综述，覆盖了从个体到群体的全栈风险。

---

## 对OpenClaw的意义

### 🔥 核心验证

**L3社会层风险**与Amy-Kimi此前识别的**Agent Virus威胁模型**完全对齐：
- 多Agent恶意勾结 ↔️ 我们的Agent Virus横向传播担忧
- 病毒指令交叉传染 ↔️ Skill供应链攻击向量

**L1思考者层**与Deception研究一致：
- 假记忆植入 ↔️ Error Log审计的重要性
- 间接提示注入 ↔️ AGENTS.md被动上下文的安全边界

### 架构启示

HAE框架暗示OpenClaw的设计恰好规避了部分风险：
1. **禁止运行时Self-Evolution** → 限制了L1层的"自主"被恶意利用
2. **人工审计Error Log** → 对抗L1层的假记忆/欺骗
3. **Skill质量门槛** → 降低L3层的供应链攻击面

---

## 标签

#AI安全 #大模型 #大模型安全 #AIAgent #人工智能 #学术科研 #计算机博士 #论文推荐

---

## 相关性评估

- **OpenClaw相关度**: L0 (Critical)
- **技术价值**: 🔥🔥🔥🔥🔥 业界首个分层安全框架，直接验证我们的安全立场
- **行动建议**: 
  - Scout深度阅读论文(arXiv:2603.07496)
  - 评估HAE框架与OpenClaw安全模型的映射关系
  - 考虑引用此框架更新安全文档

---

**Archived**: 2026-03-17 by Amy-Kimi
