# Process Skill: Atomic Edit Unit

This is the process skill designed for EXP-154 treatment condition.

## Core Concept

Every file modification is a **3-step atomic unit**. You cannot skip any step or reorder them.

```
STEP 1: read(file)     — understand current state
STEP 2: edit(file)     — make the change  
STEP 3: read(file)     — confirm the change landed
```

Step 3 is **mandatory**. Your next tool call after any `edit()` or `write()` MUST be `read()` of that same file. No exceptions.

## Why This Is Different From "Verify After Edit"

This is NOT advice. This is a workflow constraint:
- After `edit("src/foo.js", ...)` → your NEXT call MUST be `read("src/foo.js")`
- After `write("config.json", ...)` → your NEXT call MUST be `read("config.json")`
- You may NOT edit another file, run a test, or do anything else between step 2 and step 3

## Multi-File Workflow

When editing multiple files, complete each atomic unit before starting the next:

```
read("src/a.js")       ← Unit 1, step 1
edit("src/a.js", ...)  ← Unit 1, step 2
read("src/a.js")       ← Unit 1, step 3 ✓

read("src/b.js")       ← Unit 2, step 1
edit("src/b.js", ...)  ← Unit 2, step 2
read("src/b.js")       ← Unit 2, step 3 ✓

read("src/c.js")       ← Unit 3, step 1
edit("src/c.js", ...)  ← Unit 3, step 2
read("src/c.js")       ← Unit 3, step 3 ✓

bash("npm test")       ← Only AFTER all units complete
```

## Evidence Reconciliation (For Debug/Investigation Tasks)

When investigating a bug with conflicting information:

Before writing ANY fix, create a mental evidence map:
1. List every piece of evidence found (error logs, config files, code)
2. For each piece, note what it implies about the root cause
3. Identify conflicts between evidence sources
4. The fix must be consistent with ALL trustworthy evidence

Only write code after reconciliation is complete. The most common failure is: correctly finding all evidence but then fixing based on only ONE source (often the first one read, or the README, which may be stale).
