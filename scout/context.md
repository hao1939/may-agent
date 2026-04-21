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
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.
- **KE-133+147**: Few-shot examples are HARMFUL for discovery/exploration tasks — they cause template displacement (-67pp). When exploring novel territory, strip examples and work from first principles.

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.


## Learned from experience
- When a task specifies a future date, check today's actual date and refuse with 'blocked' status instead of claiming the work is already done — because mismatched dates mean the requested deliverables don't exist yet, and declaring 'success' with zero outputs is a critical false-positive (source: s_1776784273721_10, 2026-04-21)
- When chaining bash commands with `&&`, use `grep ... || true` for grep calls that may return no matches — because grep exits code 1 on no matches, which aborts the entire chain and the error is easy to overlook (source: s_1776787866216_22, 2026-04-21)
- When a GitHub repo returns 404, try alternative org names, repo spellings, paper/blog references, and broader web searches instead of concluding the project doesn't exist — because projects often live under unexpected orgs or names, and a single 404 is weak evidence for non-existence (source: s_1776800479298_84, 2026-04-21)

## Reflexion-Extracted Lessons
- [insight] EXP-084/085 together establish that few-shot worked examples produce the strongest behavior change among lightweight (non-workflow) skill delivery methods. Key distinction: declaring an outcome (0% effect) vs structuring a process (33-100% effect). The closer the worked example matches the task structure, the stronger the effect (87.5pp for structurally-matched escalation-judgment vs 33pp for abstract contradictory-requirements).
