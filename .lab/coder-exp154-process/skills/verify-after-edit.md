# Skill: Atomic Edit Protocol

**Every file edit is a 3-step atomic unit. You cannot break or reorder these steps.**

## The Atomic Unit

```
STEP 1: read(file)     — understand current state
STEP 2: edit(file)     — make the change  
STEP 3: read(file)     — CONFIRM the change (mandatory)
```

## The Rule

**After every `edit()` or `write()` call, your VERY NEXT tool call MUST be `read()` of that same file.**

This is not advice. This is a hard constraint on your tool call sequence:
- `edit("src/foo.js", ...)` → next call MUST be `read("src/foo.js")`  
- `write("config.json", ...)` → next call MUST be `read("config.json")`
- You may NOT: edit another file, run a test, call bash, or do anything else before the readback

## Multi-File Workflow

When editing N files, execute N complete atomic units in sequence:

```
read("src/a.js")       ← Unit 1, step 1
edit("src/a.js", ...)  ← Unit 1, step 2
read("src/a.js")       ← Unit 1, step 3 ✓ CONFIRM

read("src/b.js")       ← Unit 2, step 1
edit("src/b.js", ...)  ← Unit 2, step 2
read("src/b.js")       ← Unit 2, step 3 ✓ CONFIRM

read("src/c.js")       ← Unit 3, step 1
edit("src/c.js", ...)  ← Unit 3, step 2
read("src/c.js")       ← Unit 3, step 3 ✓ CONFIRM

bash("npm test")       ← ONLY after ALL atomic units complete
```

## Why Tests Don't Count as Readback

Tests verify behavior. Readback verifies the file was edited correctly. These are different:
- Tests can pass even if the edit didn't land (wrong code path)
- Tests can't detect dropped fields in config files
- Only reading the actual file confirms the text is what you intended

## Violation Examples

❌ VIOLATION: edit a.js → edit b.js → edit c.js → test
❌ VIOLATION: edit a.js → bash("cat a.js") → edit b.js  
❌ VIOLATION: edit a.js → "the diff looks good, moving on"

✅ CORRECT: edit a.js → read a.js → edit b.js → read b.js → edit c.js → read c.js → test
