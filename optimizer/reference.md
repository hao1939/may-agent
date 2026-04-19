# Optimizer Reference

### Quick vs Must-Fork Tasks

**Quick inline (OK without forking):**
- Updating todo.md with a brief note
- Acknowledging a dispatch
- Checking a single metric from checkpoint data

**Must-fork (always dispatch):**
- Multi-query DB analysis (Session Archaeology)
- Tool gap analysis requiring file reads
- Skill/technique scouting with multiple file reads
- Workflow health checks with multiple queries
- ANY building, coding, or experimentation
- Reading experiment results and writing findings

### Exploration Mode Details

**Mode A: Session Archaeology** — Dig into recent sessions, find pain points, identify automation opportunities. Query session DB for patterns: high-op sessions, error clusters, repeated tool sequences.

**Mode B: Tool Gap Analysis** — Find multi-step bash patterns that should be tools. Look for repeated command sequences across agents that could be consolidated.

**Mode C: Skill & Technique Scouting** — Review scout findings (deep-dives, papers), compare high/low performing sessions, identify techniques worth adopting.

**Mode D: Workflow Health** — Check workflow adoption, success rates, overhead. Use `workflow.run('investigate-and-fix', task)` — don't just write a finding, fix it.

### Workflow Selection

| Work type | Workflow |
|-----------|----------|
| Investigation → fix | `workflow.run('investigate-and-fix', task)` |
| Building a tool/skill | `workflow.run('implement-and-verify', task)` |
| Analysis / finding | `workflow.run('verify-wrap', task)` |
| Multi-question analysis | `workflow.run('parallel-research', JSON.stringify({...}))` |

### Finding Conversion — Dispatch, Don't Just Log

**Problem**: Only ~7% of findings become deployed fixes.

**Rule**: When analysis produces a finding with a concrete fix, **fork a tech-lead or coder session with the fix details BEFORE the cycle ends.** Don't just write the finding — dispatch it.

Template:
```
If finding has a concrete fix:
  → agents.fork('tech-lead', `[FIX] <title>\nFinding: <what's wrong>\nFile: <path>\nFix: <exact change>\nEvidence: <how to verify>`)
  → Note in todo.md: "Dispatched: <finding> → tech-lead (<date>)"
```

### Cross-Cycle Dispatch
```
agents.message({ agent: "tech-lead", message: "Finding: [summary]. Fix: [action]. Files: [paths]. Evidence: [what you measured]." })
```
- Every dispatch must be concrete
- Don't use for things fixable in <3 ops
- For system-scope changes, route through May

### Rules for Building (in forked sessions)
- Always measure before AND after — no baseline = no evidence
- One improvement per session — don't stack changes
- Write results to knowledge base: experiments/ for experiments, entries/ for findings

### Monthly Code Hygiene
If >30 days since last cleanup (`git log --oneline --grep="code cleanup" -1`), flag a code hygiene audit.
