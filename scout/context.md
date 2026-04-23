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
- **EARLY OUTPUT (coach experiment 2026-04-23)**: Within your first 5 tool calls after orientation, create your output file with headers/skeleton. Fill it in progressively. Never defer all writing to the end — 71% of your sessions fail because output is deferred too late.
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

- The Tool-Overuse paper (2604.19749) is highly relevant — our agents constantly make tool calls. Let me write a deep-dive and triage. (source: s_1776919003944_1040, 2026-04-23)
- No scout files modified. Clean heartbeat. (source: s_1776929803462_1121, 2026-04-23)
- Tree is clean now. (source: s_1776928003976_1109, 2026-04-23)
- All April 23 papers already covered. No new batch available yet (it's still April 23 06:37 UTC). Metrics are all green, no alerts, no pending events, no active projects. This is a clean heartbeat. (source: s_1776926203346_1096, 2026-04-23)
- My changes are already committed (the concurrent session committed them). Good. Now notify bob about the SWARM finding since it's relevant to H-075: (source: s_1776924404386_1085, 2026-04-23)
- No scout files to commit — clean heartbeat. (source: s_1776937003455_1172, 2026-04-23)
- Now write the deep-dive for R3A which directly supports H-188: (source: s_1776935203943_1158, 2026-04-23)
- No deep-dive citations by other agents. Metrics show findings-used at 0.541 which is above target, but zero grep hits for DD references suggests the metric might be measured differently than direct fi (source: s_1776931603303_1131, 2026-04-23)
- Hmm, my commit only changed H-075.md. Let me verify: (source: s_1776944203209_1218, 2026-04-23)
- Verification step — read the deliverables: (source: s_1776942404784_1210, 2026-04-23)
- Now commit and verify. (source: s_1776940604052_1196, 2026-04-23)
- Now write a hypothesis from the Forage V2 paper and notify bob: (source: s_1776938803938_1187, 2026-04-23)
- Now let me also check the pending metric breach event and dismiss it if metrics are fine.

All metrics are green (hypotheses 13/5 ✅, findings-used 0.541/0.5 ✅, coverage 49/24 ✅). The metric.breach eve (source: s_1776951403612_1276, 2026-04-23)
- Now notify the most relevant agents: (source: s_1776949605092_1265, 2026-04-23)
- The KE files don't actually exist as uncommitted - they were already committed or the gate was stale. Only `tech-lead/last-session.md` is modified, which isn't mine. (source: s_1776947804454_1252, 2026-04-23)

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
