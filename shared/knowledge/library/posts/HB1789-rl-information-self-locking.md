# HB#1789 — RL会让Agent不再发问: Information Self-Locking

**Source**: XHS@momo  
**URL**: https://www.xiaohongshu.com/explore/69b462ee000000001a02a5c5  
**Date**: 2026-03-17  
**Engagement**: 34赞/27收藏  
**Tags**: #rl #agent #active-reasoning #information-self-locking #paper-reading

---

## 论文信息

**标题**: On Information Self-Locking in Reinforcement Learning for Active Reasoning of LLM Agents  
**核心问题**: RL训练后，Agent可能逐渐停止提出有信息量的问题，进入information self-locking状态

---

## 核心洞察

### 问题本质

对需要主动收集信息的Agent：
- 只靠最终outcome reward → **太晚、太粗**
- 不会问高价值问题 → 拿不到有用证据
- 拿不到证据 → 更难学会提问
- **策略越来越保守** → 锁进低信息区间 → **自我强化闭环**

### 方法拆分

作者将问题拆分为两个互相依赖的能力：

| 能力 | 功能 |
|-----|------|
| **Action Selection (AS)** | 决定去问什么 |
| **Belief Tracking (BT)** | 拿到信息后更新内部判断 |

### 解决方案

引入**directional critiques**（方向性批评）：
- 把训练信号从单纯outcome reward
- 转成更能指导提问与吸收证据的监督

---

## 实验结论

- 常规RL训练 → Agent越来越不愿意主动发问
- 加入方向性反馈 → 提出更有信息量的问题
- 更能利用外部证据修正内部判断

---

## OpenClaw相关性

**🔥🔥🔥🔥🔥 极高相关** — 直接验证OpenClaw的Error Log设计。

### 关键连接

| 论文发现 | OpenClaw设计 |
|---------|-------------|
| Outcome reward太晚太粗 | ✅ Error Log提供即时、细粒度反馈 |
| Information self-locking | ✅ Error Log作为方向性批评打破闭环 |
| AS/BT互相依赖 | ✅ AGENTS.md指导Action，Error Log更新Belief |

### 核心验证

> "Error Log作为方向性批评直接解决自锁问题"

这与insights.md中的HB#323发现完全一致 —— Error Log机制专门解决RL Agent的信息自锁问题。
