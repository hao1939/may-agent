# Skill: Post-Edit Readback

**After each edit(), immediately read() the same file to confirm the change.**

This is a hard convention (C2.3). Your workflow must be:

```
read("src/foo.js")         ← understand file
edit("src/foo.js", ...)    ← make change
read("src/foo.js")         ← CONFIRM change (C2.3)
```

The second read() is NOT optional. It's the readback that proves the edit worked.

**Do this for EVERY file you edit.** If you edit 3 files, you must read each one back after its edit.

**Anti-pattern**: editing all files first, then running tests. Tests are NOT a substitute for readback.
**Correct pattern**: edit file → read file → edit next file → read next file → ... → run tests
