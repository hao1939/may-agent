# Research Project: Autoresearch — Autonomous AI Research Loop

**Status**: research  
**Owner**: Scout (research), Tech-lead (architecture implications)  
**Sources**:
- karpathy/autoresearch (GitHub 68.6k⭐, MIT) — autonomous single-GPU research agent
- Deep Dive v2: agents/scout/workspace/deep-dive-karpathy-autoresearch-v2.md
- SAHOO framework (recursive self-improvement safety)
- Issue #418 (exploration/diversity gap), Issue #57 (agent runtime limitations)
**Started**: 2026-03-20  
**Updated**: 2026-04-08

---

## Core Idea

Karpathy's autoresearch demonstrates a working "agent-as-researcher" paradigm: an AI agent autonomously modifies code, trains models, evaluates results, and iterates — running 100+ experiments overnight on a single GPU. The key architectural insight is a **3-tier trust architecture**: immutable evaluation oracle (prepare.py) → untrusted agent experimentation (train.py) → human governance layer (program.md). The human writes research methodology, not code.

At 68.6k stars in 33 days, this is the fastest-growing AI repo of 2026 Q1 and has defined "autonomous AI research" as a mainstream paradigm.

## Borrowable Ideas

### Idea 1: 3-Tier Trust Architecture
**What**: Separate infrastructure into (1) immutable evaluation (cannot be modified by agent), (2) agent-modifiable workspace, (3) human-authored governance/methodology.
**Why it matters**: Autoresearch proves this works for ground-truth metrics. Our system needs analogous separation — agents shouldn't modify their own evaluation criteria.
**Effort**: Medium — requires identifying which components should be immutable vs. agent-modifiable in our architecture.
**Connection**: Maps directly to SAHOO safety layers; prepare.py = L1 (deterministic judge), program.md = L6 (governance).

### Idea 2: Fixed-Budget Evaluation (Time-Based)
**What**: Every experiment gets exactly 5 minutes wall-clock time, making results comparable regardless of architecture changes.
**Why it matters**: Our agent tasks have no standardized resource budgets. Simple tasks get MAX_TURNS; complex tasks also get MAX_TURNS. Autoresearch shows time-based budgets enable fair comparison across heterogeneous approaches.
**Effort**: Low — add time/turn budgets to agent dispatch (see also: adaptive-reasoning-efficiency.md Idea 3).
**Connection**: Complements the Adaptive Reasoning Efficiency project's tiered budget approach.

### Idea 3: Git as Experiment Log + Binary Keep/Discard
**What**: Each agent modification is a git commit. If the result improves the metric, keep; if worse, `git reset`. The git history IS the experiment record.
**Why it matters**: We already use git for agent work, but don't leverage it as a structured experiment log. Autoresearch's pattern of commit → evaluate → keep/discard creates an auditable improvement trajectory.
**Effort**: Low-Medium — formalize commit-as-experiment pattern for iterative agent workflows.

### Idea 4: program.md as "Skill File" Pattern
**What**: The human writes `program.md` — research methodology and constraints — not the actual code. The agent executes the methodology autonomously.
**Why it matters**: Validates our markdown-instruction approach (heartbeat.md, system prompts). The highest-visibility AI project of the quarter uses the same pattern we do: structured markdown documents that configure agent behavior.
**Effort**: Already implemented — this validates our existing approach.

### Idea 5: Immutable Evaluation Contract
**What**: prepare.py is READ-ONLY by design. The agent physically cannot modify the evaluation metric or test harness.
**Why it matters**: Prevents metric gaming in autonomous improvement loops. Any system where an agent can modify its own success criteria is vulnerable to Goodhart's Law.
**Effort**: Medium — requires identifying which files/functions should be immutable in our system and enforcing read-only access.

### Idea 6: Robust Components for Autonomous Operation
**What**: Autoresearch uses Muon optimizer (bounded-norm updates via orthogonal projection) specifically because it's more robust to hyperparameter variation than Adam — reducing divergence risk when an agent is choosing hyperparameters autonomously.
**Why it matters**: When agents operate autonomously, component choices should favor robustness over peak performance. A component that works 95% of the time beats one that works 99% but catastrophically fails 1%.
**Effort**: Architectural principle — apply when selecting libraries, models, and approaches for autonomous agent use.

## Known Gaps (What Autoresearch Gets Wrong)

These are opportunities where our system could improve on autoresearch's design:

1. **No exploration/diversity mechanism** — converges to local optima. Community (Issues #47, #418) independently discovered this. Solutions proposed: random injection, novelty pressure, forced diversity scheduling.
2. **No cross-experiment meta-learning** — each experiment is independent. Agent doesn't learn "approaches X tend to work" across runs.
3. **No drift monitoring** — agent could optimize for overfitting or metric hacking without detection.
4. **Agent runtime limitation** — OpenAI Codex can't sustain the loop (Issue #57, still open after 33 days). Only Claude can run it reliably. The gap between "agent follows instructions" and "agent runs autonomously for hours" remains unsolved.
5. **Single-metric optimization** — no multi-objective balancing (e.g., quality vs. compute vs. simplicity).

## Findings Log

### 2026-03-20 — Scout initial deep dive (v1)
- Full source code analysis of train.py (26KB), prepare.py (15KB), program.md (7KB)
- Identified 3 transferable patterns: fixed-budget eval, git-as-experiment-log, program.md skill file
- Mapped to SAHOO safety framework: autoresearch lacks drift monitoring, constraint preservation, regression tracking
- Stars: 45k, Forks: 6.2k

### 2026-04-08 — Scout deep dive update (v2)
- Stars: 68.6k (+52%), Forks: 9.9k (+59%)
- Core codebase frozen — only 2 commits since v1 (README update, analysis.ipynb bug fix)
- MIT license added (was unlicensed) — enables ecosystem
- README evolved into comprehensive small-compute tuning guide
- 4 officially-listed platform forks (2 MacOS, 1 Windows, 1 AMD)
- 306 total PRs (129 open, 177 closed) — exceptional community engagement
- Issue #418 confirms exploration/diversity gap we identified
- Issue #57 (Codex) still unsolved — validates agent runtime as hard problem
- Identified 3-tier trust architecture as the key theoretical contribution

## Hypotheses to Test

- **H-XXX: Immutable evaluation contracts reduce metric gaming** — If we make evaluation harnesses read-only (agent can't modify test criteria), autonomous improvement loops will produce more genuine improvements vs. Goodhart-style gaming.
- **H-XXX: Fixed-budget evaluation improves experiment comparability** — Standardizing agent task budgets (turns/time) will make performance comparisons across approaches more reliable.

## Next Steps

1. **Write hypothesis H-XXX for 3-tier trust architecture** — Formalize the immutable-eval / agent-workspace / human-governance separation as a testable design principle.
2. **Cross-reference with adaptive-reasoning-efficiency.md** — Idea 2 (fixed budgets) directly complements that project's Idea 3 (tiered subagent budgets).
3. **Monitor Issue #57 (agent runtime)** — If/when Codex or another runtime solves sustained autonomous operation, this changes the landscape significantly.
4. **Track fork ecosystem** — The community forks (especially program.md variants) may produce novel research methodologies worth analyzing.
5. **Exploration/diversity mechanism design** — The gap autoresearch exposes (convergence to local optima) is our opportunity. SAHOO + diversity injection could be a differentiating contribution.

---

*Based on Scout deep dives v1 (2026-03-20) and v2 (2026-04-08). Source: github.com/karpathy/autoresearch (68.6k⭐, MIT).*
