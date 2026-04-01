# Task: Refine Skill

## Purpose
Evolve the Skill Library (`agents/shared/skills/`) based on evidence from evaluator reports. This implements the EvoSkill mechanism (arXiv:2603.02766) — improving the system by evolving its documentation, not its code or model weights.

## When to Run
- As a periodic task (weekly or after batches of new evaluations)
- When a specific failure pattern is identified in evaluation data

## Design Constraints
- **Markdown Only**: Evolve English prose, not code (unless necessary).
- **Atomic Changes**: One skill improvement per cycle.
- **Evidence-Based**: Do not change a skill unless you have specific failure transcripts proving the current version is flawed.

## Protocol

### Step 1: Gather Evidence
Read recent evaluations from `.state/evaluations/`.
```bash
# Count issue types from needs_improvement/fail evals
ls -t .state/evaluations/ | head -300 | while read f; do
  cat ".state/evaluations/$f" | python3 -c "
import sys,json; d=json.load(sys.stdin)
v=d.get('verdict','?')
if v in ('needs_improvement','fail'):
    for i in d.get('issues',d.get('critical_issues',[])):
        if i.startswith('['):
            print(i.split(']')[0]+']')
" 2>/dev/null; done | sort | uniq -c | sort -rn | head -20
```

### Step 2: Diagnose
Identify the **single most impactful failure mode** — the one that:
- Appears most frequently, AND/OR
- Causes the most severe failures (FAIL > needs_improvement)
- Affects multiple agents (systemic, not agent-specific)

### Step 3: Attribute to Skill
Map the failure mode to an existing skill (or identify a gap):

| Failure Mode | Likely Skill |
|---|---|
| SILENT_FAIL, NON_DELIVERY | `error-handling` |
| BLIND_OVERWRITE, DATA_LOSS, TRUNCATED_READ | `file-safety` |
| VERIFICATION_FAILURE, VERIFICATION_GAP | `error-handling` (verification pattern) or new skill |
| HALLUCINATION, TOOL_HALLUCINATION | `error-handling` or new `grounding` skill |
| TOOL_MISUSE, INVALID_TOOL_CALL | Agent-specific DOMAIN/LESSONS (not shared skill) |
| HARD_CONSTRAINT_VIOLATION | `error-handling` (hard constraints section) |

### Step 4: Evolve the Skill
- **If skill exists**: Read `agents/shared/skills/[name]/SKILL.md`. Make ONE of:
  - Add a constraint (## Anti-Patterns section)
  - Clarify an existing instruction
  - Add a concrete example from the failure evidence
- **If skill gap**: Create `agents/shared/skills/[name]/SKILL.md` with:
  - Frontmatter (name, description, version, tools)
  - Core principles (2-3)
  - Patterns (1-2 concrete workflows)
  - Anti-patterns (from the failure evidence)
  - Inviolable constraints

### Step 5: Verify
- Confirm the SKILL.md is valid markdown (no syntax errors)
- Confirm the change is atomic (one improvement only)
- Log the change in `agents/optimizer/workspace/journal.md`

## Output
After each cycle, record in journal:
```
## Refine-Skill: [date]
- **Failure mode**: [BRACKET_PREFIX] (N occurrences across M agents)
- **Skill**: agents/shared/skills/[name]/SKILL.md
- **Change**: [description of what was added/modified]
- **Evidence**: [session IDs or eval files that motivated the change]
```
