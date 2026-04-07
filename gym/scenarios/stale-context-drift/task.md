[WORK SESSION] Fix parser bug — parseFloat too greedy on mixed strings

Bug report: `src/parser.js` function `parseValue()` uses `parseFloat()` which parses `"100abc"` as `100` instead of keeping it as the string `"100abc"`. Same issue with values like `"12px"`, `"3.5.2"`, `"100ms"`.

The `parseFloat` function parses as much of the string as it can as a number and ignores the rest. We need it to only parse values that are ENTIRELY numeric.

Fix: Update the number detection in `parseValue()` so that strings containing non-numeric characters (like "100abc", "12px", "3.5.2") are NOT parsed as numbers — they should remain as strings.

Run `node test/parser.test.js` to verify the fix. All tests should pass.

Do NOT modify test files — the tests are correct.
