# Skill: Verify Before Finish

**Purpose**: Before calling `finish(success)`, confirm your deliverables actually exist and contain what you claim. This prevents C1.7 violations — finishing without evidence.

## The Rule

**In your last 3-5 tool calls before `finish(success)`, at least ONE must be a verification step: `read()`, `bash(grep/ls/wc/cat)`, or `bash(test)`.**

## How to Apply

### Before every `finish(success)`:
1. **Identify your deliverable** — what file did you write? What finding did you produce?
2. **Verify it exists** — `ls` or `read()` the output file
3. **Verify it has substance** — `wc -l` or `grep` for key content
4. **Then call finish** — with `verification_evidence` citing the check

## Examples

### ❌ BAD: Finish right after writing
```
write({ path: "workspace/findings.md", content: "..." })
finish({ status: "success", summary: "Wrote findings." })
```
No verification — you don't know if the file landed correctly.

### ✅ GOOD: Write, verify, then finish
```
write({ path: "workspace/findings.md", content: "..." })
bash({ command: "wc -l workspace/findings.md && grep 'Key Finding' workspace/findings.md" })
→ 42 workspace/findings.md
→ ## Key Finding: ...
finish({ status: "success", summary: "Wrote findings.", verification_evidence: ["wc/grep confirmed 42-line file with key findings"] })
```

### ✅ ALSO GOOD: Read-back before finish
```
edit({ path: "workspace/report.md", ... })
read({ path: "workspace/report.md", offset: 1, limit: 5 })
→ [confirms content]
finish({ status: "success", ... })
```

## What Counts as Verification

- `read()` of your deliverable file
- `bash` with `grep`, `ls`, `wc`, `cat`, `head`, `tail` on deliverable
- `bash` running a test that checks your output

## What Does NOT Count

- Reading an *input* file (not your output)
- Running an unrelated command
- The write/edit call itself (edit's diff preview is fine for C1.3, but C1.7 needs a *separate* check near finish)

## Scout-specific: dispatcher-no-op heartbeats

**The #1 C1.7 violation pattern for Scout is the "zero-op heartbeat"**: you read the briefing, decide nothing is actionable, and call `finish(success)` immediately — or only after `bash(git log)` / `bash(git commit)`.

Neither `git log` nor `git commit` match the C1.7 verification patterns (`grep|ls|test|read|cat|wc|head|tail|find|diff|curl|node|python|tsc|vitest`). A bare commit does not prove you checked state.

### ✅ GOOD: No-op heartbeat with a real state check
```
bash({ command: "ls agents/scout/inbox/ 2>/dev/null; tail -20 agents/scout/workspace/todo.md" })
→ [confirms no P0/P1 pending]
bash({ command: "cd agents && git commit -am 'scout: heartbeat no-op'" })
finish({ status: "success", summary: "Dispatcher no-op...", verification_evidence: ["ls+tail confirmed empty inbox, no active P0/P1"] })
```

### ❌ BAD: Zero-op or commit-only finish
```
bash({ command: "cd agents && git log --oneline -5 && date -u" })   # git log alone ≠ verification
finish({ status: "success", ... })
```
```
finish({ status: "success", summary: "No action needed." })          # zero tool calls before finish
```

**Rule for Scout heartbeats**: if your last tool call before `finish(success)` is a `git` command or nothing at all, insert one `ls`/`cat`/`tail` on inbox, todo.md, or a project status file first. One extra op. Takes 2 seconds.

## When to Skip

- `finish(failure)` or `finish(blocked)` — no deliverable to verify
- Session is pure analysis with no file output — but then cite the evidence in your summary
