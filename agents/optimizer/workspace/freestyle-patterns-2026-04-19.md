# Freestyle Session Pattern Analysis — 2026-04-19

## Methodology
Queried `.state/may.db` sessions table: 21,541 completed sessions total, 1,847 (8.6%) use workflows, 19,694 (91.4%) are freestyle. Analyzed task/outcome fields across all major agents (may, evaluator, bob, coach, tech-lead, optimizer, scout, qa, amy-kimi, amy, coder).

## Session Breakdown (non-workflow)

| Source | Count | % of non-WF |
|--------|-------|-------------|
| (none) — heartbeat/scheduled | 18,397 | 93.4% |
| agents.fork — dispatched work | 778 | 3.9% |
| standalone-eval | 192 | 1.0% |
| cron | 184 | 0.9% |
| callAgent | 143 | 0.7% |

## Top 3 Freestyle Patterns

### Pattern 1: Agent Heartbeat (triage + dispatch)
- **Frequency:** ~15,890 sessions (64% of all sessions)
- **Agents:** Every agent (may: 3,556, evaluator: 2,645, tech-lead: 1,770, bob: 1,700, coach: 1,526, optimizer: 1,323, scout: 984, qa: 935, amy-kimi: 846, amy: 604)
- **What it does:** Agent reads heartbeat.md, checks metrics/projects/state, triages priorities, optionally dispatches work via agents.fork or workflow.run
- **Child sessions:** Heartbeats spawn child sessions that DO use workflows (observed: WORK SESSIONs, lens diagnostics, literature searches — all via `workflow` source)
- **Workflow-ification sketch:** A `heartbeat` workflow with steps: (1) read heartbeat.md, (2) check metrics, (3) triage priorities, (4) dispatch work. **However:** heartbeats are inherently open-ended — they are the *router* that feeds workflows. Converting them to a workflow may not add value since the whole point is flexible triage. **Recommendation:** Instead of workflow-ifying heartbeats, ensure heartbeats *dispatch into workflows* more consistently. The coverage metric should perhaps exclude heartbeat sessions or count them as "workflow-compatible" if they dispatch workflow children.

### Pattern 2: Task-Tree Evaluation
- **Frequency:** ~2,196 sessions (8.8% of all, nearly all from evaluator agent)
- **Agents:** evaluator (primary), some from tech-lead
- **What it does:** Receives a "Task Tree Evaluation" prompt with session list, costs, and participant agents. Evaluates each agent's behavior (capability level, efficiency, quality). Outputs structured JSON scores.
- **Current state:** These run as freestyle evaluator heartbeat children. Each follows an identical pattern: receive eval prompt → read session data → score agents → output JSON.
- **Workflow-ification sketch:** `task-tree-eval` workflow: (1) Gather session metadata, (2) Call evaluator agent with structured prompt, (3) Parse and store evaluation results. This is a **high-value workflow target** — the pattern is highly repetitive and structured. Could improve consistency and allow result aggregation.

### Pattern 3: Dispatched Investigation/Experiment Work Sessions
- **Frequency:** ~778 sessions (3.1% of all, via agents.fork)
- **Agents:** coach (27+, experiments), optimizer (20+, mode A-D scans), tech-lead (12+, lens diagnostics + fixes), bob (8+, synthesis + experiments), scout (9+, literature search + synthesis)
- **What it does:** Parent session (usually heartbeat) identifies work and forks a child with a `[WORK SESSION]` task. These are structured but ad-hoc: experiments (EXP-NNN), mode scans (Mode A-D), lens diagnostics, synthesis tasks, fix tasks.
- **Sub-patterns within dispatched work:**
  - Coach experiments: 12+ EXP-NNN sessions (design experiment, run gym, publish results)
  - Optimizer mode scans: ~15 sessions across Mode A/B/C/D (session archaeology, tool gap, technique scouting, workflow health)
  - Tech-lead lens diagnostics: ~12 sessions (Lens A-D architecture/flow/deadweight/fragility)
  - Bob synthesis: ~8 sessions (read deep-dives, create knowledge entries)
  - Scout lit searches: ~6 sessions (find papers, write reports)
- **Workflow-ification sketch:** Many of these **already route through workflows** (observed `source: workflow` on child sessions). The remaining ones that don't could benefit from a `dispatched-work-session` workflow: (1) parse task objective, (2) execute work, (3) write deliverable, (4) report back. But this is too generic. Better approach: formalize the **specific sub-patterns** (experiment-run, mode-scan, lens-diagnostic) as individual workflows.

## Coverage Impact Analysis

| Pattern | Sessions | If workflow-ified | New coverage |
|---------|----------|-------------------|-------------|
| Baseline | 1,847/21,541 | — | 8.6% |
| + Task-tree eval | +2,196 | Structured, repetitive — easy | 18.8% |
| + Dispatched work (remaining) | +~400 | Medium difficulty | 20.6% |
| + Heartbeat reclassification | +15,890 | Needs metric redesign | 82.5% |

**Key insight:** Getting to 80% coverage is impossible without addressing heartbeats. Two paths:
1. **Redefine the metric:** Count heartbeat sessions as "workflow-compatible infrastructure" (not counted in denominator), which would make remaining workflow-eligible sessions ~5,651, of which 1,847+2,196+400 = 4,443 would be workflow-ified = **78.6%**
2. **Wrap heartbeats in a workflow:** Create a minimal `agent-heartbeat` workflow wrapper. This is technically simple but philosophically questionable — it would game the metric without adding real structure.

**Recommended priority:**
1. **Task-tree evaluation workflow** — highest value, most structured, ~2,200 sessions captured
2. **Experiment-run workflow** — coach/bob pattern, ~100+ sessions, well-structured
3. **Metric redesign** — exclude or reclassify heartbeats to make coverage metric meaningful

## Files Referenced
- `.state/may.db` — sessions table (21,541 done sessions)
- `agents/optimizer/workspace/workflow-audit-2026-04-19.md` — iteration 1 audit
