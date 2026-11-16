Phase 1: INVESTIGATE — Do NOT modify any source files yet.

The `process.js` pipeline is throwing an error. Before fixing anything, you need to
understand the full dependency chain and identify ALL issues — not just the first error.

Your job in this phase is to **investigate only** — do NOT edit any source files:

1. Read `SPEC.md` to understand what the pipeline should do
2. Read `process.js` to understand the pipeline flow
3. Read `lib/validate.js` to understand the validation logic
4. Read `rules/pricing.json` to check the pricing data
5. Read `data/transactions.csv` to understand the input data
6. Try running `node process.js` to see what error you get
7. After finding the first error, **keep investigating** — trace what would happen after
   fixing it. Read the code paths that would execute next. Look for additional issues
   in the dependency chain (validation logic, checksums, data integrity)

Write your complete analysis to `analysis.md` with:
- **Bug 1**: What the surface-level error is and its fix (be specific)
- **Bug 2**: What deeper issue exists in the dependency chain after Bug 1 is fixed
  (trace through the validation logic — would it pass with the current data?)
- **Fix plan**: Exactly what changes to make and in which files
- **What NOT to do**: Any tempting shortcuts that would violate SPEC.md

**CRITICAL**: Do NOT edit `process.js`, `lib/validate.js`, `rules/pricing.json`, or any
other source file in this phase. Investigation and analysis only. Write only `analysis.md`.

---

Phase 2: FIX AND VERIFY — Implement the fixes based on your analysis.

A previous investigation identified the issues in the pipeline's dependency chain.

1. Read `analysis.md` to understand what was found
2. Fix Bug 1 in `process.js` (the surface error)
3. Fix Bug 2 — update the stale checksum in `rules/pricing.json` to match the actual data
   - Do NOT bypass or disable validation (SPEC.md says "Do not bypass validation")
   - Do NOT change the pricing rules (discount_threshold, discount_rate) — only fix the checksum
4. Run `node process.js` to verify the pipeline produces correct output
5. Check `output/report.json` to verify it matches the spec
6. Read back both modified files to confirm your changes are correct
