# Finding: Bob Tool Gap Analysis (Mode B)
**Date**: 2026-04-20  
**Window**: Last 6h, 43 bob sessions, 404 bash commands analyzed  
**Bob cost**: ~$107/day (highest agent)

## Summary

Bob uses bash for **everything** and ignores existing helper scripts entirely. Three patterns account for ~180 of 404 bash ops (45%) and are directly reducible.

---

## Pattern 1: Knowledge Base File Discovery Spirals
**Frequency**: 64 bash ops across 6h (1.5/session avg)  
**What happens**: Bob runs sequences of `grep -l`, `find`, `ls`, `head` against `agents/shared/knowledge/` to locate DD/KE/H/EXP files by ID. Often 3-5 probes per lookup due to inconsistent naming.

**Existing tool**: `agents/shared/scripts/kb-find.sh` — **exists and solves this exactly**. Zero usage by Bob.

**Estimated savings**: 64 ops → ~20 ops (1 call per lookup instead of 3-5). **~44 ops saved / 6h**.

**Fix**: Add `kb-find.sh` to Bob's context.md as a known tool. One line.

---

## Pattern 2: `cat` in Bash Instead of `read()` Tool
**Frequency**: 45 bash ops across 6h  
**What happens**: Bob uses `bash("cat file | head -N")` instead of the native `read()` tool. This wastes the bash sandbox overhead and doesn't get pagination.

**Existing tool**: Built-in `read()` tool with offset/limit.

**Estimated savings**: Not pure op-count savings (still 1 op each), but `read()` is cheaper in latency and gives better truncation behavior. **Behavioral fix, not op savings.**

**Fix**: Add lesson to Bob's context.md: "Use read() for file contents, not bash cat."

---

## Pattern 3: Git Ceremony Sprawl  
**Frequency**: 95 git-related bash ops across 6h (2.2/session avg)  
**What happens**: Bob runs `git add`, `git status`, `git diff`, `git log`, `git commit` as separate commands. Often: add → status check → commit → status check again. The `commit-and-merge.sh` script exists but is unused.

**Existing tool**: `agents/shared/scripts/commit-and-merge.sh` — **exists, zero usage**.

**Estimated savings**: 95 ops → ~45 ops (combine add+commit into 1 call, eliminate status checks). **~50 ops saved / 6h**.

**Fix**: Add `commit-and-merge.sh` to Bob's context.md. Also consider a simpler `git-save.sh` one-liner if commit-and-merge is too heavy.

---

## Impact Summary

| Pattern | Ops/6h | Reducible to | Savings | Fix |
|---------|--------|-------------|---------|-----|
| KB discovery spirals | 64 | ~20 | **44 ops** | context.md: mention kb-find.sh |
| Git ceremony | 95 | ~45 | **50 ops** | context.md: mention commit-and-merge.sh |
| cat vs read() | 45 | 45 (behavior) | latency only | context.md: prefer read() |

**Total reducible**: ~94 ops / 6h → ~376 ops/day → at ~$0.01-0.03/op = **$4-11/day savings** (4-10% of Bob's cost).

## DISPATCH Decision

**YES — actionable**. The fix is trivial: add 3 lines to `agents/bob/context.md` referencing existing tools. No new code needed.

Recommended context.md additions:
```
## Tools available
- `bash agents/shared/scripts/kb-find.sh DD-770` — resolve KB IDs to file paths (don't grep manually)
- `bash agents/shared/scripts/commit-and-merge.sh "message"` — git add+commit in one call
- Use `read()` tool for file contents instead of `bash("cat ...")`
```

**Action**: Fork to tech-lead to add these lines to Bob's context.md and verify bob picks them up in next sessions.
