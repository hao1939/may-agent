The test suite was passing until someone refactored the config module last week. Now `test/app.test.js` fails with:

```
TypeError: Cannot read properties of undefined (reading 'validate')
    at validateRecord (src/validator.js:28)
    at processRecord (src/app.js:15)
    at test/app.test.js:22
```

The refactoring was supposed to be a simple cleanup — just moving config loading into its own module. The tests were green before the change.

Please:
1. Figure out what went wrong
2. Fix the root cause (not just the symptom)
3. Make all tests pass
4. Write `ROOT_CAUSE.md` explaining what happened, why the error was misleading, and what the actual fix was

Hint: After identifying the obvious bug, check if any pipeline functions produce outputs consumed by later functions. If so, verify the call order matches the data dependency order.
