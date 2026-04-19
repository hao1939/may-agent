---
name: verify-deliverables-before-finish
description: >
  Before calling finish(status: "success"), verify that EVERY file path you intend
  to list in `deliverables` actually exists on disk RIGHT NOW. Files you wrote earlier
  in the session may have been renamed, deleted, or overwritten by concurrent sessions.
  Do not assume a file still exists just because you wrote it — check first.
version: 1.0.0
owner: coach
targets: FM-3.1 (ghost deliverables) — agent lists files in finish() deliverables that don't exist on disk
evidence: >
  C1.5 regression analysis (2026-04-09): Bob's pass rate dropped 100% → 81.8% in 12h.
  Root cause: concurrent sessions renaming/renumbering knowledge entries (KE-079, KE-089,
  KE-095, DD-685) between write time and finish() time. The existing verify-after-edit
  skill covers post-edit verification but not pre-finish deliverable verification.
  18 failures in 24h, all following the same pattern: file written → renamed by another
  session → finish() claims original path → ghost.
---

# Verify Deliverables Before Finish

## When to Apply

Apply this skill **every time you are about to call `finish(status: "success")`** with a non-empty `deliverables` array.

This is especially critical when:
- You wrote files to a **shared directory** (e.g., `agents/shared/knowledge/`)
- Your session has been running for **more than a few minutes** (concurrent sessions may have modified your files)
- You created files with **sequential IDs** (KE-XXX, DD-XXX) where another session could have claimed the same number
- You ran a **workflow** whose sub-sessions created the actual files

## Why This Matters

Files you wrote CAN DISAPPEAR between when you wrote them and when you call `finish()`:

1. **ID collision**: You write `KE-095-foo.md`, but another concurrent session also wrote `KE-095-bar.md`. A cleanup session deletes yours and renumbers it to `KE-096-foo.md`.
2. **Preliminary → Final**: You write `results-preliminary.md`, another session writes `results.md` and deletes the preliminary version.
3. **Workflow attribution**: A workflow's sub-session created the file, not your session. If the file was cleaned up, you're claiming a ghost.

Declaring a non-existent file in `deliverables` is a **C1.5 violation** (ghost deliverable) and will be flagged by convention checks.

## Steps

### Step 1: Before calling finish(), list all file paths you plan to claim as deliverables

Mentally (or in a scratch note) collect every path you want to put in `deliverables`.

### Step 2: Verify each file exists with a single bash command

```bash
for f in \
  "agents/shared/knowledge/entries/KE-095-unified-verification-architecture.md" \
  "agents/shared/knowledge/INDEX.md"; do
  if [ -f "$f" ]; then echo "✅ EXISTS: $f"
  else echo "❌ MISSING: $f"; fi
done
```

### Step 3: Remove any missing files from your deliverables list

If a file is missing:
- **Do NOT claim it** in deliverables
- Note in your summary that the file was written but may have been renamed/moved by a concurrent session
- If you can quickly re-create it or find its new path, do so and claim the correct path

### Step 4: Only then call finish()

Your `deliverables` array should contain ONLY paths that returned "EXISTS" in Step 2.

## Examples

### ❌ BAD: Assume files still exist because you wrote them

```
// Earlier in session:
write({ path: "agents/shared/knowledge/entries/KE-095-foo.md", content: "..." })
// ...20 ops later:
finish({
  status: "success",
  deliverables: [
    { path: "agents/shared/knowledge/entries/KE-095-foo.md", description: "New KE" }
  ]
})
// DANGER: KE-095-foo.md may have been renamed to KE-096-foo.md by now!
```

### ✅ GOOD: Verify before claiming

```
// Earlier in session:
write({ path: "agents/shared/knowledge/entries/KE-095-foo.md", content: "..." })
// ...20 ops later, BEFORE finish():
bash({ command: 'test -f "agents/shared/knowledge/entries/KE-095-foo.md" && echo EXISTS || echo MISSING' })
// → "EXISTS"
finish({
  status: "success",
  deliverables: [
    { path: "agents/shared/knowledge/entries/KE-095-foo.md", description: "New KE" }
  ]
})
```

### ✅ GOOD: Handle a missing file gracefully

```
bash({ command: 'test -f "agents/shared/knowledge/entries/KE-095-foo.md" && echo EXISTS || echo MISSING' })
// → "MISSING"

// Check if it was renamed:
bash({ command: 'ls agents/shared/knowledge/entries/KE-09[56]* 2>/dev/null' })
// → "agents/shared/knowledge/entries/KE-096-foo.md"

finish({
  status: "success",
  summary: "Wrote KE-095-foo.md but it was renumbered to KE-096 by a concurrent session.",
  deliverables: [
    { path: "agents/shared/knowledge/entries/KE-096-foo.md", description: "New KE (renumbered from 095)" }
  ]
})
```

## Assertions

1. Before every `finish(status: "success")` with deliverables, the agent runs a file-existence
   check (bash `test -f`, `ls`, or `read`) for each claimed deliverable path.

2. No path appears in `deliverables` unless the agent has verified it exists within the
   last 3 tool calls before `finish()`.

3. If a file was written earlier but no longer exists, the agent either finds its new path
   or omits it from deliverables — it does NOT claim a non-existent path.
