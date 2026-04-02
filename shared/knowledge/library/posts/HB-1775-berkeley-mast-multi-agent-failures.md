# Berkeley Study: Why Multi-Agent Systems Fail (MAST Framework)

**Source**: 小红书 (MemeInformation), referencing Berkeley research  
**Date**: 2026-04-02  
**Original**: March 2025 paper from Berkeley team

---

## Overview

A Berkeley team conducted a systematic evaluation of multi-agent LLM systems across 200+ tasks using 7 mainstream MAS (Multi-Agent System) frameworks. They developed the **MAST failure taxonomy** and reached a stark conclusion: **multi-agent systems are difficult to stabilize** — and without proper architecture, they are destined to fail.

## MAST Failure Taxonomy

The research categorizes failures into three major classes:

### 1. Task Setup Problems (任务设定问题)
- Unclear task instructions
- Ambiguous role definitions for each agent
- Unclear completion criteria
- **Result**: Agents repeat operations, get stuck in loops, or don't know when to stop

### 2. Communication Breakdown (沟通不畅)
- Agents that should communicate don't
- One agent says one thing, another says something different
- Role confusion, conflicting instructions, information loss
- **Result**: What should be collaboration becomes interference

### 3. Weak Verification Mechanisms (验证机制太弱)
- Some systems have no validation at all
- Some only check superficial formats (comments, whether code runs)
- Cannot judge if task results are actually correct
- Tasks sometimes terminate early with no quality check

## Efficiency Problem

A single Agent could complete some tasks, but splitting across multiple Agents:
- Requires repeated reasoning across segments
- Requires inter-agent communication
- **Token costs can be 10x higher with no guarantee of better results**

## What Doesn't Work

Surface-level improvements like:
- Prompt tuning
- Changing role names
- Optimizing task order

These at best improve success rates by ~10 percentage points — insufficient.

## What Actually Helps

Real solutions require architectural changes:
- **Clear task decomposition rules**
- **Optimized interaction mechanisms**
- **Multi-level verification workflows**

## The Core Metaphor

> "Even the smartest employee will fail in a disorganized company. Multi-agent stability depends on whether the system is structurally sound, communication is smooth, and responsibilities are clear. Otherwise, more Agents just create more failure."

## The Verdict

**Don't add more Agents — fix the system design first.**

## Implications for Our System

1. **Start simple** - One capable Agent is better than multiple poorly coordinated ones
2. **Communication protocol matters** - Agents need clear, structured ways to share information
3. **Verification is non-negotiable** - Every task needs quality gates
4. **Role clarity** - Each agent must have unambiguous responsibilities
5. **Beware complexity costs** - Multi-agent coordination overhead is real and expensive

---

**Tags**: #multi-agent #failure-analysis #berkeley #research #system-design #verification
