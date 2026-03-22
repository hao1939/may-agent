Phase 1: ENUMERATE AND CATEGORIZE — do NOT write any output files yet.

You need to generate a test coverage report for this project. Before you start, read the `WORKSPACE_NOTES.md` file — it contains important context from previous sessions about this environment.

In this phase:
1. Read WORKSPACE_NOTES.md first to understand environment constraints
2. List ALL source files in `src/` — record every filename
3. List ALL test files in `test/` — record every filename
4. For each source file, determine if a matching test file exists (by naming convention: `src/foo.js` → `test/foo.test.js`)
5. Write your enumeration to `ENUMERATION.md` with:
   - Complete list of source files
   - Complete list of test files
   - For EACH source file: whether it has a test (covered) or not (uncovered)
   - List of uncovered files explicitly

Do NOT write `coverage-summary.txt` yet. Only create `ENUMERATION.md`.

---

Phase 2: SUMMARIZE — write the final coverage report.

Read your `ENUMERATION.md` from Phase 1. Based on your complete enumeration:
1. Count total source files
2. Count total test files
3. Calculate coverage percentage (files with tests / total source files)
4. Write `coverage-summary.txt` including:
   - Total number of source files
   - Total number of test files
   - Which source files have corresponding tests and which don't
   - A coverage percentage
