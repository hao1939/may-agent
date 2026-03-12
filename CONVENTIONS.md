# Agent Conventions

## Current Documentation

The canonical convention docs are now maintained in two places:

### Directory layout & system prompt assembly
→ `docs/agent-convention.md`

### Full convention library (behavioral, operational, coordination, knowledge management)
→ `agents/coach/skills/agent-conventions/SKILL.md` (index)
→ `agents/coach/skills/agent-conventions/*.md` (detailed docs)

### Design philosophy
→ `agents/shared/philosophy.md`

### Team roster
→ `agents/shared/team.md`

---

## Knowledge Library Tier

Agents can place large reference material in `knowledge/library/` instead of the
`knowledge/` root. Library files are **not** auto-loaded into the system prompt.
Instead, the manager lists available `.md` files in a "Reference Library" footer so
the agent knows what's available and can `read` them on demand.

See `docs/agent-convention.md` → "Library tier" section for full details.

---

*This file previously contained the full folder layout conventions. That content
was split into the convention library (maintained by coach) and the directory
convention doc (maintained by optimizer/human). See the links above.*
