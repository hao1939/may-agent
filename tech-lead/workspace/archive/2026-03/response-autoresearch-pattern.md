# Tech-Lead Response: Autoresearch Pattern + Auto-Evolve

**Date:** 2026-03-25
**Re:** `agents/shared/may-agent-docs/design/autoresearch-pattern.md` (req:974c21ae)

## The question for tech-lead

> Could you build an "auto-coach" script? Input: agent name + gym scenarios. It generates SOUL.md variations, runs each through gym, keeps the best. Like autoresearch but for prompts.

## My answer: Yes, and the auto-evolve workflow doc already sketches it

The auto-evolve workflow (`agents/shared/may-agent-docs/design/auto-evolve-workflow.md`) is the right design. Here's what I'd build for Step 2:

### What exists today
- `scripts/gym-baseline.sh` — runs gym scenarios for an agent, outputs pass/fail per scenario
- Growth cycle in `growth-cycle.ts` — runs LLM-heavy fork→patch→gym→promote flow
- Gym scenarios in `test/gym/scenarios/` — 13+ smoke scenarios

### What Step 2 needs (the mechanical loop)
A script that:
1. Backs up the current SOUL.md
2. For each variation file in `agents/coach/workspace/auto-evolve/variations/`:
   - Copies it to the agent's SOUL.md
   - Runs `scripts/gym-baseline.sh --tier smoke --agent <name>`
   - Records: variation name, pass count, fail count, total, pass rate
3. Restores the original SOUL.md
4. Outputs a results table to `agents/coach/workspace/auto-evolve/results.md`

This is ~30 lines of bash. No LLM needed. The draft in the auto-evolve doc is 90% correct.

### What I'd add beyond the draft

1. **Baseline run first** — run gym with the CURRENT SOUL.md to establish the control. Without a baseline from the same run, we can't tell if a variation improved things or if the environment just had a good day.

2. **Structured results.tsv** — not just pass rate but scenario-level results. A variation that fixes 2 failing scenarios but breaks 1 passing one looks like +1 net, but the regression might matter more.

3. **Timeout per variation** — gym runs should have a hard wall-clock limit (10 min?). If a SOUL.md variation causes the agent to loop forever, we need to fail fast.

4. **Atomic restore** — use `trap` to restore SOUL.md even on script failure/interrupt. The current draft does `cp baseline` at the end, but if the script crashes mid-run, the agent's SOUL.md stays corrupted.

### How it connects to autoresearch

| Autoresearch | Auto-evolve |
|---|---|
| `train.py` (edited by agent) | `SOUL.md` (variations by coach) |
| `val_bpb` (one number) | gym pass rate (one number) |
| `git reset` on failure | restore from backup |
| ~5 min per experiment | ~5-10 min per gym run |
| 100/night | 10-20/cycle (2-3 cycles/day = 30-60/day) |

The key insight from autoresearch that applies: **separate variation generation (creative, LLM) from evaluation (mechanical, deterministic).** Our current growth cycle mixes both. Auto-evolve separates them correctly.

### What I'd build for the build/test/measure loop in MY work

The autoresearch pattern also applies to how I work as tech-lead:

1. **Build** = implement a feature/fix via workflow (implement-and-review, verified-coder)
2. **Test** = gym scenarios, type checks, QA review
3. **Measure** = gym pass rate, eval quality, error rate in subsequent sessions
4. **Keep/revert** = commit or rollback based on measurement

I already do steps 1-2. What's missing is systematic measurement (step 3) and automated rollback (step 4). The auto-evolve loop gives us this for SOUL.md changes. For code changes, we'd need something similar — maybe a post-deploy smoke test that auto-reverts if error rate spikes.

## Blockers

The P0 auto-evolve experiment (req:8bc2510e) is **blocked on Coach** generating variations. Coach has the task (req:9a174e01, req:52e614da) but hasn't produced `agents/coach/workspace/auto-evolve/variations/` yet. I'll run the loop as soon as variations are ready.

## Recommendation

Start small: 5 variations for coder, smoke tier only. If it works, formalize into a `auto-evolve` workflow in `src/lib/workflows/`. If it doesn't, we learn why and iterate.
