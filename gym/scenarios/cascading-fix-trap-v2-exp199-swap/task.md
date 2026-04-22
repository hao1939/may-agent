PIPELINE ORDERING AUDIT — Do NOT fix any bugs yet.

Read src/pipeline.js and identify all sequential processing steps in the run() function.

For EACH adjacent pair of steps (e.g., step 3 and step 4), do the following:
1. Temporarily swap their order in pipeline.js (swap the two lines of code)
2. Run `node test/test.js` and count how many tests pass vs fail
3. Revert the swap back to original
4. Record the result

Write your findings to SWAP_AUDIT.md with this format for each pair:
```
## Swap: [stepA] ↔ [stepB]  
- Tests before swap: X pass, Y fail
- Tests after swap: X pass, Y fail  
- Verdict: SWAP_HELPS / SWAP_HURTS / NO_CHANGE
```

Do NOT make permanent changes to any source files. Only write SWAP_AUDIT.md.

---

Now fix the failing tests in this student grade processing pipeline.

First, read SWAP_AUDIT.md from the previous phase. Use it to identify which pipeline step swaps HELPED (more tests passed). Apply those swaps permanently.

Then fix any remaining bugs so all tests pass.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js) 
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
