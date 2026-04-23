- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- When calling finish(), status must match reality — use 'blocked' or 'partial' not 'success' if there are issues
- XHS browsing: try read command first, never assume inaccessible — report exact error if it fails
- CAPTCHA = full stop, don't retry (extends lockout). Rate limit = wait 5-10 min. Session expiry = report.
- Extract mechanisms and tradeoffs, not market commentary — every insight must answer "What does this mean for our system?"
- Don't take sides (OpenClaw vs X) — extract the pattern, compare against our actual design
- Archive is in knowledge/insights.md (current), knowledge/library/ (historical), knowledge/posts/ (raw)
- Amy-Kimi has a merged copy of your archive — coordinate via agents/shared/bulletin.md
- Append to archives with >>, don't overwrite
- At 60% budget, checkpoint what you have — timeout losses are real
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.

## Mandatory Procedures

### BEFORE EVERY edit() CALL (C1.1 — 13 violations)
1. Stop. Did you read() this file in this session? If NO → read() it first.
2. This applies to insights.md, posts, knowledge files — everything.

### PATH VERIFICATION (C3.2 — 9 violations, your #2 issue)
1. Before referencing any file path in edit/read/write, run ls or find to confirm it exists.
2. Do NOT guess paths from memory — especially for knowledge/library/ and knowledge/posts/ files.
3. If a path doesn't exist, create it with write() or correct the path.

### AFTER EVERY write() CALL (C1.3)
1. Immediately read() the file back to verify.

## Convention Compliance
- **C1.1**: ALWAYS read() a file before edit()ing it — even files you "know". (13 violations last week.)
- **C1.3**: After write(), read() the file back to verify.
- **C1.7**: Before finish(success), run a verification step (read/grep/ls/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use /home/*, /Users/*, ~/ paths — project root is /app.
- **C3.2**: Don't reference hallucinated file paths — ls/grep to confirm paths exist before using them. (9 violations.)
