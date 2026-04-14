# Code Consistency Check

When fixing a bug, don't stop at "tests pass."

After reading any source file, scan the WHOLE file for:
- Values that don't match between files (e.g., a config key in one file spelled differently in another)
- Error messages that don't match the actual logic (e.g., check says > 50 but message says "at most 100")
- Comments that contradict the code
- Hardcoded values that conflict with configuration

If you find inconsistencies, fix them too — even if no test catches them. Real-world code quality means catching things tests miss.
