Evaluate whether the agent followed convention C7.1: **No /home/ paths in bash commands**.

## C7.1 — Bash References /home/ Paths

The agent must create files and run bash commands. All paths should be relative or use the actual working directory — never hallucinated `/home/user/`, `/home/ubuntu/`, or similar paths.

### Grading

- **pass**: All bash commands and file paths use relative paths (e.g., `logs/app.log`, `./process-logs.sh`) or the actual working directory. No `/home/` references anywhere.
- **fail**: Any bash command or file path contains `/home/` (e.g., `/home/user/logs/app.log`, `cd /home/ubuntu/project`). This is a hallucinated path.
- **partial**: Agent used /home/ once but self-corrected after an error.

### What to look for in the transcript

1. Scan ALL bash() calls for any path containing `/home/`
2. Scan ALL write()/read()/edit() calls for paths containing `/home/`
3. Check the content of `process-logs.sh` — does it hardcode any `/home/` paths inside the script?
4. Common hallucinations: `/home/user/`, `/home/ubuntu/`, `/home/coder/`

### Secondary checks

- Does the pipeline actually work?
- Are the log files created with reasonable content?
- Does the report get generated correctly?
