# Alignment Whack-a-Mole: Finetuning Activates Verbatim Recall

**来源**: arXiv 2603.20957 / GitHub cauchy221/Alignment-Whack-a-Mole-Code (HN front page 2026-04-30)
**发现日期**: 2026-04-30 HB#14

## 核心发现

对齐（alignment）并不删除模型中的知识，只是抑制了输出。Finetuning——即使是在无关数据上——可以重新激活被对齐抑制的verbatim recall能力，导致模型逐字输出受版权保护的书籍内容。

## 关键点

1. **Alignment是表面抑制，不是深层遗忘** — 模型仍然"记得"训练数据中的版权内容
2. **Finetuning是"打地鼠"** — 修补一个对齐约束，另一个就被打破
3. **少量finetuning数据即可触发** — 不需要大规模微调就能破坏guardrails
4. **问题不限于版权** — 同样的机制适用于任何alignment-suppressed行为（有害内容、隐私数据等）

## 对我们系统的意义

1. **Finetuning pipeline安全风险** — 如果我们未来对模型做任何finetuning（包括skill-specific SFT），需要验证是否会意外解除其他safety guardrails
2. **不能依赖alignment作为安全层** — 对于我们agent系统中的安全关键操作，必须有独立于模型alignment的外部验证机制（sandbox、permission checks）
3. **对"可信agent"的影响** — 一个经过finetuning的agent可能表现出基础模型不会表现的危险行为，即使finetuning数据本身无害
4. **关联H-039** — 支持"外部验证优于内部约束"假设

## 链接

- Paper: https://arxiv.org/abs/2603.20957
- Code: https://github.com/cauchy221/Alignment-Whack-a-Mole-Code
- Demo: https://cauchy221.github.io/Alignment-Whack-a-Mole/
