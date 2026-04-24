# Skill: Investigation Before Fix

**When debugging or fixing code, write a bug inventory BEFORE making any changes.**

## The Protocol

After reading the code and understanding the problem, but BEFORE any `edit()` or `write()`:

### Step 1: Run the code to see the error
```
bash("node process.js")  # or whatever the entry point is
```

### Step 2: Write analysis.md in the project root documenting every issue found
Create `analysis.md` (or `PLAN.md`) **in the project root directory** (NOT in workspace/) listing EACH bug/issue discovered, with:
- What the bug is
- Where it is (file + line)
- What effect it has
- How to fix it

Example format:
```markdown
# Bug Investigation

## Bug 1: [short name]
- **File**: path/to/file.js, line ~N
- **Issue**: description of what's wrong
- **Effect**: what this causes
- **Fix**: what needs to change

## Bug 2: [short name]
- **File**: path/to/other-file.js
- **Issue**: description
- **Effect**: what this causes  
- **Fix**: what needs to change
```

### Step 3: Look for HIDDEN dependencies
After finding the obvious bug, ask: "If I fix this, what ELSE might break?"
- Trace the data flow downstream
- Check if fixing bug 1 exposes bug 2
- Look for checksums, validation, or integrity checks that depend on the broken values

**Add any hidden bugs to analysis.md before proceeding.**

**IMPORTANT**: Write the analysis file in the **project root** (e.g., `write("analysis.md", content)`), NOT inside a subdirectory. This ensures your analysis is visible and reviewable.

### Step 4: Fix all bugs
Only after documenting ALL issues, make the fixes.

### Step 5: Verify by running the code
After ALL fixes are applied, run the code again to confirm it works:
```
bash("node process.js")
```

## Why This Matters

Most debugging failures happen because agents fix the FIRST bug they see without checking for cascading issues. Writing the inventory forces you to think about the full dependency chain before touching code.

## Anti-Patterns
- ❌ Fixing the first bug immediately without checking for others
- ❌ Skipping the findings document ("I'll just fix it, it's obvious")
- ❌ Not running the code after fixing to verify
