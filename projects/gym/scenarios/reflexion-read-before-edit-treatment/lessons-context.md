## Lessons from Experience

- [fix] Always read a file before editing it. The edit() tool requires exact text matching — if you guess the content wrong, the edit fails and wastes a tool call.
- [pattern] For bug fixes: read the file first, understand the current code, then make a targeted edit. Never edit blind.
- [fix] After making a fix, always run the test to verify. Don't assume your fix is correct — verify with evidence.
