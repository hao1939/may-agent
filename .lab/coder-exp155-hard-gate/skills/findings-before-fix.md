# Skill: Findings Before Fix (Hard Gate)

## When to Apply
When investigating bugs, errors, or failures in code — especially when the first error might mask deeper issues.

## The Rule
**NEVER start fixing code until you have written FINDINGS.md.**

## Process

### Step 1: Investigate ONLY (no fixes)
Read the code, run the failing command, and trace the FULL dependency chain.

After finding the first bug, ask: "If I fix this, what else might break?" Keep investigating.

### Step 2: Write FINDINGS.md (MANDATORY)
Create `FINDINGS.md` in the project root listing EVERY bug you found.

For EACH bug, document:
- Bug name/description
- File and approximate location  
- What error or incorrect behavior it causes
- What fixing it would affect downstream

There are often MULTIPLE bugs. The first error you see is NOT the only problem. Trace through validation, checksums, data integrity, and configuration dependencies.

### Step 3: Check Your Findings
Before proceeding to fix anything, verify:
- Does FINDINGS.md list at least 2 distinct issues? (If only 1, keep investigating)
- Have you traced the full dependency chain?
- Have you considered what happens AFTER fixing the obvious bug?

### Step 4: Fix Using Your Findings
Now fix ALL bugs listed in FINDINGS.md. Reference your findings as you work — don't rely on memory.

## Why This Works
Agents naturally rush to fix the first error they see, missing hidden dependencies. Writing findings BEFORE fixing forces you to articulate the full problem space. The act of writing surfaces issues that thinking alone misses.
