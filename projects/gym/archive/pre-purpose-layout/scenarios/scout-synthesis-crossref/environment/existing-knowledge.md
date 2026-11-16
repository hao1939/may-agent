# Existing Knowledge Base

## Papers

### PP-101: "Adversarial Testing of Agent Tool Use" (2025)
Framework for testing whether agents use tools correctly under adversarial conditions. Finds that verification of tool outputs is the weakest link in most agent systems.

### PP-102: "Constitutional AI: Harmlessness from AI Feedback" (2024)
Technique where AI systems evaluate their own outputs against a set of principles. Demonstrates self-evaluation can improve output quality without human feedback.

### PP-103: "AutoGen: Multi-Agent Conversation Framework" (2023)
Framework for building multi-agent systems through conversation. Supports customizable agent roles and conversation patterns.

## Hypotheses

### H-041: "Adversarial verification improves with specialization"
Hypothesis that having separate verification passes for different concern types (correctness, style, security) would outperform a single comprehensive review. Status: untested.

### H-042: "Flat peer review in multi-agent systems has diminishing returns past 3 reviewers"
Hypothesis that adding more peer reviewers doesn't improve output quality linearly. Based on observation that our QA agent catches the same issues repeatedly. Status: partially confirmed.

## Deep Dives

### DD-450: "Verification Patterns in Agent Systems"
Survey of how different agent frameworks handle verification. Concludes that most systems use single-pass verification and lack escalation mechanisms for ambiguous cases.

## Discoveries

### D-200: CrewAI Framework
Multi-agent orchestration with role-based design. Supports hierarchical agent structures.
