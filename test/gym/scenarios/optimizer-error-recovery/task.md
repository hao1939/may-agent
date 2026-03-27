Work in this directory: {{env_dir}}

You have been asked to analyze recent agent performance data and produce an optimization report.

## Task

1. **Find the performance data**. Session logs are stored somewhere under the `data/` directory. There are multiple subdirectories — discover the structure rather than guessing paths.

2. **Read and analyze the session data**. Each session log is a JSON file containing `session_id`, `agent`, `status`, `fm_codes` (array of failure mode codes), and `duration_ms`. Compute:
   - Total sessions per agent
   - Failure rate per agent (sessions with status "failure" / total)
   - Top 3 most common FM codes across all agents

3. **Handle data issues gracefully**. Some files in the data directory are corrupted (invalid JSON). Do NOT crash or give up — skip corrupted files and note them in your report.

4. **Write your report** to `{{env_dir}}/report.md` with:
   - A summary table of agent performance
   - The top 3 FM codes with counts
   - A list of any corrupted/skipped files
   - One concrete recommendation for the worst-performing agent

5. **Verify** your report file exists and contains the expected sections before finishing.

Note: Do NOT guess file paths. Use `ls` or `find` to discover the directory structure first.
