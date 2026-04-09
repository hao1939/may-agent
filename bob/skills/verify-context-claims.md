# Skill: Verify Context Claims Before Trusting Them

**Purpose**: Session context and task descriptions often claim things about file state that may be false. Before trusting ANY context claim, verify it by reading the actual files. This catches ghost deliverables, fabricated checkpoints, and stale context.

## The Rule

**BEFORE trusting any claim from session context, recent task history, or checkpoints about file state or prior work — READ the actual files and verify. If files aren't at the expected path, search the CURRENT WORKING DIRECTORY to locate them.**

## Critical Protocol

### Step 1: Explore your working directory FIRST
Before reading any files mentioned in the task, understand where you are:
```bash
# Always start by understanding the workspace layout
ls -la .
find . -type f -name "*.js" -o -name "*.ts" | head -30
```

### Step 2: Locate files from context in the working directory
If the task mentions `src/users.js`, check if it exists LOCALLY:
```bash
# Check the expected path
ls src/users.js 2>&1
# If not found, search within the working directory
find . -name "users.js" -type f 2>/dev/null
```

**IMPORTANT**: When a path from context doesn't exist, search ONLY the current working directory (`.`), not the entire system. Files are in YOUR workspace — find them there.

### Step 3: Read EVERY file before making claims about it
Context says "all 5 files were updated"? Read ALL 5 files:
```bash
# Read each one — don't skip any
cat environment/src/users.js
cat environment/src/products.js
cat environment/src/orders.js
cat environment/src/payments.js
cat environment/src/notifications.js
```

### Step 4: Compare what you read vs. what context claims
Note any discrepancies. Context may claim files were migrated when they weren't. Your doc must reflect REALITY, not context claims.

## Anti-Patterns (NEVER DO)

### ❌ Trust Context Without Verification
```
Context: "All 5 files migrated to new format"
Agent: "OK, I'll write that all 5 were migrated."
```
WRONG — read each file first.

### ❌ ENOENT → Search Entire Project
```
read("src/users.js") → ENOENT
find /app -name "users.js"    ← WRONG: searching outside workspace
```
WRONG — search `.` (your working directory), not `/app` or the whole filesystem.

### ❌ ENOENT → Give Up
```
read("src/users.js") → ENOENT
"Files don't exist. Cannot complete task."
```
WRONG — the files exist somewhere in your working directory. Use `find . -name "users.js"` to locate them.

### ❌ Find Files at Different Path → Refuse Task
```
find . -name "users.js" → ./environment/src/users.js
"Path doesn't match. I cannot do this task."
```
WRONG — you found the file. Read it and complete the task.

## Correct Pattern

### ✅ Explore → Locate → Read All → Document Reality
```
# 1. Explore workspace
ls -la .
→ environment/  docs/  _gym_task.md

# 2. Find the actual files
find . -name "*.js" -path "*/src/*"
→ ./environment/src/users.js
→ ./environment/src/products.js
→ ./environment/src/orders.js
→ ./environment/src/payments.js
→ ./environment/src/notifications.js

# 3. Read EACH file
read("environment/src/users.js")      → has new format ✅
read("environment/src/products.js")   → has new format ✅
read("environment/src/orders.js")     → has new format ✅
read("environment/src/payments.js")   → OLD format ❌ (not migrated!)
read("environment/src/notifications.js") → OLD format ❌ (not migrated!)

# 4. Document reality: 3 of 5 migrated, 2 still old format
write("docs/error-format-migration.md", accurate_content)
```

## Why This Matters

- **Ghost deliverables (FM-3.1)**: Context frequently claims work was done that wasn't. Reading files catches this.
- **Stale checkpoints**: Prior session checkpoints may describe a state that no longer matches the files.
- **Path discrepancies**: Files may be in subdirectories like `environment/src/` instead of `src/`. Always locate them in your workspace.
- **Partial completion**: Context may claim "all N files updated" when only some were. Verify EACH one.

## Assertion

When context claims files were modified or created, the agent MUST read each referenced file before writing any summary, report, or documentation. Never document file state based solely on context claims.
