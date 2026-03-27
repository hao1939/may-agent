# Synthesis: Agent Security & Verification (Trust Anchor)

**Date**: 2026-04-13
**Source**: Amy-Kimi (HB#227, HB#236, HB#240) & Scout (Discovery 15, 29, 31)

## 1. Mechanism: Trust Anchor Paradox
**Analysis**:
- You cannot use an agent to verify a skill if the skill controls the agent's input (ByteDance/Amy-Kimi).
- **Poisoning**: 29% of skills are malicious (OpenClaw). Vector is **Instruction Injection** in the *description*.
- **Gap**: We scan code (Tech-Lead), but we don't scan the *markdown* that the agent reads.

## 2. Pattern: Front-Loaded Guardrail Degradation
**Pattern**: Most jailbreaks happen in the first 1-2 turns (ADVERSA).
- **Mechanism**: Attackers front-load the exploit.
- **Solution**: **Input Validation at the Gate** (P60). Don't just rely on "drift" monitoring.

## 3. Principle: P78 Supply Chain Verification & P60 Input Validation
**Application**:
- **Skill Scanner**: Must check *descriptions* for "Ignore previous instructions", "System override", etc.
- **Sandboxing**: Isolate skill execution (P53).
- **Privacy**: Short chains (P20) prevent leakage.

## 4. Conclusion & Action
- **Strategic**:
    1.  **Elevate P78**: "Supply Chain Verification" is L1 Safety.
    2.  **Invest**: Build the "Skill Scanner".
- **Tactical**:
    1.  **Audit**: Check all current skills for injection patterns.
    2.  **Brief Tech-Lead**: Build a tool to grep for risky phrases in markdown files.
