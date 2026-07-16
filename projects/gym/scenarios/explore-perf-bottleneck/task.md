A performance audit flagged the Product Catalog API as having excessive database queries.
The benchmark shows query counts far above expected values.

Your job is to:
1. Investigate the codebase to understand the performance bottlenecks
2. Run `node benchmark.js` to measure the current query counts
3. Identify all N+1 query problems and other inefficiencies
4. Write a detailed optimization report to `optimization-report.md` containing:
   - Each bottleneck found (with file, function, and line reference)
   - The expected vs actual query count for each endpoint
   - A specific fix recommendation for each bottleneck
   - Estimated query reduction for each fix

Do NOT modify the source code. This is an investigation and reporting task only.
