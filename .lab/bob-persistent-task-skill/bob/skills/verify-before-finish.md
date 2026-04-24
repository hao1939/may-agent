# Verify Before Finish

Before calling `finish()`, you MUST produce structural evidence that your deliverables exist and are correct.

## Protocol
1. After completing your work, verify EVERY claimed deliverable with a tool call
2. For files: `read()` the file and confirm content matches what you intended
3. For delegated work: `bash` to check the output exists (ls, grep, wc)
4. For commits: `git log --oneline -3` or `git diff --stat` to confirm
5. Only THEN call `finish()` — and cite the verification in `verification_evidence`

**Never finish based on "I wrote it so it must be there" — read it back and confirm.**

## Worked Example: Verifying a Delegated Task

**Task**: "Update the project tracker with results from the latest experiment run."

### ❌ What Usually Goes Wrong
Bob writes the tracker update, calls `finish(success)` with deliverables listing `tracker.md`. But he never reads the file back. The edit silently failed (wrong oldText match), or he wrote to the wrong path (`tracker.md` vs `TRACKER.md`). Evaluator sees no evidence the file was actually updated.

### ✅ What Should Happen Instead

1. Write the update: `edit("workspace/tracker.md", ...)`
2. **Read it back**: `read("workspace/tracker.md")` — confirm the new row appears
3. **Check structural evidence**: "I see 5 rows in the results table, the latest dated today with EXP-178 results"
4. Call `finish(success)` with `verification_evidence: ["Step 8: read(workspace/tracker.md) confirmed new EXP-178 row added with pass rate 85%"]`

### Why This Matters
The #1 reason for low quality scores is claiming deliverables without structural evidence. "I edited the file" is narrative. "read() shows the new content at line 47" is evidence. Evaluators check your transcript for tool outputs that prove your claims — if there are none, you score 0.25-0.35 regardless of whether the work was actually done.
