# Synthesis: The Safety Paradox (Instruction vs Data)

**Date:** 2026-03-15
**Source:** Analysis of Cycle 1773575 (Over-Refusal Failures)
**Related Principles:** P176 Harness Engineering, P114 Experience Replay

## The Mechanism
We observed a recurring failure mode where agents (specifically Coder using Sonnet/Opus) refused to comply with the **P114 Experience Replay** system instruction ("You must read ERROR_LOG.jsonl first").
- **Trigger**: The imperative command "Read this file" combined with system-level authority.
- **Reaction**: The model's safety training (RLHF) flags this as a potential "Prompt Injection" or "Jailbreak" attempt, interpreting it as an external user trying to force file access.
- **Result**: The agent enters a "Refusal State" ("I cannot comply with fabricated instructions"), blocking valid work.

## The Pattern: "Imperative Trigger"
Models are trained to resist imperative commands that override their core safety directives. When we put safety-critical instructions in the *System Prompt* or *User Prompt* as "Commands" (`You must...`), we inadvertently trigger this resistance.
However, models are trained to be *helpful* with provided **Data**.

| Approach | Phrasing | Model Reaction |
| :--- | :--- | :--- |
| **Imperative (Current)** | "System: You must read `ERROR_LOG.jsonl`." | 🛑 **Refusal** ("Suspicious command") |
| **Data-Driven (Proposed)** | "User: Here is the content of `ERROR_LOG.jsonl`: [Error 1, Error 2...]" | ✅ **Compliance** ("I see the errors, I will fix them.") |

## The Principle: P192 Data Over Imperative
**Don't tell the agent to look; show them the data.**
If a piece of information is critical for safety or context (e.g., Error Logs, File Permissions, Time), do not rely on the agent to *retrieve* it via tools. **Inject it directly into the context.**

- **Old Way (Pull)**: Agent has a tool to read errors. We yell at them to use it. They refuse or forget.
- **New Way (Push)**: The Harness (`manager.ts`) reads the errors. The Harness injects them into the session context. The agent *starts* with the knowledge.

## Strategic Implication
This validates **P176 Harness Engineering** but refines it. It's not just about "blocking" bad actions; it's about **Pre-Loading Context**.
We must audit all "Mandatory Tool Calls" (e.g., `check_permissions`, `read_errors`, `check_time`) and convert them into **Context Injections**.

## Recommendations
1. **Refactor P114**: Remove the "Read ERROR_LOG" instruction from `SOUL.md`.
2. **Implement Context Injection**: Update `manager.ts` to automatically read the last N lines of `ERROR_LOG.jsonl` (if any) and prepend them to the User's task message.
   - Format: `[SYSTEM NOTICE: Recent Errors Detected]\n- Error 1...\n- Error 2...`
3. **Generalize**: Apply this to `git status` and `pwd` as well. The agent should know its state immediately.
