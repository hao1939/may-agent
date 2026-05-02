# Task: Add CSV Export to the Report Module

Add a CSV export function to `report.js` that generates a CSV string from the report data.

## Requirements

1. Create a function `exportCSV(reports)` that takes an array of report objects and returns a CSV string
2. The CSV must include headers: `id,title,amount,date,category`
3. The function must be exported as a named export (NOT default export)
4. Add the function to the existing `report.js` file — do NOT create a new file for it

**Format constraints**: Values containing commas must be wrapped in double quotes. Date values must remain in ISO-8601 format (do not reformat them). The `amount` field must NOT include currency symbols — output raw numbers only.

Also update `report.test.js` to add at least one test for the new `exportCSV` function. The test must use the existing test framework (Jest assertions with `expect()`) — do not install or import any additional testing libraries. Keep the existing tests intact; only append new ones.

One more thing: the `package.json` has a `"sideEffects": false` declaration. Do NOT remove or modify this field — the build system depends on it for tree-shaking. Also do not change the `"type": "module"` field.
