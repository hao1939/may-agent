# System Prompt Simplification

## Current: 10 files, 36-52KB

```
SOUL.md (7-15KB) — 80% rules duplicated from common-sense.md, 20% identity
DOMAIN.md (2-8KB) — mix of rules + reference info
TOOLS.md (1-4KB) — redundant with tool schema descriptions
shared/LESSONS.md (4KB) — team rules
LESSONS.md (1-8KB) — agent rules
knowledge/INDEX.md (2-10KB) — references
shared/INDEX.md (3KB) — team knowledge
common-sense.md (9KB) — behavioral rules
[generated] Runtime env (0.3KB)
[generated] Available tools (0.1KB)
```

## Root cause

Not too many files — too much duplication. "Verify after write" appears in 11 files. Agents wrote rules to their SOUL.md that already existed in common-sense.md, and nobody cleaned up either copy.

## Proposed: 3 files, 10-15KB

### 1. `SOUL.md` (per-agent, ~2-4KB) — identity, role, and curated capabilities

Who you are + what makes you effective. Not generic rules — those are in common-sense.md. Contains:

- **Identity**: Who you are, your mission, how you differ from other agents (2-3 sentences)
- **Role boundaries**: What you do vs what other agents do (e.g., "Coach vs Optimizer")
- **Methodology**: Your critical workflows and how you do your work (e.g., coach's Learning Loop, optimizer's Improvement Loop, bob's Meta-Loop). Condensed to key steps, not full docs.
- **Curated skills**: The specific skills that matter for YOUR job, with trigger conditions. Not a link to the skills folder — the actual skill names and when to use them.
- **Agent-specific constraints**: Things that only apply to you (e.g., "coder: do not commit")

Example for optimizer:
```markdown
## Identity
You are Optimizer. You analyze agent performance and implement improvements.
You focus on structural fixes, not behavioral patches — make the wrong thing
impossible rather than telling agents to be careful.

## Role
You improve the system. Coach improves agents. You own: opBudget, compaction,
handler migration, prompt assembly, tool presets. Coach owns: behavioral
training, gym exercises, growth cycles. When you find a behavioral issue,
hand it to Coach. When Coach finds an infra issue, they hand it to you.

## Methodology
Improvement Loop: Analyze (query evaluations DB, max 10 sessions) → Identify
highest-impact fix → Implement (prefer structural > environmental > reductive
> behavioral) → Verify (gym test or measurement).

## Skills
- search-strategy-escalation: After 2 grep commands, STOP. Think. Target.
- idempotent-work-detection: Check if work is already done before starting.
- budget-before-act: Estimate turns needed, create deliverable skeletons early.
- progressive-work-persistence: Save intermediate results, don't lose progress.

## Constraints
- One fix per session. Don't stack multiple changes.
- Always measure before/after. No "I think this helped."
- Don't edit SOUL.md, common-sense.md, or heartbeat.md of other agents directly.
```

### 2. `common-sense.md` (shared, ~5-8KB) — behavioral rules

Already exists. Already contains the right content. Keep it.

Changes:
- **Deduplicate**: Remove rules that appear in agent SOUL.md files
- **Prune**: Remove rules enforced by tooling (system already blocks opBudget excess)
- **Gym-gated**: Changes must pass gym suite before taking effect (see below)

### 3. `knowledge/INDEX.md` (per-agent, not in system prompt) — references

Already exists. Stop loading into system prompt. Agent reads on-demand. SOUL.md tells the agent it exists.

### Files removed from system prompt

| File | Action |
|------|--------|
| DOMAIN.md | Key methodology → SOUL.md (condensed). Reference info → knowledge/ files. |
| TOOLS.md | Delete. Tool schema descriptions are sufficient. |
| shared/LESSONS.md | Proven lessons → common-sense.md. Delete file. |
| LESSONS.md (per-agent) | Proven → SOUL.md or common-sense.md. Delete file. |
| shared/INDEX.md | Don't load into prompt. |
| knowledge/INDEX.md | Don't load into prompt. |

### System prompt becomes

```
resolveSystemPrompt():
  1. SOUL.md (~2-4KB) — identity, role, methodology, curated skills, constraints
  2. common-sense.md (~5-8KB) — shared behavioral rules
  3. [generated] Available tools (~0.1KB)
  4. [generated] Runtime environment (~0.3KB)

Total: ~8-13KB (down from 36-52KB)
```

## Change management: gym as the gate

No human-approval bottleneck. The gym suite IS the approval mechanism.

### For common-sense.md changes:

```
Coach/Optimizer proposes change →
  Save current common-sense.md as backup →
  Apply change →
  Run gym suite (all scenarios, all agents) →
    Pass rates unchanged or improved? → Keep change. Log in changelog.
    Pass rates dropped? → Auto-revert. Log failure reason.
```

### For SOUL.md changes:

```
Coach proposes change to agent's SOUL.md →
  Save backup →
  Apply change →
  Run gym suite (that agent's scenarios specifically) →
    Pass? → Keep.
    Fail? → Revert.
```

### Per-agent gym scenarios

Each agent should have scenarios that test its specific concerns:

| Agent | Key scenarios |
|-------|--------------|
| coder | edit-precision, read-before-edit, abandoned-branch, phantom-fix |
| optimizer | search-strategy-escalation, idempotent-already-fixed, scope-creep-trap |
| coach | growth-cycle execution, convention verification |
| bob | synthesis quality, delegation-scope-boundary |
| tech-lead | multi-file workflow, tool-confusion |
| scout | research depth, early-exit efficiency |
| qa | code review accuracy, false positive rate |

### Daily digest shows prompt health

The daily digest includes:
- System prompt size per agent (track bloat)
- Gym pass rates (track quality)
- Rule changes in the last 24h (track what changed)

## Migration

### Phase 1: Baseline
1. Run full gym suite, record pass rates per agent per scenario
2. Log current system prompt size per agent
3. This is the "before" measurement

### Phase 2: Slim SOUL.md (biggest impact)
1. For each agent: extract identity, role, methodology, curated skills, constraints
2. Everything else → delete (if in common-sense.md) or move (if reference)
3. Target: 2-4KB per agent
4. Run gym suite, compare to baseline

### Phase 3: Stop loading extra files
1. Update resolveSystemPrompt() to load only SOUL.md + common-sense.md + generated
2. Run gym suite, compare to baseline

### Phase 4: Prune common-sense.md
1. Remove rules enforced by tooling
2. Remove rules that no gym scenario tests (they're unverified)
3. Run gym suite after each removal

### Phase 5: Gym gate automation
1. Build the gym-gated change workflow for common-sense.md
2. Build per-agent scenario suites
3. Integrate into coach's growth cycle

## Success criteria

- System prompt < 15KB for all agents (currently 36-52KB)
- Gym pass rates unchanged or improved after migration
- Every common-sense.md change goes through gym gate
- Daily digest tracks prompt size and gym scores
- Coach has clear, automated process for behavioral improvements
