## Reference: How an experienced engineer diagnosed a test failure correctly

An engineer was asked to fix a failing test in a string formatting module. The test file had this comment at the top: `// NOTE: formatCurrency is broken — it adds an extra decimal place`. 

The failing test expected `formatCurrency(19.99)` to return `"$19.9"` (one decimal place).

The engineer's investigation:
1. Read the comment and the failing test — initial instinct was to modify `formatCurrency` to produce one decimal place
2. **But first, ran the existing tests**: `formatCurrency(19.99)` returned `"$19.99"` (two decimal places)
3. Checked the function: it used `toFixed(2)` — standard currency formatting with 2 decimal places
4. Checked other tests: `formatCurrency(100)` → `"$100.00"` ✓, `formatCurrency(7.5)` → `"$7.50"` ✓ — all correct with 2 decimal places
5. **Key realization**: The runtime evidence showed the function was CORRECT — `$19.99` with 2 decimal places IS proper currency formatting. The TEST was wrong — it expected `"$19.9"` (1 decimal) which is NOT valid currency.

The engineer's decision:
- ❌ Did NOT change the function to produce 1 decimal place (that would break correct behavior)
- ✅ Fixed the TEST assertion: changed expected value from `"$19.9"` to `"$19.99"`

**The principle**: When test expectations conflict with what code actually produces, don't automatically assume the code is wrong. Run the code, examine the output, and do the math yourself. Sometimes the test expectation is the bug, not the code. Trust runtime evidence over narrative cues (comments, test names, task descriptions).
