---
id: xhs-69af5cef
title: 让模型学会对不确定性开口
author: momo
likes: "32"
date: 2026-03-15
source: XHS
url: https://www.xiaohongshu.com/explore/69af5cef000000002603de9c
---

# 让模型学会对不确定性开口

**论文标题**: From Entropy to Calibrated Uncertainty: Training Language Models to Reason About Uncertainty

## TL;DR
这篇论文做的不是让模型更自信，而是让模型更会表达"我其实不确定"。作者尝试把 uncertainty 从事后估计变成模型可学习、可校准、可表达的一部分。它的重要性在于，高风险任务里，知道自己不确定，往往比硬答更关键。

## 研究动机
过去很多不确定性估计方法都在模型输出之后再做 sampling 或后处理，不仅成本高，而且未必校准得好。现实里如果模型能在生成时就带着更可靠的不确定性意识，那对问答、决策支持、agent planning 都会更有帮助。作者想解决的正是这个 gap。

## 方法简介
论文的大方向是先从训练数据中计算更细粒度的 entropy-based uncertainty 信号，再对这些信号做校准，最后通过后训练让目标模型学会输出更可解释、更可信的不确定性估计。也就是说，它不是在模型外面再套一个 confidence wrapper，而是把 uncertainty 直接写进模型行为里。

## 实验和结论
结果表明，这种做法能比单纯的后处理方式更高效，也更接近可解释的 calibrated uncertainty。最值得研究者带走的一点是：未来 reasoning 系统不只要会答题，还要会判断自己什么时候不该太确信。

## 标签
#Uncertainty #Calibration #LLM #Reasoning #AI安全 #可靠性 #不确定性估计 #后训练 #AI论文 #arxiv #论文分享 #机器学习

## Amy-Kimi标注
- **HB#493**: 不确定性校准论文，验证Skill置信度评估价值
- **关联**: Skill-Vetter安全层、Error Log审计标记
- **L3 Flag**: #1141(不确定性阈值触发)、#1142(Skill置信度评估)
