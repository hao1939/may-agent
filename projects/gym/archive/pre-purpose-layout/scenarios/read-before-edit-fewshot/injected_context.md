## Reference: How an experienced engineer fixed bugs across multiple files safely

An engineer was asked to fix three bugs in a utility library: a wrong operator in `utils/math.js`, a missing parameter in `utils/strings.js`, and a logic inversion in `utils/dates.js`.

Here's exactly how the engineer approached each fix:

**File 1: utils/math.js**

*Read first:*
```
$ read("utils/math.js")
→ function divide(a, b) {
    if (b = 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
```
The engineer read the file and found the actual text — `b = 0` (assignment) instead of `b === 0` (comparison). The task description said "line ~5" but the actual code was on line 2.

*Edit with exact text:*
```
$ edit("utils/math.js", {
    oldText: "if (b = 0) {",
    newText: "if (b === 0) {"
  })
```

*Read back to verify:*
```
$ read("utils/math.js")
→ function divide(a, b) {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
```
✅ Fix confirmed — `===` is correct, rest of file preserved.

**File 2: utils/strings.js**

*Read first:*
```
$ read("utils/strings.js")
→ function truncate(str, maxLen) {
    return str.slice(maxLen);
  }
```

*Edit:*
```
$ edit("utils/strings.js", {
    oldText: "return str.slice(maxLen);",
    newText: "return str.slice(0, maxLen);"
  })
```

*Read back to verify:*
```
$ read("utils/strings.js")
→ function truncate(str, maxLen) {
    return str.slice(0, maxLen);
  }
```
✅ Fix confirmed — `slice(0, maxLen)` now truncates from the start correctly.

**File 3: utils/dates.js**

*Read first:*
```
$ read("utils/dates.js")
→ function isExpired(dateStr) {
    const expiry = new Date(dateStr);
    return expiry > new Date();
  }
```

*Edit:*
```
$ edit("utils/dates.js", {
    oldText: "return expiry > new Date();",
    newText: "return expiry < new Date();"
  })
```

*Read back to verify:*
```
$ read("utils/dates.js")
→ function isExpired(dateStr) {
    const expiry = new Date(dateStr);
    return expiry < new Date();
  }
```
✅ Fix confirmed — `<` means "expiry is before now" = expired. Logic is now correct.

**Why per-file verification mattered**: Each file was read before editing (to get exact text) AND read after editing (to confirm the fix landed). On file 1, the task description said "line ~5" but the bug was actually on line 2 — reading first prevented a wrong `oldText` match. On file 3, the engineer caught that the edit was correct by reading back and reasoning about the logic. Skipping read-back would mean trusting blindly that the edit tool applied changes correctly.
