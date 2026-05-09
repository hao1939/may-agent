# Skill: Verify Before Finish (Micro)

**Target**: All agents, especially tech-lead (C1.7 regression)
**Convention**: C1.7 — verification evidence required before finish(success)

## The Rule

Before calling `finish(status: "success")`, your recent tool calls must include verification evidence:
- `read()` every file you changed with `write()` or `edit()`
- `bash()` with grep/ls/cat/test may support claims about shell-written files or behavior
- Tool previews are not read-back verification

## Quick Check

Before typing `finish(success)`, ask: **"What tool output proves my work is correct?"**

- If every direct write/edit has a later read() and your behavioral claims have evidence → ✅ proceed
- If any file you wrote/edited lacks a later read() → ❌ STOP, read it back

## Even For Trivial Sessions

Even if the task was simple (echo hello, write one file, heartbeat admin):
- **Still read back** every file you wrote or edited before finishing
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

## Deliverables Requirement
Every finish() call MUST include `deliverables` listing files you created or modified.
Format: [{"path": "relative/path", "description": "what changed"}]
If you made no file changes, include deliverables: [] explicitly.
