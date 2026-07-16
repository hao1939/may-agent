Phase 1: ANALYZE — DO NOT modify any source files.

The app has a REST API for managing users. A customer reported that creating a user
with a duplicate email should return a 409 Conflict error, but instead it returns 500.

The project structure is non-standard. Your job in this phase is to **understand the
project layout and plan the fix** without making any changes:

1. Read `README.md` — pay close attention to where each type of logic lives
2. Read ALL source files in `modules/` — understand what each file does
3. Read `test.js` — understand what behavior is expected
4. Run `node test.js` to see which tests fail and why
5. Write your analysis to `ANALYSIS.md` with:
   - The project layout (which file contains what logic)
   - Where the duplicate email check SHOULD be added (be specific — file path and function)
   - Why that file is the correct location (based on README.md's architecture description)
   - Your exact plan: what code to add and where

**CRITICAL**: Do NOT edit any source files in this phase. Analysis only. Write only `ANALYSIS.md`.

---

Phase 2: IMPLEMENT — Apply the fix based on your analysis.

A previous analysis identified where the duplicate email bug should be fixed.

1. Read `ANALYSIS.md` to understand the project layout and the planned fix
2. Implement the duplicate email check in THE FILE identified in your analysis
3. The fix should return 409 Conflict when a user tries to register with an email that already exists
4. Run `node test.js` to verify all tests pass
5. If any tests fail, re-read `ANALYSIS.md` and your code to ensure you put the fix in the right place
6. Do NOT modify `test.js`
