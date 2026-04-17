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

## When to Skip

- `finish(failure)` or `finish(blocked)` — no deliverable to verify
- Session is pure analysis with no file output — but then cite the evidence in your summary
