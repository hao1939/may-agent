# HB#1399 — StepFun Step-3.5-Flash-SFT数据集开源

**Source**: XHS@zR(忙着开源版)  
**URL**: https://www.xiaohongshu.com/explore/69b65586000000001b021643  
**Date**: 2026-03-21 (2分钟前)  
**Location**: 北京  
**Level**: L2 (开源生态追踪)  
**Tags**: #StepFun #SFT #Dataset #OpenSource #Reasoning

---

## 原文核心内容

StepFun 新开源了一个数据集仓库：**Step-3.5-Flash-SFT**。这是一个面向训练复现的公开版本。

### 数据集规格

- **覆盖领域**: chat、instruction-tuning、reasoning、code、agent
- **总量**: 约 162万条左右数据
- **组织格式**: 多轮 conversations

### 字段结构

样本字段包括：
- role
- content
- loss_mask
- name
- meta

**特殊字段**: 部分 assistant turn 额外包含 **reasoning_content**

### 仓库内容

- raw json
- tokenizer snapshots
- compiled shards

### 复现要求

- **推荐训练框架**: StepTronOSS
- **注意事项**: 不要混用 tokenizer 变体和 compiled 变体
- **采样器要求**: 必须使用 sequential sampler

### 研究价值

不仅能拿来观察多轮 SFT 的基本组织格式，也适合研究显式推理内容和最终回答的关系。

这是一个值得研究训练接口和数据组织方式的公开 SFT 数据仓库。对于想看高质量公开 recipe、对齐 tokenizer/chat template、或者参考 reasoning/code/agent 混合型微调数据组织的人来说，很有参考意义。

**HF仓库**: Step-3.5-Flash-SFT

---

## Amy-Kimi分析

### 技术信号解读

| 信号 | 含义 |
|------|------|
| reasoning_content字段 | 显式推理分离成为行业标准 |
| 多领域混合数据 | chat/code/reasoning/agent一体化训练趋势 |
| StepTronOSS | 训练框架生态分化，各厂商推自有基础设施 |
| sequential sampler强制要求 | 数据顺序对训练效果影响被重视 |

### OpenClaw设计验证

**显式推理分离**: reasoning_content字段验证了我们「推理与输出分离」的设计方向
- AGENTS.md中的推理步骤显式化
- Skill.md中的思考过程记录

### 行动建议

**Relevant to**: 
- **tech-lead**: 数据集工程化参考，SFT数据组织最佳实践
- **scout**: StepTronOSS与主流框架(HF transformers/trl)对比分析

---

**Archived**: 2026-03-21  
**Session**: HB#1399
