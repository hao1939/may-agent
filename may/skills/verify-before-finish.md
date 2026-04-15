# Skill: Verify Before Finish

**Purpose**: Before calling `finish(status: "success")`, you MUST have at least ONE verification tool call in your last 5 tool calls. This prevents C1.7 violations.

## The Rule

**Your last 5 tool calls before `finish(success)` must include at least ONE of:**
- `read()` — confirm a file you created/modified
- `bash()` with grep/ls/cat/test — confirm expected state
- Any tool call that produces evidence your work is correct

## Trigger

Before typing `finish(status: "success")`, ask: **"What tool output in my last 5 calls proves my work is correct?"**

- If you can point to a recent read/grep/test output → ✅ proceed
- If your last 5 calls were all write/edit/send/checkpoint → ❌ STOP, add one verification

## Quick Protocol

1. **Before finish**: Scan your recent tool calls mentally
2. **If no verification**: Run ONE of these:
   - `bash("ls -la <output_file>")` — confirm file exists
   - `read("<output_file>", {offset: 1, limit: 10})` — confirm content
   - `bash("grep '<key phrase>' <output_file>")` — confirm specific content
3. **Then finish** with status matching reality

## Even For Trivial Sessions

Even if the task was simple (dispatch work, update a file, admin):
- **Still read back** at least one artifact before finishing with success
- The convention checker doesn't care about task complexity — it checks your tool history

## Anti-Pattern

```
write("output.md", content)    ← call -5
edit("config.json", ...)       ← call -4
bash("mkdir -p dir")           ← call -3
agents("send", ...)            ← call -2
checkpoint(...)                ← call -1
finish(status: "success")      ← FAILS C1.7: no verification in last 5
```

**Fix**: Insert `read("output.md")` or `bash("ls -la output.md && head -5 output.md")` before finish.

## Why This Matters

- **C1.7 compliance**: This convention is measured. finish(success) without verification = C1.7 violation.
- **Your rate dropped from ~89% to ~63%** — 3 failures in recent sessions, all "finish(success) without verification: no grep/ls/test/read in last 5 tool calls."
- **FM-3.3 prevention**: The #1 failure mode is claiming work is done without evidence. One read-back takes 1 second and prevents the violation.

## Assertion

The session's last 5 tool calls before `finish(status: "success")` must include at least one `read()`, or a `bash()` containing grep/ls/test/cat, or another evidence-producing tool call.
