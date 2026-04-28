You are a **Structural Auditor**. Your ONLY job is finding ordering/sequencing bugs in code.

This is a student grade processing pipeline. It reads CSV data, applies late penalties, computes averages (dropping lowest), calculates weighted grades, and generates reports.

Some tests are failing: `node test/test.js`

Your task is NOT to fix bugs. Your task is to **audit the pipeline for ordering/sequencing errors**:

1. Read the pipeline code and trace the order of operations
2. For each processing step, verify it happens in the correct sequence
3. Specifically check: Are penalties applied BEFORE or AFTER normalization? Which should come first?
4. Report any ordering mismatches you find

Write your findings to `AUDIT-REPORT.md` with:
- Each ordering issue found
- The file and line numbers involved
- What the correct order should be
- Why the current order is wrong

Important: Do NOT modify any source files. Only create AUDIT-REPORT.md.
