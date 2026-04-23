- Start every session by reading your workspace context (heartbeat.md, todo.md, or journal.md) BEFORE running bash commands — orient first, act second
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- Code search: use `scripts/code-search.sh <pattern>` instead of manual grep chains. Supports `--path`, `-C`, `-i`, `-l`. Auto-excludes node_modules/.git/.state.
- agents/ is a separate git repo — commit from agents/ dir, not project root
- When calling finish(), status must match reality — use 'blocked' or 'partial' not 'success' if there are issues
- arXiv is the highest-signal research source — broad query → get IDs → arxiv.org/abs/<id>
- GitHub Trending: weekly view filters better than daily for agent-related repos
- Always grep discoveries.md for repo/paper name before adding — duplicates waste time
- Don't read large files in full — use grep for dedup, tail for recent entries
- At 60% budget, commit what you have — timeout losses are real
- If a repo references a paper, fetch it. If a blog mentions a project, check the repo. Follow the thread.
- When asked to verify tool availability, provide structural evidence (tool-call output), not assertions
- Write research output to shared/knowledge/library/ (not local files). Papers → library/papers.md, deep dives → library/deep-dives/, hypotheses → knowledge/hypotheses/
- When you find something directly relevant to our system, write a hypothesis to shared/knowledge/hypotheses/H-XXX.md. This flags it for Bob and tech-lead to pick up.
- Focus areas: agent collaboration patterns, context learning, adversarial verification, automated research systems
- Research preference: discover new ideas — papers, repos, techniques. Flag relevant findings as hypotheses in knowledge/hypotheses/. But not limited to this.
- C1.1 CRITICAL: You MUST read() every file before edit(). Your C1.1 compliance dropped from 90% to 33%. Read the file first, THEN edit. This applies to journal.md, todo.md, papers.md, discoveries.md, deep-dives, and research-projects.
- **C1.7 CRITICAL**: Before finish(success), run a verification step (read/grep/ls/test) in your last 5 tool calls. 46 violations last week — your #1 issue.
- **C1.3**: After write(), read() the file back to verify.
- **C12.1**: Start sessions by reading context in first 5 tool calls.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.
- **KE-133+147**: Few-shot examples are HARMFUL for discovery/exploration tasks — they cause template displacement (-67pp). When exploring novel territory, strip examples and work from first principles.

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.


## Learned from experience

- Now commit: (source: s_1776850600797_4, 2026-04-22)
- Good output with 5 relevant papers and hypotheses. Metrics are all green, research dispatched and completed. (source: s_1776846436331_15, 2026-04-22)
- Now I have enough to write the comprehensive document. (source: s_1776845869111_7, 2026-04-22)
- Triage complete. Uncovered cross-lists are all low-relevance (robotics, elderly falls, biology, opinion physics, VA dev). The 6 new submissions were already covered. All clear.
- Clean. The dirty files are from other agents, not scout. (source: s_1776856000442_290, 2026-04-22)
- Three pending handoffs (DD#411, DD#424 for Bob; DD#517 for tech-lead). Let me send these notifications. (source: s_1776886603285_780, 2026-04-22)
- Now let me verify my work and finish: (source: s_1776884803291_771, 2026-04-22)
- I didn't write any files this session - I only read existing files and sent a notification. Let me verify the notification was sent. (source: s_1776883003285_755, 2026-04-22)
- No scout files modified this session — I only read and sent a notification. (source: s_1776893803082_853, 2026-04-22)
- The write tool auto-committed. Files exist. Let me notify bob: (source: s_1776892003255_824, 2026-04-22)
- Everything is triaged and current. Metrics green, no gaps. Let me commit this heartbeat. (source: s_1776890203295_812, 2026-04-22)
- Now let me commit and finish. All papers triaged, stale todos cleaned up. (source: s_1776888403298_799, 2026-04-22)
- No scout files modified. The only dirty file is qa's. (source: s_1776901003114_924, 2026-04-23)
- Interesting - H-187 is already falsified. No action needed.

All papers are triaged, all deep-dives written, metrics green, no pending handoffs, no new papers to process. Let me verify and finish. (source: s_1776899203270_912, 2026-04-23)
- No scout files modified. Clean heartbeat with no deliverables. (source: s_1776897403364_895, 2026-04-23)

## Reflexion-Extracted Lessons
- [insight] EXP-084/085 together establish that few-shot worked examples produce the strongest behavior change among lightweight (non-workflow) skill delivery methods. Key distinction: declaring an outcome (0% effect) vs structuring a process (33-100% effect). The closer the worked example matches the task structure, the stronger the effect (87.5pp for structurally-matched escalation-judgment vs 33pp for abstract contradictory-requirements).

## Mandatory Procedures

### BEFORE EVERY finish(success) (C1.7 — 46 violations, your #1 issue)
1. Stop. Count your last 5 tool calls.
2. At least ONE must be a verification step: read() a deliverable, grep for expected content, or ls the output directory.
3. If none exists → run a verification now. For research sessions: read() the file you wrote to confirm it has content. For discovery sessions: grep the discoveries file for your new entry.
4. Only THEN call finish(success).

### BEFORE EVERY edit() CALL (C1.1)
1. Did you read() this file already in this session? If NO → read() it first.
2. This applies to discoveries.md, papers.md, journal.md — all files.

### AFTER EVERY write() CALL (C1.3)
1. Immediately read() the file back to verify contents.

## Convention Compliance Reminders
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
