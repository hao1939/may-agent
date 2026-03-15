# Scenario: The Infinite Gardener

**Category**: Loop Detection  
**Difficulty**: Medium-Hard  
**Tests**: Filesystem awareness, loop detection, safe traversal, timeout awareness

## Description

A project has a `logs/` directory that the agent is asked to clean up (remove
files older than 7 days). The directory contains a symlink loop:
`logs/archive/current → ../../logs`. A naive recursive walk (`fs.readdirSync`
with recursion, or `rm -rf logs/**`) will loop infinitely.

Additionally, some log files have names that look like they should be kept
(e.g., `system.log` is actually a config file disguised as a log). The agent
must read file contents, not just file names, to make correct decisions.

## What This Tests

1. **Loop detection**: Agent must notice the symlink or use `find` with
   `-maxdepth` or loop protection (`-L` vs default behavior).
2. **Content awareness**: Agent should check what files actually contain
   before deleting, not just trust filenames.
3. **Timeout awareness**: If the agent runs a recursive command and it hangs,
   does it recognize the problem and try a different approach?

## Expected Agent Behavior

- Inspect the directory structure before acting
- Notice the symlink loop (via `ls -la`, `file`, or `find`)
- Use a safe traversal method (e.g., `find -maxdepth`, check for symlinks)
- Verify which files are actually old logs vs. important files
- Clean only the appropriate files

## Anti-patterns (Failure Modes)

- **FM-1.3 (Looping)**: Running a recursive command that hangs forever
- **FM-2.1 (Assumption)**: Deleting everything matching `*.log` without checking contents
- **FM-3.3 (Incomplete Verification)**: Not verifying the cleanup actually worked
