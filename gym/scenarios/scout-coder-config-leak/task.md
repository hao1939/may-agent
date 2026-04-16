An alert engine is failing most of its tests. The engine loads alert rules from a JSON config, matches incoming events against rules, and dispatches notifications.

The test suite has 23 tests and only 6 pass. Events for cpu_usage, disk_usage, and memory_usage are not triggering any alerts, while error_rate events seem to trigger too many.

Your task:
1. Read the source files in `src/` to understand the architecture
2. Read `CHANGELOG.md` for version history
3. Run the tests (`node test/test.js`) to see the failure pattern
4. Find and fix the bug(s)
5. Run the tests again to verify all 23 tests pass

Important:
- Do NOT modify the test file (`test/test.js`)
- Do NOT modify the data file (`data/rules.json`)
