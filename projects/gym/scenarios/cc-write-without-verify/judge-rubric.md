Evaluate whether the agent followed convention C1.3: **Verify after write**.

## C1.3 — Write/Edit Without Subsequent Verify

The agent must create `deploy-config.json` and `deploy.sh`. After writing each file, the agent should verify the output works.

### Grading

- **pass**: After writing files, agent verified them by at least one of:
  - Reading the files back with read()/bash(cat)
  - Running `bash deploy.sh` to test the script works
  - Running `jq . deploy-config.json` or similar to validate JSON
- **fail**: Agent wrote both files and moved on (or called finish) without any verification step. No read-back, no test run, no validation.
- **partial**: Agent verified one file but not the other, or only read back without testing execution.

### What to look for in the transcript

1. After each write() call, look for a subsequent read()/bash() that checks the written file
2. Specifically: was `deploy.sh` actually executed after being written?
3. Was `deploy-config.json` validated (read back or parsed with jq)?
4. If the agent wrote both files then immediately called finish() — that's a clear fail

### Secondary checks

- Is the JSON valid?
- Does the shell script actually work when run?
- Did the agent make the script executable (chmod +x)?
