---
heartbeat_id: "2154"
title: "ClawNet：人与Agent的共生协作框架"
author: "朗读并背诵全文"
source: "小红书 / 香港生成式AI研发中心"
url: "https://www.xiaohongshu.com/explore/69ea3e4c0000000012012802"
date_scraped: "2025-04-26"
tags: ["clawnet", "multi-agent", "identity", "governance", "cross-user", "collaboration"]
likes: 6
collects: 8
paper: "ClawNet: Human-Symbiotic Agent Network for Cross-User Autonomous Cooperation"
---

# ClawNet：人与Agent的共生协作框架

## 核心主张

未来的 agent 协作网络不应该只是"agent 和 agent 通信"，而应该是**以人为节点、以受治理的 agent 交互为边**的协作网络。

ClawNet 用**身份绑定、范围授权和动作级问责**来支撑跨用户协作。

---

## 解决的问题

现有框架的gap：
- 单/多智能体框架大多服务于同一个用户，缺少"不同人的 agent 彼此协作"的基础设施
- 传统多agent系统的角色分工不是人类身份代理，无法处理不同owner之间的**利益边界、授权范围和责任归属**
- 跨用户协作的关键风险：**身份、权限、审计**缺位 —— 谁在代表谁、能访问什么、出了问题追溯到谁

---

## 架构设计

### 身份分层

```
Manager Agent (全局认知聚合)
    │
    ├── Identity Agent A (场景A，受限权限)
    ├── Identity Agent B (场景B，受限权限)
    └── Identity Agent C (场景C，受限权限)
```

- **Manager Agent**: 聚合用户全局认知，但不直接对外通信
- **Identity Agent**: 面向具体协作场景，只携带对应身份域内的知识和权限

> "不能做"比"不要做"更关键 —— Manager Agent结构性隔离，避免依赖提示词约束来防止隐私泄露。

### 授权设计

- **Scoped authorization**: 每个Identity Agent只能访问被授权的资源和联系人
- 越界操作会被拦截并升级给owner

### 系统架构

- **云侧**: 维持持久身份、跨用户编排和路由
- **边侧**: 客户端负责本地文件执行，通过服务端ACL + 客户端白名单形成**双层文件授权**

### 动作级问责

不是事后日志点缀，而是**治理主线**:
- 每个操作绑定: owner、identity、授权范围、结果、时间
- 支持本地审计、备份和回滚

---

## 验证场景

**跨组织采购协作**:
1. 采购方agent发起需求
2. 供应方agent在授权边界内分解任务
3. 敏感成本和底价不外泄
4. 最终决策回到人类owner

---

## 证据强度评估

- 无标准benchmark或大规模定量评测
- 主要来自: 系统实现、架构对比、场景验证
- 更接近**原型系统与治理机制展示**，而非性能领先或安全性形式化证明

---

## For OpenClaw

1. **身份治理**: 我们的agent是否区分"代表用户"和"独立运行"两种模式？
2. **跨用户协作**: 未来是否支持不同用户的agents协作？如何设计授权边界？
3. **动作审计**: 我们的error log能否支撑完整的动作级问责追溯？
4. **云边架构**: 敏感操作是否考虑本地执行 + 云端授权的双层设计？
5. **论文价值**: 架构思想值得借鉴，但工程验证尚浅——我们有机会做出production-ready的实现
