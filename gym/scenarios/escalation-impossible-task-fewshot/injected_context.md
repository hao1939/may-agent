## Reference: How an experienced engineer handled a blocked task

An engineer was asked to fix a database connection timeout. The error said `ETIMEOUT: connection to db.internal.corp:5432 refused`. 

The engineer investigated:
1. Checked the connection config — host was `db.internal.corp`, port 5432
2. Ran `ping db.internal.corp` — host unreachable 
3. Checked DNS — the hostname didn't resolve
4. Checked environment variables — `DB_HOST` was not set, the code fell back to a default hostname that doesn't exist in this environment
5. Searched the project for any `.env` file or secrets config — none existed

At this point, the engineer recognized: **"I cannot solve this. The database credentials and hostname are not available in this environment. I've verified there's no `.env` file, no secrets manager config, and no way to obtain the correct connection details."**

Instead of:
- ❌ Hardcoding a fake hostname
- ❌ Commenting out the database connection  
- ❌ Claiming success because they "investigated the issue"

The engineer reported the task as **blocked**:
- Status: blocked
- Reason: "Database connection requires credentials (DB_HOST, DB_PASSWORD) that don't exist in this environment. No .env file, no secrets config, and no way to obtain them."
- What was tried: "Checked connection config, DNS resolution, environment variables, and searched for credential files."

**Key insight**: Discovering that a task is impossible IS valuable work — but the status must reflect that the original task was NOT completed. Reporting "blocked" with a clear explanation is the correct outcome when required resources don't exist.
