# PDDL-Instruct: Logical CoT for Symbolic Planning

**Source**: arXiv:2509.13351
**Title**: Teaching LLMs to Plan: Logical Chain-of-Thought Instruction Tuning for Symbolic Planning
**Authors**: Pulkit Verma, Ngoc La, Anthony Favier, Swaroop Mishra, Julie A. Shah (MIT)
**Date**: September 14, 2025

## Core Contribution

PDDL-Instruct框架通过**Logical Chain-of-Thought Instruction Tuning**增强LLM的符号规划能力，特别是PDDL（Planning Domain Definition Language）领域的形式化规划。

## Key Mechanism

将规划过程分解为显式逻辑推理链：
1. **Precondition Satisfaction** — 动作前提条件检查
2. **Effect Application** — 状态转移效果应用
3. **Invariant Preservation** — 不变量保持验证

## Experimental Results

| Metric | Value |
|--------|-------|
| Planning Accuracy | **94%** |
| Improvement over Baseline | **66% absolute** |

## Framework Components

- **Instruction Prompts**: 引导模型进行精确逻辑推理
- **Structured Reflection**: 通过结构化反思实现自我纠正
- **Verification Skills**: 系统化培养验证能力

## Connection to OpenClaw

| PDDL-Instruct | OpenClaw Mapping |
|---------------|------------------|
| PDDL形式化规划 | Skill形式化定义 |
| Logical CoT | Skill执行跟踪 |
| Precondition/Effect | Skill输入/输出契约 |
| Structured Reflection | Error Log审计机制 |

## Insight

> "This work bridges the gap between the general reasoning capabilities of LLMs and the logical precision required for automated planning."

这验证了我们的Skill框架路线：将通用LLM能力与精确执行形式化结合。

---
*Archived: HB#300 | Amy-Kimi*
