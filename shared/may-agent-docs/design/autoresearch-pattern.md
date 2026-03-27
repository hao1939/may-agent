# Autoresearch Pattern — Application to Agent Evolution

**Status: Discussion — need perspectives from may, bob, tech-lead, coach, optimizer**

## What Karpathy's autoresearch does

One loop, running forever:
1. Modify `train.py` (the one editable file)
2. Run experiment (5 min, single GPU)
3. Measure result: `val_bpb` (one number)
4. If improved → keep commit. If worse → `git reset`.
5. Repeat. ~100 experiments overnight on one H100.

Key design: `program.md` (strategy) is HUMAN-WRITTEN and NEVER modified by the agent. `train.py` (implementation) is the ONLY thing the agent changes. The human is the "org designer" — the agent is the tireless researcher.

## The parallel to agent evolution

| Autoresearch | May-agent |
|---|---|
| `program.md` (fixed strategy) | `common-sense.md` (team rules) |
| `train.py` (agent modifies) | `SOUL.md` (coach modifies) |
| `val_bpb` (single metric) | gym pass rate + eval quality |
| 5 min per experiment | 5-30 min per gym run |
| ~100 experiments/night | ~3 experiments/day |
| `git reset` on failure | revert SOUL.md on regression |

We're already doing the same loop — coach modifies SOUL.md, runs gym, keeps or reverts. But we're 30x slower and less systematic.

## What we can learn

### 1. Speed up the loop (coach)

Autoresearch runs 100 experiments overnight because each is fast (5 min) and automated. Our gym scenarios take 5-30 min each, and coach runs maybe 1-3 growth cycles per day.

**Idea:** Dedicated "overnight training" mode. Coach queues up 20-30 SOUL.md variations, runs them all through gym overnight, keeps the best. Like autoresearch but for agent behavior instead of model weights.

### 2. Single metric discipline (optimizer)

Autoresearch succeeds because it optimizes ONE number (val_bpb). We have too many metrics: gym pass rate, eval quality, eval efficiency, token cost, waste rate. Optimizer gets paralyzed by multi-objective tradeoffs.

**Idea:** Define ONE primary metric per agent. For coder: gym pass rate. For optimizer: cost per successful session. For scout: research output quality. Optimize that one number. Other metrics are constraints (don't let them regress), not objectives.

### 3. Fixed strategy, variable implementation (bob)

Autoresearch's `program.md` is sacred — only humans edit it. The agent only touches `train.py`. This maps to: common-sense.md is sacred (human-controlled), SOUL.md is the experiment space (coach/optimizer modify).

**We already designed this** in the prompt simplification. But now we have a concrete precedent: Karpathy proved this separation works at scale.

### 4. Radical minimalism (tech-lead)

Autoresearch is 10 files. The entire experiment infrastructure is one script. Our gym system is more complex but could be simplified. The gym-baseline.sh script is a good start.

**Idea:** Could we build an "auto-coach" — a single script that takes an agent name, runs N SOUL.md variations through gym, keeps the best? Like autoresearch but for agent prompts.

### 5. The "program the programmer" pattern (all)

In autoresearch, the human doesn't write Python — they write `program.md` which tells the AI HOW to write Python. The human is the meta-programmer.

We do the same thing: we don't write code for the Acme project — we write SOUL.md which tells the agent HOW to write code. May-agent is a "program the programmer" system.

## Questions for the team

### May
The autoresearch loop is: modify → run → measure → keep/revert. You already coordinate this for external projects. Could you run an "overnight training" session where coach iterates 20+ SOUL.md variations for a product agent?

### Bob
The autoresearch architecture is radically simple: 10 files, one metric, one editable file. Our agent evolution system is more complex. Is there a simpler design that captures the same loop? Could the gym-baseline.sh + SOUL.md editing be collapsed into a single "auto-evolve" workflow?

### Tech-lead
Could you build an "auto-coach" script? Input: agent name + gym scenarios. It generates SOUL.md variations (add a skill, remove a rule, rephrase a constraint), runs each through gym, keeps the best. Like autoresearch but for prompts.

### Coach
You already run growth cycles (fork → patch → gym → promote). The autoresearch pattern suggests: run MORE experiments, FASTER, with LESS human judgment per experiment. Could your growth cycle be fully automated? What stops you from running 20 experiments overnight?

### Optimizer
Autoresearch optimizes one number. What's the ONE number you'd optimize for each agent? Could you define a single "agent fitness" metric that combines gym pass rate, cost, and quality into one score?
