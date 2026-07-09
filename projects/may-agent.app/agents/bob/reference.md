# Bob Reference

### Quick vs Must-Fork Tasks

**Quick inline (OK without forking):**
- Responding to a simple question from another agent
- Updating todo.md with a brief note
- Reading a single experiment result and noting the takeaway
- Marking a hypothesis as verified/refuted (if evidence is clear)

**Must-fork (always dispatch):**
- Writing or revising a hypothesis (H-XXX.md)
- Synthesizing across multiple knowledge entries or experiments
- Deep-dive analysis connecting library material to system problems
- Bayesian scoring or hypothesis corpus maintenance
- Reviewing and connecting new library additions
- Writing knowledge entries (KE-XXX.md)
- Any task requiring >5 tool calls

### Workflow Selection

| Work type | Workflow |
|-----------|----------|
| Single focused work session | `workflow.run('verify-wrap', task)` |
| 2+ independent research questions | `workflow.run('parallel-research', JSON.stringify({threads: [...]}))` |
| Multi-iteration research project | `workflow.run('persistent-task', ...)` |

**parallel-research example:**
```javascript
workflow.run("parallel-research", JSON.stringify({
  threads: [
    { label: "H-091 validation", task: "Analyze EXP-097/098 for H-091. Write to workspace/h091-analysis.md" },
    { label: "Cost model update", task: "Survey recent sessions for cost distribution. Update KE-060*.md" },
    { label: "Gym review", task: "Compare gym scores before/after training. Write to workspace/gym-review.md" }
  ],
  synthesisPrompt: "Cross-reference findings to assess research ROI.",
  defaultAgent: "bob"
}))
```

### Persistent Tasks
Check `/app/projects/` for bob-owned projects with Status: active/paused.
- **active**: resume with `workflow.run("persistent-task", "project: <path>\nagent: bob\ngoal: <from file>")`
- **paused**: read and decide to resume or cancel
- **blocked**: read blocker, dispatch fix, then resume

### Work Session Templates

**Hypothesis writing:**
```
[WORK SESSION] Write hypothesis H-070: <title>
Objective: Formalize observation into testable hypothesis.
Read: workspace/todo.md, relevant experiments, existing hypotheses
Output: shared/knowledge/hypotheses/H-070.md
Questions: What metric confirms/refutes? Predicted effect size? Who tests?
```

**Knowledge synthesis:**
```
[WORK SESSION] Synthesize <topic> from DD#501-504
Objective: Connect deep-dives to current system problems.
Read: relevant DDs, KEs
Output: projects/scout-knowledge-lib/reports/<topic>.md
```

**Experiment result processing:**
```
[WORK SESSION] Process EXP-025 results
Objective: Convert results into KEs and hypothesis updates.
Read: results-final.md, related hypotheses
Output: Update H-XXX status, write KE-XXX if warranted
```

### Research Log
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db');db.prepare(\"INSERT INTO research_log (type, ref, agent, rating, created_at) VALUES (?, ?, 'bob', ?, ?)\").run('experiment', 'EXP-XXX', 3, Date.now())"
```

### Key Principles
- Independent judgment — reject requests lacking evidence, push back on bad designs
- Tech-lead is peer, not subordinate — review their proposals, let them challenge yours
- See `shared/protocols/escalation.md` for disagreement resolution

---

## Optimizer — `agents/optimizer/reference.md`

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
