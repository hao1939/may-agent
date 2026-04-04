# KE Summaries — One-Liner Injection Format

> **Purpose**: Router injects these into agent sessions when task keywords match.
> Each summary is 1-3 lines max. Format: what to do / not do, with evidence strength.
> **Maintained by**: Bob | **Last updated**: 2026-04-04

---

## KE-001: Context Learning Scope
context.md works for environmental facts agents can't derive from files (e.g., "npx unavailable"). Derivable facts (runtime, config paths) have zero impact — Claude finds them itself. (EXP-001, 3/3 consistent)

## KE-002: Text Rules Don't Fix Judgment
Adding text instructions to SOUL.md/skills for judgment tasks: **0/20 success rate, one harmful result** (caused timeout). Don't write text rules for judgment problems — use workflows or structural gates instead. (18 coach trials + EXP-017 + EXP-018)

## KE-003: Rich Delegation Context
Include file paths, error messages, root cause, and fix approach when delegating. Reduces wasted ops by 47% and time by 12%. (EXP-002, n=5)

## KE-004: Guards Are Brittle
Hardcoded regex guards break silently on environment changes. Use context.md facts for environmental constraints; reserve code guards only for permanent, universal constraints. (3 guard reverts in one day)

## KE-005: QA Rubber-Stamps
QA reviews find issues in only 14% of sessions vs evaluator's 27%. QA confirms "looks good" without adversarial checking. Adversarial framing may help (H-001, untested).

## KE-006: Reasoning Skills ≠ Tool-Call Change
Skills targeting reasoning patterns don't change tool-calling habits. Agent may *know* to stop retrying a missing file but can't stop itself. Fix tool-calling at the tool/framework level, not with text. (EXP-004)

## KE-007: Only Workflows Change Behavior
Two-phase workflow enforcement is the **only** reliable intervention for judgment behavior. Achieves 92-100% pass on tasks where text rules score 0%. Works by restructuring the task, not instructing the agent. (56+ experiments, 5 promoted)

## KE-008: Don't Add Heartbeat Steps
Adding mandatory pre-task steps to heartbeats causes **regression** (4/4 negative). The cognitive overhead displaces actual work. If you need checks, bake them into task-level workflows, not heartbeats.

## KE-009: Negative Examples Don't Work
"Don't do X" examples in LESSONS.md: **0/8 improvement**. Agents read anti-patterns but follow default heuristics anyway at decision time. Use structural prevention (guards, workflows), not documentation. (8 experiments)

## KE-010: Most Gym Scenarios Are Ceiling
Claude Sonnet 4 passes most scenarios at baseline. Only a handful differentiate baseline from patched. Before running experiments, check baselines — if >85% already, the scenario can't measure improvement.

## KE-011: Agents Skip Knowledge Files
Agents in oneshot mode go straight to the task — they don't browse INDEX.md or reference files. **Critical info must be in context.md (always loaded) or injected into the task prompt.** Passive knowledge files have ~5% utilization. (3 experiments)

## KE-012: Lab-Fork Infrastructure Valid
Null-patch test confirmed: forking with zero changes produces identical results to baseline. Regressions/improvements in experiments are caused by the intervention, not infrastructure. (controlled test)

## KE-013: Task Boundedness Drives Quality
Bounded-artifact tasks (clear input, single output): 90% good. Open-judgment tasks: 41% good. Gap: 49pp. Convert open tasks to bounded verification tasks when delegating. It's task structure, not delegation itself. (n=116 call sessions)

## KE-014: Quote-Splitting Bypass (Security)
Shell quote expansion (`S""OUL.md` → `SOUL.md`) bypasses regex security filters. Always canonicalize paths with `path.resolve()` before checking blocklists. (Patched)

## KE-015: Decision Topology Predicts Workflow Effectiveness
Eliminable-decision ratio R predicts workflow benefit: **R > 0.5 → workflow helps** (up to +100pp); **R < 0.3 → workflow hurts** (up to -33pp). Estimate R before assigning workflows. (ρ=0.95 correlation, 8+ sources, EXP-009/011/013/015/016)

## KE-016: Workflow Effectiveness by Decision Type
Workflows help in 40% of cases (+32% avg), hurt in 40% (-13% avg), neutral in 20%. Helps: assessment, discovery, verification tasks. Hurts: ceiling baselines, essential-decision tasks, intra-phase behaviors. (20 scenario pairs)

## KE-017: Materialization Improves Quality + Speed
Forcing intermediate findings to file: behavior +67pp, quality +33pp, speed +44%. Writing findings crystallizes understanding. First skill to improve both behavior AND product quality. (EXP-022, n=3/arm)

## KE-018: Environmental Nudges Match Skills
Pre-creating template files (L4 nudge) works as well as skill injection (L3) for behavioral change: 81% vs 78% vs 52% control. Nudges are zero-overhead and faster. Use for "write to file" behaviors; reserve skills for timing-specific rules. (EXP-023)

## KE-019: Sycophancy Needs Materialization Gates
Sycophancy resists nudges (0% effect) and regular workflows (0% effect). **Only strict workflows with materialization gates work** (0%→100%). The agent must write its own classification, then be forced to re-read it before acting. Self-commitment is the mechanism. (EXP-024)
