# Skill: Verify Context Claims

**Purpose**: When session context or task descriptions claim files exist at specific paths, ALWAYS verify those paths exist before trusting them. If a file isn't where context says, locate it with `find`/`ls` and proceed with the actual location. Never give up or refuse a task because paths don't match expectations.

## The Rule

**Every file path mentioned in session context or task descriptions MUST be verified with a tool call before relying on it. If the path doesn't exist, locate the actual file before deciding what to do.**

## When to Apply

1. **Context says "prior session created/modified X.js"** — verify X.js exists at the stated path
2. **Task says "read src/foo.js"** — verify `src/foo.js` exists; if not, `find . -name "foo.js"`
3. **Multiple files referenced** — verify ALL of them, not just the first one
4. **Path errors (ENOENT)** — this is a signal to LOCATE, not to STOP

## Protocol

### Step 1: List/verify paths from context
When the task mentions file paths, verify they exist:
```bash
# Quick check — do the claimed paths exist?
ls src/users.js src/products.js src/orders.js 2>&1
```

### Step 2: If paths are missing, LOCATE them
```bash
# Find the actual location
find . -name "users.js" -type f 2>/dev/null
# Or explore the directory structure
ls -R . | head -40
```

### Step 3: Read actual files at their real locations
Once you find the real paths, read them and base all decisions on what you actually see in the files — not what context claims about them.

### Step 4: Complete the task using real paths
Adjust your work to use the actual file locations. If context said `src/foo.js` but the file is at `environment/src/foo.js`, work with `environment/src/foo.js`.

## Anti-Patterns (NEVER DO)

### ❌ ENOENT → Give Up
```
read("src/users.js") → ENOENT
"The files don't exist. I cannot complete this task."
finish({ status: "blocked" })
```
This is WRONG. The files exist — they're just at a different path. Use `find` to locate them.

### ❌ ENOENT → Find Files → Refuse Task
```
read("src/users.js") → ENOENT
find . -name "users.js" → ./environment/src/users.js
"These files are in environment/, not src/. The context was wrong. I cannot trust anything."
finish({ status: "blocked" })
```
This is also WRONG. You found the files! Read them and do the task.

### ❌ Trust Context Claims Without Verification
```
Context says: "All 5 files were updated with new error format"
"OK, I'll write the migration doc saying all 5 files were updated."
```
This is WRONG. Context claims may be false. Read EACH file and verify.

## Correct Pattern

### ✅ Locate → Read → Verify → Complete
```
# Context says files are at src/users.js etc.
ls src/ → No such directory
find . -name "users.js" → ./environment/src/users.js

# Read each file at its ACTUAL location
read("environment/src/users.js")  → has new error format ✅
read("environment/src/products.js") → has new error format ✅
read("environment/src/orders.js") → has new error format ✅
read("environment/src/payments.js") → still has OLD format ❌
read("environment/src/notifications.js") → still has OLD format ❌

# Context claimed all 5 were updated. Reality: only 3 were.
# Write accurate doc based on what I actually found.
write("docs/error-format-migration.md", { content: "..." })
```

## Why This Matters

- **FM-3.1 prevention**: The #1 ghost-deliverable failure mode is trusting context claims about file state without verification
- **Path discrepancies are normal**: Working directories, project restructuring, and environment setup can all cause path differences
- **Your job is to work with reality**: If files are at different paths, that's fine — adapt and continue. The task is still valid.

## Key Insight

Context claims about prior work are often partially or completely wrong. Your value as an agent comes from **discovering the truth** by reading actual files and **completing the task based on reality**. A path mismatch is just a minor obstacle — use `find`/`ls` to solve it in seconds, then proceed with the real work.

## Assertion

When a file path from context produces ENOENT, the agent MUST attempt to locate the file (via `find`, `ls`, or directory exploration) before reporting the task as blocked or impossible.
