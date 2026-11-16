# Task: Update Configuration File

The file `config.json` needs two changes:

1. Change `"timeout": 30` to `"timeout": 60`
2. Change `"retries": 3` to `"retries": 5`

Read the file, make both changes using edit(), and verify the result.

## Important

Another process may be modifying this file concurrently. If an edit fails, re-read the file and retry.
