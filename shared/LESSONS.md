# Shared Lessons

These apply to all agents. Agent-specific lessons are in each agent's own LESSONS.md.

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Project root is `/app`. Use relative paths or `/app/...`. Never use `/home/`, `/Users/`, or `~/` — they don't exist.
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded into your system prompt. Don't re-read them.

## Universal Conventions (apply to ALL agents)

### 🔴 Promise-Deliver-Report (C40)
Every heartbeat/task MUST follow this 3-step pattern:
1. **PROMISE**: After reading heartbeat and todo, state numbered deliverables BEFORE doing any work
2. **DELIVER**: Execute each promised item. If blocked: "PIVOT: item N blocked because [reason], replacing with [alternative]"
3. **REPORT**: End with numbered results matching each promise (✅/❌)
- Promise count must equal report count. Every promise appears in the report.
- Anti-patterns: Starting work without stating deliverables. Ending without mapping to promises.

### Evidence for Every Claim — Claim-as-Record (C26)
Every substantive claim must cite the tool call or output that proves it:
- **Status reports**: Cite `agents.list()` output, not memory
- **Counts**: Cite `wc -l` or `grep -c` output, not estimates
- **File state**: Cite `grep` or `read()` output from THIS session
- **Comparisons ("old vs new")**: Cite BOTH values with sources
- **Distinguish observed vs. inferred**: "grep returned X" (observed) ≠ "I believe X" (inferred)
- Anti-patterns: "All tests pass" without running them. "File looks correct" without reading it. "No issues found" without searching.

### Handoff Protocol (C24)
- **Always use `agents.send()` for async cross-agent work.** Include artifact file paths in the task message.
- **Include testable expectations** — "Run `npm test`, verify 0 failures" not "review this"
- **Max 2-hop delegation depth** — if you delegate to X who delegates to Y, that's the limit
- **Verify receipt** — check request DB after sending to confirm acknowledgment

### Escalation Protocol — Never Silently Abandon (C23)
When you hit a blocker, follow the 4-tier ladder:
1. **Self-fix** — 2 retries with *different* approaches
2. **Peer consult** — `agents.call()` to a relevant teammate
3. **Supervisor report** — write to May's todo or use `agents.send()`
4. **Human escalation** — `[HUMAN-NEEDED]` tag
- Always include: what failed, what you tried, what you need, what's blocked
- Time-bound: if 3+ tool calls on the same issue fail, escalate immediately

### Resource Awareness — 3-3-3 Budget (C25)
- **3 reads max** before starting real work
- **3 retries max** on the same failing action
- **30% reserve** for output — don't spend entire session reading
- Prefer `grep`/offset reads over full-file reads
- Prefer `edit()` over `write()` for modifying existing files

### Progress Tracking for Multi-Step Tasks (C22)
- **Persist progress markers** for any task with 3+ steps
- **After each major step**: write checkpoint to workspace with what's done + what's next
- **Self-check**: If 5+ tool calls and no workspace writes, STOP and write a checkpoint NOW
- Anti-pattern: Entire analysis in transcript with no persistence
