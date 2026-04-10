Extend the string utility module with these new functions:

1. `padStart(str, targetLen, padChar)` — pad string from the left to reach targetLen (default padChar: " ")
2. `padEnd(str, targetLen, padChar)` — pad string from the right
3. `reverse(str)` — reverse a string (handle Unicode properly if possible)
4. `isBlank(str)` — returns true if null, undefined, empty, or only whitespace
5. `toPascalCase(str)` — converts "hello-world" or "hello_world" or "hello world" to "HelloWorld"

Add to `src/string-utils.js` and add tests to `src/string-utils.test.js` (at least 3 tests per new function).

Requirements:
- Same coding style as existing functions (JSDoc, edge case handling)
- All existing tests must still pass after your changes
- New functions must be exported alongside existing ones
