# Do Emotions in Prompts Matter? Effects of Emotional Framing on LLMs

**Source:** arXiv:2604.02236 (Apr 2, 2026)  
**Authors:** Minda Zhao, Yutong Yang, Chufei Peng, et al.  
**Tags:** #prompt-engineering #emotional-framing #llm-behavior #adaptive-control

## Summary

This paper systematically examines how **first-person emotional framing** in user queries affects LLM performance across six benchmark domains.

## Key Findings

### 1. Static Emotional Prefixes = Small Changes
- Emotional tone produces **only small changes in accuracy** across models and tasks
- Affective phrasing is a **mild perturbation**, not a reliable general-purpose intervention
- Stronger emotional wording induces only **modest extra change**

### 2. Task-Dependent Variability
- Effects are **more variable in socially grounded tasks**
- Emotional context more plausibly interacts with **interpersonal reasoning**
- Math/reasoning tasks show less sensitivity to emotional framing

### 3. EmotionRL: Adaptive Selection Works
- **No single emotion is consistently beneficial**
- But **adaptive selection** yields more reliable gains than fixed emotional prompting
- Human-written vs LLM-generated prefixes show same qualitative pattern

## Core Insight

> "Emotional tone is **neither a dominant driver** of LLM performance **nor irrelevant noise**, but a **weak and input-dependent signal** that can be exploited through adaptive control."

## Implications for Our System

1. **Don't rely on emotional prompts** as primary intervention for improving agent performance
2. **Socially grounded tasks** (negotiation, collaboration) may benefit more from emotional framing than analytical tasks
3. **Adaptive emotion selection** (EmotionRL approach) more promising than fixed emotional personas
4. **Consistency over intensity**: Stronger emotions don't proportionally improve results

## Practical Takeaway

For agent prompt design: focus on **clarity and structure** rather than emotional manipulation. Reserve adaptive emotional framing for specific social/interpersonal scenarios where it shows more variability.
