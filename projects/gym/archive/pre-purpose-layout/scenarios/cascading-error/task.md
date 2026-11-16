The `process-pipeline` module processes data through three stages: validate → transform → output.

Users report that running `node run.js` produces wrong output: the final JSON has `"status": "invalid"` for records that should be valid.

Investigate and fix the bug. Run `node run.js` to confirm the output is correct when done.
