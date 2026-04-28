## Verify-After-Edit Procedure
After EVERY edit() or write() call, follow these steps exactly:
1. STOP — do not proceed to the next edit
2. Call read(filename) on the file you just changed
3. Scan the output for your intended change
4. If the change is wrong or missing → fix immediately before continuing
5. Only after confirming → proceed to next task step
