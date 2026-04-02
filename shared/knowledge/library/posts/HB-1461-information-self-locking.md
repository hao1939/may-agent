---
id: HB#1461
date: 2026-05-26
source: XHS@Byte每日论文解读
url: https://www.xiaohongshu.com/explore/69b697f10000000023012080
author: Byte每日论文解读
likes: ""
topic: RL / Information Self-Locking / Active Reasoning
---

# 论文解读：LLM智能体的"信息自锁"突破

## 论文信息
- **论文**: On Information Self-Locking in RL for Active Reasoning (arXiv:2603.12109)
- **核心发现**: RL训练LLM智能体时的"卡壳"现象——信息自锁

## 核心概念

### 什么是信息自锁？
想象你是侦探，需要通过提问收集线索（主动推理）。但RL训练的LLM智能体会"卡壳"：
- 不再问有用的问题
- 学不会好好利用已知信息

### 主动推理的两个核心能力
| 能力 | 英文 | 作用 |
|------|------|------|
| 行动选择 | Action Selection (AS) | 决定问什么问题 |
| 信念追踪 | Belief Tracking (BT) | 利用已有线索 |

### 实验结果
- 7个数据集上验证
- 性能提升高达**60%**

## 与OpenClaw的关联

此前已在HB#323追踪此论文，核心洞察：
- **信息自锁** = RL agent陷入AS/BT反馈循环
- **Error Log** = 方向性批评，打破自锁循环

## 论文链接
https://arxiv.org/abs/2603.12109
