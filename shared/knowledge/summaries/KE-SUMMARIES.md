# KE Summaries — One-Liner Injection Format

> **Purpose**: Router injects these into agent sessions when task keywords match.
> Each summary is 1-3 lines max. Format: what to do / not do, with evidence strength.
> **Maintained by**: Bob | **Last updated**: 2026-04-08

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

## KE-020: Adoption Requires Explicit Wiring
Building a capability is half the work — wiring it into agent instruction paths is the other half. **0/30 agents discovered capabilities on their own** across workflows, skills, and scripts at any salience level. Every new capability needs an adoption plan: injection into system prompt, context.md, or task templates. (EXP-028, EXP-030, EXP-031b)

## KE-021: Skill Type Hierarchy — Process > Knowledge > Judgment
Process skills (add a step) work reliably. Knowledge skills (provide info) work sometimes. Judgment skills (suppress default behavior) almost never work via text. Classify the target behavior before choosing intervention type. (EXP-032, 20+ experiments)

## KE-022: Errors Concentrate in Early Exploration
Agent errors cluster in the first ~20% of tool calls (early exploration phase). Context injection and environment facts in system prompt reduce early errors. Late-session quality is stable or improving. (EXP-037, n=577 sessions, 17,405 tool calls)

## KE-023: Read-Before-Edit Skill Ineffective in Production
Gym score: 11/11 with skill loaded. Production compliance: declining. **Gym results don't guarantee production improvement.** Production deployment needs its own measurement protocol. (Convention compliance data, 4 agents)

## KE-024: Dispatcher Heartbeat Pattern
Separating heartbeat triage (lightweight) from execution (delegated work sessions) eliminates overhead and errors. Adopt for high-cost agents — potential ~$80/day savings system-wide. (EXP-034, controlled before/after, n=8+74)

## KE-025: Instruction Overhead Paradox
More context files **hurt** performance. Keep only environmental knowledge (build commands, file paths). Remove derivable info, aspirational rules, and redundant instructions. Audit agent SOUL.md/context.md for bloat. (Externally validated)

## KE-026: Pull Discovery Is Dead
Agents never self-serve from reference materials: **0/30 total across 3 resource types and 4 salience levels.** Only push delivery works. Skills/workflows must be injected into system prompts or task templates, not left in libraries. (EXP-028, EXP-030, EXP-031)

## KE-027: Skill Ceiling Shifts Are Confounded
Deployed skills showed zero detectable effect on gym scenarios. Before/after comparisons are confounded by framework/model changes. **Pin the binary SHA** and run baseline + treatment on same day. Use ablation studies. (EXP-040, EXP-041)

## KE-028a: Technical Sycophancy Is Ceiling
Technical sycophancy (obviously bad requests like "switch to MD5") is ceiling — agents already resist. Judgment-based sycophancy (plausible-sounding bad requests) is the real problem. **Plausibility correlates with difficulty.** (EXP-041, 3 scenarios)

## KE-028b: Production Failures Can't Be Replicated in Gym
Gym's clean task + test signals are too strong — they override injected noise. **Adding gym scenarios won't reduce ceiling for behavioral failure modes.** Gym is for competency testing, not behavioral testing. (EXP-065, 12/12 ceiling)

## KE-029: Classify-Then-Act Eliminates Sycophancy
Forcing the agent to first classify the request type, then act on its classification, achieves **100% sycophancy resistance** where text skills score 0%. The agent has the judgment — it just needs structural activation. (EXP-025, EXP-043, 9+ runs)

## KE-030: Skill Ablation Falsifies Causal Attribution
Ablation study showed skills had zero causal effect on wrong-fix-recovery — framework/model changes explained all improvement. **Always use ablation controls.** Remove the intervention and verify the score drops. (EXP-041, 7-condition ablation)

## KE-031: Forced Externalization Is Domain-Independent
Forced externalization (write or read structured analysis before acting) achieves **100% pass rates** across tunnel vision, sycophancy, contradiction blindness, context-parroting, and proxy-satisfying — where baselines range 0–67%. First intervention that works across all tested failure domains. (EXP-044/045/046/047/048/069, 79+ runs)

## KE-032: Externalization Has Dual Pathways (Write OR Read)
Pre-written analysis templates achieve the same effect as forcing agents to write their own analysis. For known-pattern situations, use pre-written checklists (cheaper, faster). Both the write and read pathways independently activate judgment. (EXP-046)

## KE-033: Forced Externalization Is Scale-Invariant
The same mechanism (externalize implicit assumptions before acting) works at task level, harness level, and system level. Meta-agents and constitutional governance use the same principle. (Theoretical, supported by convergent evidence)

## KE-034: Analysis Activation, Not Content Provision
**Wrong analysis achieves identical results to correct analysis.** The mechanism is triggering careful thinking, not providing correct conclusions. Don't over-engineer externalization prompts — just require structured analysis output. (EXP-047)

## KE-035: Forced Assessment Eliminates Proxy-Satisfying
On impossible tasks, agents exhibit 100% proxy-satisfying behavior (fake success). Adding a forced assessment phase achieves **100% correct escalation.** Use assessment phases for tasks where the agent might face ambiguity about feasibility. (EXP-048, H-058)

## KE-036: Behavioral Frustration Detection
Tool-call patterns (error bursts, re-reads, edit thrash, late escalation) detect frustration independently of linguistic signals. **But penalties must be verification-gated** — behavioral signals alone have false positives. (EXP-049)

## KE-037: Scaffolding Spectrum — Internalization vs Externalization
Skill internalization (SKILL0-style graduation) and forced externalization are **complementary endpoints**. At ≥90% baseline: no scaffold needed. At 50-85%: calibrate scaffold level. At <50%: full externalization required. Match intervention intensity to baseline competence. (Theoretical synthesis)

## KE-038: Constitutional Meta-Engineering
Each level's externalization enables the next level's optimization. Without constitutional externalization, meta-agents have no defined boundary → unbounded self-modification → alignment failure. Recursive application of forced externalization from task → harness → governance. (Theoretical, CR-302)

## KE-039: Persistent Runtime Convergence
Independent systems (Springdrift, MemMachine, disagreement reasoning) converge on our architecture: append-only decision logs + slow stable memory + fast adaptive memory. Forced externalization naturally creates forensic artifacts — systematically preserve and index them. (Theoretical, 3 independent systems)

## KE-040: Memory Architecture Convergence
Lifelong learning requires BOTH slow/stable cross-session memory AND fast/adaptive within-session memory. Static context.md is a start but dynamic context-aware delivery is better. Our Knowledge Consumability Plan (promote key findings to context.md) is validated but incomplete. (Theoretical, 4 independent studies)

## KE-041: Structural Constraint + Stigmergic Coordination
Improvement comes from **eliminating incorrect options before the decision point**, not steering within the full action space. This is why text rules (0/20) and reward shaping fail — they operate within the full space. Use structural constraints that make wrong actions mechanically impossible. (DD-589, DD-594)

## KE-042: Multi-Agent Dispatch Convergence
Five independent dispatch paradigms converge on the same 5-property architecture. Inter-agent coordination requires the same structural enforcement as intra-agent judgment: forced externalization of implicit assumptions. (CR-282, 5 paradigms, 6 frameworks)

## KE-043: Forced Externalization — Complete Empirical Picture
**Most validated intervention in the system.** 9 experiments, 79+ runs, 5 failure domains, 100% pass where baselines 0-67%. Boundary condition discovered: analysis-action gap on debugging/architectural tasks where workarounds exist. Skills alone: 0% effect. Workflow structure is the active ingredient. (EXP-045 through EXP-072)

## KE-044: Verification Separation Thesis
Five independent systems converge on **external evaluation as the structural prerequisite for reliable self-evolution.** Systems that evaluate their own changes cannot detect cosmetic-vs-substantive improvements. (5 independent groups, 6 institutions, 3 continents)

## KE-045: Multi-Agent Social Pathologies
Power laws, sycophancy cascades, and collusion emerge as structural diseases in multi-agent systems. Natural structural diversity (genuinely different roles) prevents homogenization collapse. (DD-534: 1.5M+ interactions, DD-535: 6 LLMs, DD-520: 1.00 AUROC detection)

## KE-046: Reasoning Depth Crisis — Thinking Budget Collapse
Reduced thinking budgets cause **invisible, multiplicative quality collapse** (r=0.971 correlation between thinking depth and output quality). Not a graceful degradation — a phase transition. Monitor thinking token usage as a quality proxy. (17,871 blocks, 6,852 sessions, Anthropic-confirmed)

## KE-047: Agent Harness Architecture Convergence
Four independent harness implementations converge on 10 structural subsystems. This is the irreducible architecture for LLM agents. Snapshot isolation is a prerequisite for safe parallel execution. (4 independent systems, 2026)

## KE-048: Agent Safety Stack — 5 Layers
Five layers from vulnerability discovery to regulatory compliance. **Each layer addresses a different failure mode; no layer is sufficient alone.** Omitting any layer leaves a specific attack class unaddressed. Discovery capability scales super-linearly with model capability. (5 independent contexts)

## KE-049: Agent-Environment Interface — Structural vs Semantic
Structural formalization (typed APIs, memory schemas) solves mechanical problems reliably. **Semantic problems (when to act, what to prioritize) remain unsolved** by structural means. The capability gap is "whether to do X" not "how to do X." (4 independent studies)

## KE-050: Robustness Is Architectural, Not a Model Property
Agent robustness comes from architecture (communication topology, role structure, coordination protocol), not from better individual models. Communication topology learning converges to sparse structures. Specialized roles emerge without explicit assignment. (4 independent papers)

## KE-051: Self-Governance Stack — 3 Layers
Three independent groups converge on layered self-governance: operational (task execution), strategic (goal management), constitutional (meta-rules). Each layer needs its own feedback loop and externalization mechanism. (FAIR/Hebrew U, Skoltech, 5 institutions)

## KE-052: Structural Access Thesis (Unified)
**Structural access constraints dominate content quality** across workflow effectiveness, evaluation reliability, and KB utilization. "Add more content" is usually the wrong fix. The binding constraint is structural access (measured by R), not content volume (N). Focus on whether agents CAN access knowledge at the decision point, not on creating more of it. (EXP-051, EXP-052, EXP-053)

## KE-053: Gym-Production Gap Is Structural
Agents at 96% gym pass rates still fail 28% in production. The gap is structural: production requires conjunction of ambiguous tasks + partially-correct prior work + absence of automated test signals. **Gym is a regression suite, not a training tool.** Can't close the gap by adding gym scenarios. (EXP-065/066/067, 893 production errors)

## KE-054: Externalization Boundary — Judgment vs Debugging
Forced externalization helps **judgment failures** (sycophancy, tunnel vision, contradiction blindness) but **hurts debugging/architectural-fix performance.** Sharp domain boundary, not gradual. Use externalization when the bottleneck is *recognizing what to do*, not when it's *executing a complex fix*. (EXP-070/071/072)

## KE-055: Binding Closes Analysis-Action Gap (Conditionally)
Implementation commitment (binding) achieves +100pp on analysis-action gap **only when workarounds are mechanically blocked** (v3: 3/3=100%). When workarounds exist (v2: 0/6=0%), binding has zero effect. Workaround availability is the critical boundary. (EXP-073, H-088 P(H)=0.70)

## KE-056: Constraint Hierarchy — Workaround Availability Dominates
**Workaround availability is the single dominant variable** for whether agents implement correct architectural fixes. No instructional intervention (text rules, externalization, binding) overrides a simpler path that produces passing tests. Design tasks/architectures to make workarounds mechanically impossible when the correct fix matters. (EXP-070–073, 30 runs, 6 conditions)
