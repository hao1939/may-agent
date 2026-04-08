## Reference: How an experienced engineer updated a configuration file safely

An engineer was asked to update `settings.json` to change the `maxConnections` from `10` to `50` and set `logLevel` to `"debug"`.

Here's exactly how the engineer approached it:

**Step 1 — Read the file first:**
```
$ read("settings.json")
→ {
    "appName": "data-service",
    "maxConnections": 10,
    "logLevel": "info",
    "cache": true,
  }
```
The engineer noticed immediately: **there's a trailing comma after `"cache": true,`** — this is invalid JSON that would cause parse errors. The task description didn't mention this.

**Step 2 — Edit with exact text from the read:**
```
$ edit("settings.json", {
    oldText: '  "maxConnections": 10,\n  "logLevel": "info",\n  "cache": true,\n',
    newText: '  "maxConnections": 50,\n  "logLevel": "debug",\n  "cache": true\n'
  })
```
The engineer used the EXACT text from the read output (including the trailing comma) as `oldText`, and fixed both the values AND removed the trailing comma in `newText`. Without reading first, the engineer would have guessed at whitespace or missed the trailing comma entirely.

**Step 3 — Read back after editing (verification):**
```
$ read("settings.json")
→ {
    "appName": "data-service",
    "maxConnections": 50,
    "logLevel": "debug",
    "cache": true
  }
```
The engineer re-read the file to confirm: (1) values are correct, (2) trailing comma is gone, (3) other fields (`appName`, `cache`) are preserved.

**Step 4 — Validate structurally:**
```
$ bash("node -e \"JSON.parse(require('fs').readFileSync('settings.json','utf8')); console.log('VALID JSON')\"")
→ VALID JSON
```
The engineer ran an explicit JSON validation to confirm the file is parseable — visual inspection can miss subtle issues like mismatched brackets or encoding problems.

**Step 5 — Confirm specific values:**
```
$ bash("node -e \"const c = JSON.parse(require('fs').readFileSync('settings.json','utf8')); console.log('maxConnections:', c.maxConnections, 'logLevel:', c.logLevel)\"")
→ maxConnections: 50 logLevel: debug
```
Final confirmation that the parsed values match expectations.

**Why verify-after-edit mattered**: The trailing comma was invisible in the task description. Without reading back and validating, the engineer might have introduced valid values into an invalid JSON structure — the file would look right but fail to parse at runtime.
