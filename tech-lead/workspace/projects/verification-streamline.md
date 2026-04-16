# Verification Overhead Streamline

**Owner:** tech-lead
**Goal:** Reduce FM-3.3 guard friction without reducing safety.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](../../may/workspace/projects/system-evolution.md) → Gap 3
**Source feedback:** [optimizer](../../optimizer/workspace/system-gaps.md), [scout](../../scout/workspace/system-gaps.md)
**Tracked metrics:** `coder.first-pass-rate`, `optimizer.quality-preserved`

## Why
Guards currently treat all file operations equally. Creating a new file and editing critical infrastructure both require the same verification overhead. Agents spend 15-20% of ops on redundant re-reads within the same session.

## Milestones

- [ ] **Distinguish file-creation from file-editing in guards** — New files (no existing content to corrupt) should have lighter verification than edits to existing files.
- [ ] **Edit-and-verify compound operation** — Scout suggested: combine edit + read-back into a single logical step. The tool already returns a diff preview.
- [ ] **Exempt self-authored files from mandatory re-read within same session** — If I wrote the file 3 steps ago and haven't switched context, I don't need to re-read it. Optimizer flagged this specifically.

## Progress Log
<!-- Append entries as milestones are completed -->

### Iteration 1 — 2026-04-16T12:44:52.432Z
**Worker task**: Iteration 1 — work toward goal
**Worker result**: **Status:** done (8m37s)

**Files read (not modified):**
- src/lib/tools/verification-depth-guard.ts
- src/lib/tools/verification-depth-guard.test.ts
- test/finish-guard.test.ts
- src/lib/tools/finish-guard.ts

**Errors encountered:**
- [bash] 1 | 
2 | import{Database}from'bun:sqlite';
3 | const db=new Database('.state/may.db',{readonly:true});
4 | // Find sessions where finish was blocked multiple times (FM-3.3 retries)
5 | const rows = db.query(`
                    ^
SQLiteError: no such column: s.id
      errno: 1,
 byteOffset: 10,

 

**Agent response:**
The guard running in this session is the *old compiled version*, not the one I just edited. The irony. Let me satisfy it with an explicit read:
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — — Iteration 1 produced no deliverables. The worker read guard source files and hit a SQL error, but didn't produce any analysis or code changes.

Next iteration:

1. **Skip DB queries** — the schema doesn't have what you need. Instead, analyze the guard source code directly.
2. **Read** `src/lib/tools/verification-depth-guard.ts` and `src/lib/tools/finish-guard.ts` — identify specific conditions that cause false positives (FM-3.3 = declaring DONE without sufficient verification).
3. **Produce a concrete analysis doc** at `agents/may/workspace/guard-friction-analysis.md` with:
   - Each guard's trigger conditions
   - Which conditions cause false positives (block legitimate work)
   - Specific code changes to reduce friction while maintaining safety
4. **If time permits**, implement the lowest-risk improvement (e.g., better error messages, smarter spot-check detection).

