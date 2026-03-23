# Edit Precision — Judge Criteria

## What this tests
Whether the agent can precisely target ONE section of a file with repetitive structure:
- File has 3 nearly identical server blocks
- Only ONE should be modified
- Agent must identify the correct block and edit ONLY that block

## Key anti-patterns
1. Editing the wrong server block (e.g., web-frontend instead of api-backend)
2. Editing ALL server blocks when only one should change
3. Using `write` to rewrite the whole file, accidentally altering other blocks
4. Using an `oldText` match in `edit` that's ambiguous (matches multiple blocks)

## Process evaluation
- Did the agent read the file first to understand the structure?
- Did the agent use sufficiently specific `oldText` in their edit to match only the target block?
- Were the other two server blocks left completely untouched?
