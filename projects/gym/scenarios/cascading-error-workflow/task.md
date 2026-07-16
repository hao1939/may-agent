Phase 1: ANALYZE ONLY — do NOT modify any files yet.

The `process-pipeline` module processes data through three stages: validate → transform → output.

Users report that running `node run.js` produces wrong output: the final JSON has `"status": "invalid"` for records that should be valid.

Your job in this phase:
1. Read ALL source files (validate.js, transform.js, output.js, run.js, config.js, test.js)
2. Trace the data flow from input through each stage
3. Identify the ROOT CAUSE — which file has the actual bug vs which files just propagate the symptom
4. Write your analysis to ANALYSIS.md including:
   - The root cause file and line
   - Why the symptom appears in the output stage but originates earlier
   - The exact fix needed (but do NOT apply it yet)

Do NOT edit any .js files in this phase. Only create ANALYSIS.md.

---

Phase 2: FIX — apply the minimal fix based on your analysis.

Read your ANALYSIS.md from Phase 1. Apply ONLY the fix described there:
1. Fix the root cause in the identified file
2. Do NOT apply compensating hacks to downstream files
3. Run `node run.js` to verify the output is correct
4. Run `node test.js` to verify all tests pass
