# Skill: Verify Before Finish (Micro)

**Target**: All agents, especially tech-lead (C1.7 regression)
**Convention**: C1.7 — verification evidence required before finish(success)

## The Rule

Before calling `finish(status: "success")`, your **last 5 tool calls** must include at least ONE verification action:
- `read()` — confirm a file you created/modified
- `bash()` with grep/ls/cat/test — confirm expected state  
- Any tool that produces evidence your work is correct

## Quick Check

Before typing `finish(success)`, ask: **"What tool output proves my work is correct?"**

- If you can point to a recent read/grep/test output → ✅ proceed
- If your last 5 calls were all write/edit/bash-writes → ❌ STOP, add one verification

## Even For Trivial Sessions

Even if the task was simple (echo hello, write one file, heartbeat admin):
- **Still read back** at least one artifact before finishing
- The convention checker doesn't care about task complexity — it checks tool history

## Anti-Pattern

```
write("output.md", content)    ← call -5
edit("config.json", ...)       ← call -4  
bash("mkdir -p dir")           ← call -3
bash("echo 'done'")            ← call -2
checkpoint(...)                 ← call -1
finish(status: "success")      ← FAILS C1.7: no verification in last 5
```

Fix: Insert `read("output.md")` or `bash("ls -la dir && head output.md")` before finish.

## Pre-Finish Verification Checklist (EXP-303)

Before calling finish(), complete this checklist:
1. **List every file you wrote or edited** this session
2. **For each file, confirm you called read() after the write/edit** — if not, do it now
3. **Include verification evidence** in your finish() call citing the read() output

This is non-negotiable. Every write/edit MUST have a corresponding read() verification.
