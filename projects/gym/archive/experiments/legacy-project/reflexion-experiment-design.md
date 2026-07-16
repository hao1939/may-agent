# Reflexion Gym Experiment Design

## Status
- **M1** ✅ Core lessons module (`lessons.ts` + `lessons-hooks.ts` + tests)
- **M2** ⏸️ BLOCKED — `manager.ts` not in this repo (hooks ready in `lessons-hooks.ts`)
- **M3** ⏸️ BLOCKED — same dependency as M2
- **M4** 🔄 Gym experiments designed and ready to run
- **M5** ⬜ Results doc (after M4 execution)

## Experiment: Lesson Injection Impact

### Hypothesis
Pre-seeded lessons (simulating what `retrieveLessons()` would inject) improve agent behavioral metrics on gym scenarios.

### Scenarios

| Pair | Baseline | Treatment | Key Behavioral Check |
|------|----------|-----------|---------------------|
| npx-recovery | `reflexion-npx-recovery-baseline` | `reflexion-npx-recovery-treatment` | `npx-avoided` — agent uses `node_modules/.bin/` instead of `npx` |
| read-before-edit | `reflexion-read-before-edit-baseline` | `reflexion-read-before-edit-treatment` | `read-before-edit` — agent reads file before editing |

### Treatment Condition
Treatment scenarios use `injected_context` in `scenario.json` to prepend lessons formatted as `## Lessons from Experience` — matching the exact output format of `retrieveLessons()` from `lessons.ts`.

### Metrics
- **Pass rate**: % of runs where overall scenario passes
- **Behavioral rate**: % of runs where the specific behavioral check passes
- **Delta**: Treatment rate − Baseline rate (positive = lessons helped)

### Running
```bash
# Single run (stub mode, verifies infrastructure)
node projects/gym/experiments/reflexion-experiment.js

# With real agent (N=5 per arm)
node projects/gym/experiments/reflexion-experiment.js --runs 5

# With specific adapter
node projects/gym/experiments/reflexion-experiment.js --runs 3 --adapter generic
```

### Integration with lessons.ts
The `lessons-context.md` files in treatment scenarios contain lessons formatted identically to `retrieveLessons()` output. This validates the end-to-end pipeline design:
1. Lessons get extracted via `extractLessons()` → stored in JSONL
2. Lessons get retrieved via `retrieveLessons()` → formatted as markdown
3. Formatted lessons get injected into session context → agent behavior improves

The gym experiment tests step 3 in isolation with hand-crafted lessons matching the production format.

## M2/M3 Blocker Details
`lessons-hooks.ts` provides:
- `onSessionFinish(event)` — ready to call from the session completion handler
- `getLessonsContext(agent, task)` — ready to call from `buildSessionContext()`

These hooks need to be wired into `manager.ts` or equivalent session management code, which lives in the platform/infrastructure layer outside this repository. The hooks are non-throwing and safe to integrate.
