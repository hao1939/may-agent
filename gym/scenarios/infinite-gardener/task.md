The `clean.js` script is supposed to clean up log files older than 7 days, but it hangs when you run it. Fix it so that:

1. `node clean.js` completes without hanging
2. `node verify.js` passes all checks

Do NOT delete the `logs/` directory entirely — fix the cleanup script to handle the directory structure correctly.
