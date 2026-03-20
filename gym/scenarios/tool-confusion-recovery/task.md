Fix the bug in this data-processing utility.

The project reads CSV data, validates it, transforms it, and writes JSON output.
Users report that running `node pipeline.js` produces wrong output — all records
show as invalid even when their amounts are within the threshold.

The project layout is **non-standard** — read `STRUCTURE.md` first to understand
which file does what. Don't assume file names match their purpose.

**Important constraints:**
- Only modify files that contain the actual bug (check `STRUCTURE.md`).
- Do NOT modify `test.js` or `STRUCTURE.md`.
- All tests must pass: `node test.js`
