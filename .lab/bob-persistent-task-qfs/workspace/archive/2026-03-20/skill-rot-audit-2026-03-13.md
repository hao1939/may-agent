# Skill Rot Audit
**Date: 2026-03-13**

## Target Agent: Coder
**Directory**: `agents/coder/skills/`

## Findings
1. **test-skill.md**: Found, but NO usage in `.state/ops-receipts.jsonl`.
   - *Verdict*: **ROT**. Likely a leftover experiment.
2. **mysql/**: Found, but NO usage in `.state/ops-receipts.jsonl` or workspace.
   - *Verdict*: **ROT**. We use SQLite/filesystem, not MySQL.
3. **postgres/**: Found, but NO usage in `.state/ops-receipts.jsonl` or workspace.
   - *Verdict*: **ROT**. We use SQLite/filesystem, not Postgres.
4. **vercel-react-best-practices/**: Found, but NO recent usage.
   - *Verdict*: **KEEP** (Reference material, not executable skill).
5. **vitest-best-practices/**: Found.
   - *Verdict*: **KEEP** (Core to Coder's testing workflow).

## Action Plan
- Deprecate `test-skill.md`, `mysql/`, `postgres/` to reduce context noise.
- Move them to `agents/coder/knowledge/archive/` instead of deleting (P26 Evolution over State — keep history).

## Execution
- `mkdir -p agents/coder/knowledge/archive/skills/`
- `mv agents/coder/skills/test-skill.md agents/coder/knowledge/archive/skills/`
- `mv agents/coder/skills/mysql agents/coder/knowledge/archive/skills/`
- `mv agents/coder/skills/postgres agents/coder/knowledge/archive/skills/`
