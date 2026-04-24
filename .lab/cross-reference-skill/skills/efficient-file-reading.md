# Skill: Efficient File Reading

## Trigger
Before ANY `read()` call on a file you haven't read before.

## Protocol
1. **ESTIMATE SIZE** — If you don't know the file size, check first: `bash("wc -l <file>")` or `bash("ls -la <file>")`
2. **SEARCH FIRST** — For files over 100 lines, use `bash("grep -n '<pattern>' <file>")` or `bash("rg '<pattern>' <file>")` to find relevant line numbers BEFORE reading
3. **READ TARGETED** — Use `read(path, {offset: <line>, limit: 50})` to read only the relevant section, NOT the entire file
4. **NEVER FULL-READ LARGE FILES** — If a file is over 200 lines, you MUST use grep/rg first, then targeted read. Full reads of large files waste context.

## Anti-Patterns (NEVER DO)
- ❌ `read("large-file.ts")` without offset/limit on files >100 lines
- ❌ Reading an entire file when you only need one function or section
- ❌ Skipping the search step and reading from line 1

## Correct Pattern
```
# Step 1: Find what you need
bash("grep -n 'functionName' src/big-file.ts")
# Step 2: Read targeted section  
read("src/big-file.ts", {offset: 142, limit: 30})
```

## Assertion
Every `read()` call on a file >100 lines MUST use offset/limit parameters.
