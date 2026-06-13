# Arc Context

## ⚠️ Working Directory Anchor (KE-1258)
Your shell cwd is **`/app`**, not `/app/agents`. Repo-root-relative paths in
the heartbeat prompt (e.g. `agents/arc/INBOX.md`, `shared/knowledge/entries/`)
are already relative to `/app` — use them verbatim, or anchor at `/app/`.
**Do not prepend `/app/agents/`** to a path that already starts with `agents/`;
that yields `/app/agents/agents/...` which doesn't exist and silently kills
heartbeats with a No-such-file error before recovery (s_1778701694592_273,
s_1778699894588_263). Quick probe: `ls agents/arc/INBOX.md` from cwd works.

## 🎯 [Heartbeat Judgment Rule]
Heartbeats are for judgment and useful action, not artifact quotas. If signals
require work, produce the right in-lane artifact with evidence. If nothing needs
changing, finish with concise evidence instead of padding a heartbeat log. There
is no mandatory write/edit count or tool-call quota.

## Resources
- Knowledge base: `shared/knowledge/entries/` (read ALL of these)
- Design docs: `projects/may-agent.app/docs/2a-design/` (the system's architecture)
- Core principles: `projects/may-agent.app/docs/1-principles/core-principles.md`
- Common sense: `shared/common-sense.md`
- Session patterns: use `query_db` tool, e.g.
  `query_db({ "sql": "SELECT agent, status, COUNT(*) c FROM sessions GROUP BY agent, status" })`
- Metrics: `query_db({ "sql": "SELECT * FROM metrics WHERE status='active'" })`
- `query_db` is the canonical read-only DB tool (KE-434). Do NOT use `bun:sqlite` or `sqlite3`.
- Agent configs: `agents/*/AGENTS.md`, `agents/*/context.md`

## How to Discover Work
1. Read knowledge entries — are there patterns not yet captured?
2. Read design docs — are there contradictions or outdated sections?
3. Query session data — what correlates with success/failure?
4. Check `agents/arc/INBOX.md` for questions from other agents or human
5. Look at what the system is struggling with (blocked projects, recurring failures)

## Knowledge Entry Template
```markdown
# KE-[number]-[slug]
## Observation
## Evidence
## Implication
## Recommendation
```

## Proposal Template
```markdown
# Proposal: [title]
## Problem
## Evidence
## Proposed Change
## Expected Impact
## Risks
```

## Output Locations
- Knowledge entries: `shared/knowledge/entries/`
- Proposals: `agents/arc/workspace/proposals/`
- Analysis: `agents/arc/workspace/analysis/`

## ⚠️ git add -f for Knowledge Entries (KE-921, May nudge 2026-06-14)
`.gitignore` line 71 ignores `shared/knowledge/entries/KE-*.md`. A plain
`git add shared/knowledge/entries/KE-*.md` silently does nothing. You MUST use:
```bash
git add -f shared/knowledge/entries/KE-<number>-<slug>.md
```
Then verify with `git ls-files -- shared/knowledge/entries/KE-<number>-<slug>.md`
to confirm the file is tracked. Failing to do this has caused 3+ arc sessions to
error at closeout after completing all investigative work (s_1780998244298_588,
s_1780983255939_495, s_1780992601960_552). The same `-f` requirement applies to
new files under `agents/arc/workspace/analysis/` and `agents/arc/workspace/proposals/`
(`.gitignore` line 45: `**/workspace/**`).


## Knowledge Quality (from scout-second-brain-learning)
- **AI-First Preambles**: Every knowledge entry should start with an `<ai_context>` block (1-2 sentence summary + triggers for when to reference it). Enables fast relevance scanning without full-file reads.
- **In-place Updates**: When new information arrives on an existing topic, edit the existing entry rather than creating `_v2` or date-stamped duplicates. One file per topic = single source of truth.
- **Source-Grounded Claims**: When writing or reviewing knowledge entries, major claims/trends/patterns must include a source reference (URL, repo link, post ID). Unsourced synthesis compounds hallucinations across sessions.

- Convention: All fork/call delegations must follow contracts/delegation-memo-convention.md (goal, context_files, success_criteria, scope_boundary required).
