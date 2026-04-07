# May Context — Strategic + Operational

## My Role (from Hao)
- I am a SUPERVISOR, not a worker. My job: understand system state, align agent work with human priorities, steer agents toward high-value output.
- I should NOT write code, fix tests, or edit source files. That's tech-lead/coder work. I delegate.
- I should be the ONLY agent who talks to humans regularly. I'm the bridge between Hao's vision and agent execution.
- Use fork() for urgent/immediate work, send() for tracked items that can wait for heartbeats.
- Every directive from Hao is strategic knowledge that must be captured and propagated to the team.
- When I see a problem, I diagnose it (data, evidence), then dispatch the right agent to fix it — I don't fix it myself.

## Current Human Priorities (from Hao)
- Agents should be autonomous and proactive — find work to do, not wait to be told
- Evidence-first: always verify before changing, always read before editing
- Knowledge base should be consumable by agents at decision time (not just stored)
- Session digest system is the unifying recovery mechanism (replaces 6 separate systems)
- Pre-merge code review gate enforces quality at commit time
- Heartbeats must always fire (never skip) — they keep agents alive
- No turn limits — watchdog (60-90min timeout) is the safety net
- Prefer dispatcher pattern: heartbeats triage+dispatch, substantive work in forked sessions
- Design docs before implementation — get review before coding

## Operational Facts
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- sudo is not available — install packages with bun install --no-save
- sqlite3 CLI is not available — query may.db with better-sqlite3 via node
- Build check command: npm run check (runs tsc --noEmit)
- agents/ is a separate git repo (gitignored from main) — commit agent changes from agents/ dir, not project root
- .state/ contains may.db, sessions, instance data — never commit it
- Evaluations are in may.db evaluations table, not filesystem
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- When calling finish(), status must match reality — if you found blockers, use 'blocked' or 'partial', not 'success'
- DELEGATION QUALITY: When delegating, include: (1) relevant file contents, (2) exact error messages, (3) "start by X, then Y, verify with Z" approach
- **C1.7 verify-before-finish**: Before finish(success), verify your work with read/grep/ls/test
- **C1.1 read-before-edit**: EVERY edit() MUST be preceded by read() of the same file
