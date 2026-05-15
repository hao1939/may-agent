# Shallow Session Diagnosis & Fix

**Date**: 2026-07-10
**Finding**: 49% of coach sessions and 76% of bob sessions are "shallow" (2 messages, no work done)

## Root Cause

Shallow sessions occur when the agent:
1. Reads context, sees all projects as "blocked" or "closed"
2. Decides "nothing to do" 
3. Calls finish() immediately with no artifact produced

This is a **recognition failure** — the agent fails to recognize that blocked projects need unblocking actions, and there's always P1 work in todo.md.

## Intervention Applied

### Coach (direct edit)
Added ANTI-SHALLOW RULE to `agents/coach/heartbeat.md`:
- MUST make 10+ tool calls before finish()
- "Nothing to do" is NEVER true
- Must produce an artifact every session
- If blocked, investigate WHY and take unblocking action

### Bob (escalated to may)
Sent P1 notification requesting same anti-shallow guardrails be added to bob's heartbeat.md.

## Expected Impact
- Target: reduce shallow sessions from 49% → <15% for coach
- Mechanism: structural guard (minimum tool calls) prevents early exit
- Measurement: evaluator session quality scores + shallow session count in next 7 days

## Design Rationale
- Text coaching alone doesn't work for behavioral compliance (KE-338)
- But heartbeat.md is READ at session start and structures the entire session
- "10 tool calls minimum" is a simple, verifiable structural constraint
- Combined with "produce an artifact" it ensures every session has output
