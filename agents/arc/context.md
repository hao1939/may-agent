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
- Design docs: `shared/may-agent-docs/design/` (the system's architecture)
- Core principles: `shared/may-agent-docs/design/core-principles.md`
- Common sense: `shared/common-sense.md`
- Session patterns: read via bun:sqlite readonly, e.g.
  `bun -e "const {Database}=require('bun:sqlite'); const db=new Database('.state/may.db',{readonly:true}); console.log(db.prepare('SELECT agent, status, COUNT(*) c FROM sessions GROUP BY agent, status').all())"`
- Metrics: same pattern with `SELECT * FROM metrics WHERE status='active'`
- Use `query_db` for read-only DB inspection.
- Agent configs: `agents/*/SOUL.md`, `agents/*/context.md`

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


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.
