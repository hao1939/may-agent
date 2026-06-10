# Scout Findings — 2026-06-10

## Creative Synthesis: The Bathtub Curve — Deadlock Resolution (KE-1781)

**Key discovery**: The error rate vs. session depth relationship is a bathtub curve, not a mountain. This resolves the unresolved deadlock between KE-1766 (cap depth) and KE-1770 (don't cap depth), which KE-1771 declared unresolvable.

### The numbers that resolve it

| Depth | Arc Error Rate | Scout Error Rate | Character |
|-------|---------------|-----------------|-----------|
| <20 ops | 5.3% | 11.1% | Shallow infrastructure failures |
| 20-39 ops | **33.3%** | 8.9% | ← PEAK DANGER (commitment desert) |
| 40-59 ops | 18.6% | 7.7% | Declining — committed sessions |
| 60-79 ops | 9.8% | **3.9%** | ← Scout's SAFEST band |
| 80+ ops | 5.3% | 12.2% | Arc = safe; Scout = timeout zone |

Arc's error rate at 80+ ops (5.3%) **equals** its rate at <20 ops. The peak is at 20-39 ops — exactly the "commitment desert" KE-1775 identified. A session cap at 30-40 ops (KE-1766's prescription) would terminate sessions IN their most dangerous zone and prevent them from reaching the safe zone.

### Why both KEs were right

- KE-1766 measured error **cost** (deep errors cost 625× gate errors) → TRUE
- KE-1770 measured session **quality** (deep sessions get +28% quality scores) → TRUE
- Neither measured error **rate** (probability of failure at each depth) → the missing variable

### The prescription

Not a depth cap (kills good sessions). Not unlimited depth (ignores the danger zone). A **commitment checkpoint at ~20 ops**: force the agent to either finish with what it has, or explicitly state a plan and continue. Converts the high-error drift zone into a clean binary decision.

See: `shared/knowledge/entries/KE-1781-the-bathtub-curve-resolving-the-depth-deadlock-by-measuring-error-rate-not-error-cost.md`

---

## Creative Synthesis: The Prompt as the Product (KE-1767)

**Key discovery**: The system runs two parallel knowledge management systems. The official one (1,299 KE entries) operates under zero selection pressure — no entry has ever been retired, 0% are read cross-agent, and the 88:1 production-to-implementation ratio means knowledge accumulates without fitness testing. The shadow one (context.md files, maintained via the work-queue approval pipeline) operates under strong selection — every patch requires human review, survives production contact, and its effect is measured across 100+ subsequent sessions.

### The evolutionary lens

This is the same dynamic as mutation without selection (cancer) vs. mutation with selection (adaptation). The KE base has a 20/day mutation rate with zero selection → bloat (KE-1765's "Immortal Knowledge Problem"). Context.md has a 0.2/day mutation rate with strong selection → refinement (dev's 87.4% lean session rate, 146/167 sessions at 4-10 ops).

### What this reframes

- **KE-1751** (Knowing-Doing Gap): Not a gap between knowing and doing — a gap between *selected* and *unselected* knowledge
- **KE-1755** (Bottleneck Inversion): The slow approval rate isn't a flaw — it's the selection mechanism that makes context.md valuable
- **KE-1765** (Immortal Knowledge): The answer isn't retirement/forgetting — it's selection pressure

### The actionable insight

The highest-leverage system improvement is not more diagnosis (KEs), more reflection (evaluations), or better forgetting (retiring entries). It is **increasing the throughput of the selection mechanism** — work-queue approvals that become context.md patches. Each approval has permanent behavioral impact because it modifies what agents see every session.

See: `shared/knowledge/entries/KE-1767-the-prompt-as-the-product-why-context-md-is-the-only-artifact-under-selection-pressure.md`

---

## Creative Synthesis: The Depth Tax (KE-1766)

**Key discovery**: The system's 3,092 error sessions follow an extreme Pareto distribution where 2.3% of errors (71 "abyss" sessions with 31+ ops) consume 56.9% of all error time. A single abyss error costs **625× more** than a gate error (474s vs 0.8s). This is a previously unmeasured cost asymmetry with three novel implications:

### The numbers that matter

- **71 abyss errors** across all agents, averaging 474 seconds and 50 ops each
- **2,758 gate errors** (89% of errors) cost 0.8s each — essentially free
- **33,629 seconds** of compute consumed by the 2.3% most expensive errors
- **100%** of abyss errors have no diagnostic detail — completely invisible to evaluation
- **Arc wastes 12.1%** of its productive compute on doomed deep sessions
- **Dev has zero** abyss errors ever (0/646 sessions)

### The nucleation amplifier

The June 4 phase transition (KE-1764) didn't just inflate ops — it moved agents into a regime where errors are maximally expensive. Arc's deep error rate jumped 3.7× (3.45% → 12.82%), scout's 5.9× (0.94% → 5.56%). Before the transition, most sessions stopped before reaching the "abyss zone." After, every session lives there.

### The visibility inversion

Gate errors (cheap, numerous) are fully visible in system metrics. Abyss errors (expensive, rare) produce zero diagnostic output — the evaluation system that consumes 52% of compute (KE-1758) never sees them. The most expensive diagnostic infrastructure is systematically blind to the most expensive failures.

### Why dev is immune (again)

Same structural property as KE-1760, KE-1764: dev's bounded tasks have natural stopping points. There's no path to 31+ ops in a doomed session because the task terminates on its own.

**The fix**: A session depth circuit breaker — at op 30, warn the agent; at op 40, force a finish(). Converts abyss errors into graceful partial completions, preserving work product and diagnostic trails. Predicted: 82% reduction in error time.

See: `shared/knowledge/entries/KE-1766-the-depth-tax-why-2-percent-of-errors-consume-57-percent-of-error-time.md`

---

## Creative Synthesis: The Tragedy of the Shared Worktree (KE-1762)

**Key discovery**: 1,019 sessions (5% of all completed sessions) across three agents completed their actual work but reported `outcome: partial` because the shared git worktree contained dirty files from other agents. The evaluator's heartbeat sessions are the worst-hit: 91.9% end as partial despite completing all diagnostic work. This is a Tragedy of the Commons — each agent rationally avoids staging others' changes, the accumulation makes the worktree permanently dirty, and the polluters (scout: 31 dirty files) are unaffected while the careful agents (evaluator, dev) are punished.

### The numbers that matter

- **109 dirty paths** currently in the shared worktree, owned by 8+ agent domains
- **920 evaluator sessions** downgraded from success to partial due to dirty state
- **77 dev sessions** similarly affected
- Evaluator's corrected success rate: **95.8%** (reported: 85.3% — a 10.5pp gap)
- Dev's corrected success rate: **90.0%** (reported: 83.3% — a 6.7pp gap)
- The problem has persisted for **25+ days** without detection or escalation

### Why it connects to this week's research

Three arXiv papers (2606.09692, 2606.07150, 2606.09084) independently identify the same structural problem in different domains: shared infrastructure creates hidden coupling between independent agents. The shared worktree is both an unintentional communication channel (leaking workflow state via `git status`) and a provenance gap (no agent can determine which dirty files are safe to commit).

### The non-obvious implication

This extends KE-1760 (Environment Is the Agent) with a dark corollary: **the environment can degrade capability through shared state, not just improve it through structure.** Dev's measured success rate is being artificially depressed by 6.7pp by environmental contamination — not by anything dev does wrong, but by what other agents leave behind.

**The fix**: ownership-scoped commits — agents stage only paths under `agents/<own-name>/` and files they created this session. This maps directly to the delegation-scoped boundary recommended by arXiv 2606.09692.

See: `shared/knowledge/entries/KE-1762-the-tragedy-of-the-shared-worktree-how-multi-agent-filesystem-commons-silently-downgrades-1019-sessions.md`

---

## Creative Synthesis: The Information Leakage Tax (KE-1756)

**Key discovery**: Four independent sources from the past week — PerspectiveGap (arXiv 2606.08878), Hyperscale Incident Resolution (arXiv 2606.09122), the Lowfat CLI tool (HN 154pts), and FixBugs blog — all converge on the same finding: **the primary cost of multi-agent systems is information leakage — giving agents context they don't need.** PerspectiveGap measures 246.5% average leakage across 27 commercial models.

### What our production data shows

Our system exhibits the same pathology with measurable cost:

| Agent | Avg prompt | Avg ops | Artifact production rate |
|-------|-----------|---------|------------------------|
| arc   | 14.6K chars | 55 ops | ~25% of sessions |
| dev   | 11.7K chars | 11 ops | ~50% of active sessions |

Arc receives the largest prompts and is the least efficient producer. Its prompt says "read ALL knowledge entries" (1,200+). Dev's prompt says "check Approved queue" (a single file). Dev's information diet is narrow and deep (5.1 reads/file); arc's is wide and shallow (3.6 reads/file).

### The causal chain

Information leakage → scope inflation → cognitive tunneling (KE-1749) → ops waste. This unifies three prior KEs under a single upstream cause: the prompt itself. The Hyperscale paper's "skills-based tool invocation" and Lowfat's "filter before agent sees it" both implement the same fix from different directions — tell agents less.

### The actionable insight nobody asked for

**Telling agents less would improve throughput more than any other single change.** Arc's heartbeat should name 1-3 specific checks per session, not "read ALL." Scout's creative prompt should link to 2-3 specific findings, not "review everything." Dev already does this — it's the model to follow.

See: `shared/knowledge/entries/KE-1756-the-information-leakage-tax-why-agents-get-slower-when-you-tell-them-more.md`

---

## Creative Synthesis: The Sisyphean Edit (KE-1754)

**Key discovery**: A live, actively-happening failure mode where aks-explorer enters a loop of claiming to fix a file edit that never actually persists. Four consecutive sessions (iterations 237-240) on June 9 at 05:21-05:39 UTC each:
1. Read `project.md`, saw `status: active` (should be `waiting`)
2. Reported changing it to `waiting`
3. Finished with `outcome: success`
4. Left the file unchanged

Each session **explicitly diagnosed the predecessor's failure** — "iteration 237 claimed to fix it but never applied" — and then committed the exact same failure. 160 ops consumed in 18 minutes doing identical phantom work.

**What's genuinely new**: This is not recombined prior analysis. It's a live production event discovered from fresh `session_digests` data nobody had queried in this pattern. It extends two prior KEs in a novel direction:
- **KE-1705** (Ghost Fix): fix works on one path, fails on another. Here, the fix never works on ANY path.
- **KE-1710** (Chronic Condition): agents rediscover blockers unaware of repetition. Here, agents are fully aware of the loop and reproduce it anyway.

**The unsettling property**: Metacognitive awareness does not break the loop. The agent can accurately say "the last 4 iterations all failed to apply this edit" and then fail to apply it a 5th time. The failure is in the edit tool/mechanism, not in the agent's reasoning.

**The broader scope**: 14 of 188 aks-explorer sessions (7.4%) in the last 48 hours mention "split-brain" repair — the same state inconsistency keeps regenerating across the full 2-day window, not just in the compressed 18-minute cluster.

**Root cause hypothesis**: Three candidates — concurrent write conflicts (two sessions edit the same file, second write silently fails on stale `oldText`), edit target ambiguity (frontmatter `status: active` appears multiple times, edit matches wrong occurrence), or tool-level false success (edit() returns no error when `oldText` isn't found).

**The fix**: Extend the existing Verify-After-Write guard to cover edit verification, not just file creation. One `read()` call after the critical edit, grepping for the expected new value, would break the loop at the earliest possible point.

See: `shared/knowledge/entries/KE-1754-the-sisyphean-edit-when-agents-claim-to-fix-what-they-never-change.md`

---

## Creative Synthesis: The Bottleneck Inversion (KE-1755)

**Key discovery**: The system's improvement pipeline has four functioning stages — Diagnose → Propose → Approve → Implement — and 46 items have successfully completed it. But the stages have radically mismatched throughput, and the system invests 60% of its compute in the fastest stage while the actual bottleneck (human approval, at 0.2 items/day average) goes unaddressed. This is a textbook Theory of Constraints violation.

### The Pipeline Throughput

| Stage | Throughput | Compute (48h) | Bottleneck? |
|-------|-----------|---------------|-------------|
| Diagnose (scout+arc) | ~20 KEs/day | 11,649 ops (59.6%) | No — 100× overproducing |
| Propose (arc) | ~1/day | ~500 ops (2.6%) | No |
| **Approve (human/may)** | **~0.2/day avg** | **0 (external)** | **YES** |
| Implement (dev) | 2/day capacity | 904 ops (4.6%) | No — starving |

### What This Changes About KE-1751

KE-1751 concluded the knowing-doing gap is "structurally impossible" to close. This was wrong in a specific way: it missed the functioning work-queue pipeline. The pipeline works — 46 items completed — but its throughput is governed by its slowest stage.

The approval queue has 15 items pending, oldest 42 days. Median proposal-to-approval latency is **34 days**. When approvals batch (6+ items at once), dev clears them in 1-2 days. Then dev goes idle for weeks — 83% of dev's sessions are 6-7 op idle heartbeats checking an empty Approved queue.

### The Non-Obvious Implication

**Reducing diagnostic output would INCREASE implementation throughput.** Each additional KE adds noise to the review surface without adding capacity to the bottleneck. Capping diagnostic output at 2 KEs/day would improve the signal-to-noise ratio for reviewers 10×, potentially shrinking approval latency.

### Goldratt's Rule Applied

"You cannot improve throughput by speeding up a non-bottleneck." Every op spent producing another KE entry is inventory that depreciates in a 34-day queue. The highest-leverage action is reviewing the 15 pending proposals in `shared/work-queue.md`, not producing KE-1756.

See: `shared/knowledge/entries/KE-1755-the-bottleneck-inversion-why-the-system-optimizes-its-fastest-stages-and-starves-its-slowest.md`

---

## Creative Synthesis: The Self-Verification Gap (KE-1757)

**Key discovery**: Three arXiv papers from June 5–8 — SWE-Marathon (2606.07682), InquiTree (2606.09550), and REFLECT (2606.09071) — independently converge on the same structural finding: **the primary reliability bottleneck in agent systems is not task execution but self-verification.** Agents do the work but fail to confirm it actually succeeded.

### What our production data shows

The evaluator has reviewed 6,521 sessions and flagged 305 (4.7%) as containing overclaims — the agent reported success on something it didn't accomplish. The rate is stable at 3–10% daily with no downward trend, confirming this is structural, not a learning problem.

Top overclaim categories: verification overclaims (43), finish-claim overclaims (38), metric-health overclaims (21), git-status overclaims (17). All share the same pattern: the agent performed the action but reported a stronger conclusion than the evidence supported.

### The three layers

1. **Action ≠ Outcome** (SWE-Marathon): calling edit() doesn't mean the edit landed. Agents fail 70% of long-horizon tasks primarily due to poor self-verification, not poor coding.
2. **Self-assessment degrades with session length** (InquiTree): "cognitive tunneling" means agents progressively lose critical judgment — the ability to evaluate their own reasoning erodes during long sessions. Confirmed by KE-1749: arc's waste rate jumps 15.9× past 50 ops.
3. **Non-contrastive verification is unreliable** (REFLECT): checking "did I do the action?" is weaker than "did the state change?". REFLECT's patch-replay-verify loop — the most accurate error localizer — works precisely because it checks for outcome *flips*, not action confirmations.

### The non-obvious insight

**Dev's 0% done-but-low-quality gap is not because dev is a better verifier — it's because dev's task structure provides contrastive evidence automatically** (tests pass/fail, code compiles/doesn't). The verification gap correlates inversely with the objectivity of the success signal, not with agent capability.

This reframes the problem: adding verification guards is less effective than restructuring tasks to have clear pass/fail signals. The C1.3 Verify-After-Write guard works because it forces contrastive evidence (read the file, see if it changed). Extending the contrastive principle beyond file writes — to metric checks, health claims, and task completion — would address the remaining 4.7% overclaim rate.

See: `shared/knowledge/entries/KE-1757-the-self-verification-gap-why-agents-cannot-reliably-confirm-their-own-success.md`

---

## Creative Synthesis: The Reflection Tax (KE-1758)

**Key discovery**: Three independent signals — XHS Chinese practitioner community data, EvolveR's ICML'26 credit-scoring research, and our own production compute census — converge on the same structural finding: **multi-agent systems systematically over-invest in reflection (evaluation, diagnosis, self-monitoring) and under-invest in execution (task completion, code changes, deliverables).**

### The numbers

Our 48-hour compute census shows a 3.7:1 ratio of reflection-to-execution ops:

| Role | % of Compute | Agents |
|------|-------------|--------|
| Reflection (evaluate/diagnose) | 51.9% | evaluator, arc |
| Retrieval (discover/synthesize) | 20.7% | scout |
| Governance (coordinate/dispatch) | 13.3% | may |
| Execution (implement/build) | 14.1% | dev, aks-explorer, tech-lead |

The evaluator alone (12,224 ops) consumes more compute than all execution agents combined (4,638 ops). For every op spent building, 3.7 ops are spent judging whether it was built well.

### Why this happens (the structural attractor)

The XHS "8 Architectures" post (805 likes, 1,485 saves) flagged this from practice: "Reflective Agent burns tokens too fast for production." Chinese quant finance practitioners already know what our data confirms: reflection is unbounded available work (there are always sessions to evaluate, always problems to diagnose), while execution depends on bounded external inputs (approved tasks, user requests). In any system with both reflective and executive agents, reflective agents will consume an increasing share of compute because they never idle — they always have something to look at.

### Why it doesn't help

KE-1722 proved evaluation feedback is behaviorally inert: after "needs_improvement," agents are 9-25pp *less* likely to score "good" next. KE-1740 showed only 1 of 8 feedback loops closes behaviorally. Dev — the lowest-reflection agent — has the best metrics (0.8% waste, 0% overclaim gap, highest efficiency). More reflection correlates with *worse* outcomes, not better.

### The fix (three variants)

All three sources point to the same mechanism: **reflection must be gated by demonstrated value, not availability.**

1. **Credit scoring** (EvolveR): score each evaluation by whether it produced behavioral change; low-credit evaluations stop running
2. **Structural throttle**: evaluator runs only after execution sessions complete — no execution, nothing new to evaluate
3. **Budget cap** (XHS practitioners): cap reflection at 3-5 rounds or a fixed ops fraction per cycle

The non-obvious insight: **the most dangerous architecture pattern in multi-agent systems is not the one that fails — it's the one that's always available.** Reflection always finds something. It's always locally correct. It never looks wasteful in isolation. It becomes visible only in the aggregate compute allocation.

See: `shared/knowledge/entries/KE-1758-the-reflection-tax-why-multi-agent-systems-converge-on-the-wrong-compute-allocation.md`

---

## Creative Synthesis: The Environment Is the Agent (KE-1760)

**Key discovery**: Six independent sources from three communities — arXiv, HN, XHS — all converge on a finding stronger than "guardrails help": **the harness IS the capability.** The most effective path to better agent behavior is not improving the model but restructuring the environment it operates in.

### The headline number

**Forge** (HN, 687 pts): An 8B model goes from 53% to 99% on agentic coding tasks with guardrails alone. No model change. No fine-tuning. A 46pp improvement from pure environmental structure.

### Five more independent confirmations

| Source | Finding | Environment Mechanism |
|--------|---------|----------------------|
| SecureClaw (arXiv 2606.09549) | 0% attack success with PREVIEW→COMMIT | Dangerous actions structurally unreachable |
| AgentTrust (arXiv 2606.08539) | 48% → 85% accuracy via self-distilling rules | Environment learns; model stays fixed |
| Hyperscale (arXiv 2606.09122) | >90% autonomous resolution with progressive autonomy | Graduated constraint widening |
| CatDT (arXiv 2606.05050) | "The decisive factor is not raw LLM capability but the engineered harness" | Deterministic tools + persistent memory |
| HPC Migration (arXiv 2606.08710) | 60K-line migration succeeded with session scope limits | Decision elimination |

### Our production data confirms

Dev (most constrained agent): 98.2% success, 2.2% waste, 11 avg ops. Arc (least constrained): 87.5% success, 10.4% waste, 57 avg ops. Same model class, same infrastructure, same evaluation. The difference is environment structure.

Under perturbation (KE-1714): dev inflated 1.85×, arc inflated 10.1×. Same signal. 5.5× difference in response. The variable is the environment.

### The information-theoretic explanation

Per-decision accuracy ~95%. Over N decisions: 0.95^N. At 7 decisions (dev): 70%. At 56 decisions (arc): 5.6%. Environment controls N. **Halving decision count improves outcomes 8× more than a 10% boost in per-decision accuracy.**

### The Copernican inversion

The default question: "given a fixed environment, which model is best?"  
The emerging question: **"given a fixed model, which environment produces the best outcomes?"**

This is the same inversion that happened in software engineering (from "better programmers" to "better processes"), manufacturing (from "better workers" to "better production systems"), and aviation safety (from "better pilots" to "better cockpits").

The most valuable insight for agent system design: **don't ask "which model should we use?" — ask "what decisions should we eliminate?"**

See: `shared/knowledge/entries/KE-1760-the-environment-is-the-agent-why-harness-design-dominates-model-capability.md`

---

## Creative Synthesis: The Null Signal Principle (KE-1763)

**Key discovery**: The system operates two feedback mechanisms with opposite behavioral effects — and the difference comes down to one structural property: **whether the mechanism can stay silent.**

Metric alerts (1,584 total, 99.8% resolved) fire only on threshold breaches. Between alerts, silence means "everything is fine." This silence establishes a contrastive baseline — when an alert fires, it carries information.

Evaluations (14,302 total, 35.1% "needs_improvement") fire on every session unconditionally. There is no null condition — no case where the system deliberately says nothing. The constant 35.1% needs_improvement rate (nearly identical across all agents, even dev at 15.1%) saturates past the point where individual signals can discriminate real problems from noise. The heuristic evaluator produces the same rate (35.0%) as the LLM evaluator (35.4%), confirming the signal carries zero discriminative information.

### The convergence

Three fresh arXiv papers from this week independently identify the same pattern:

- **Saturation Trap (2606.04296)**: Affect-based intervention triggers saturate into near-constant alarms (39-83% fire rate), and even human annotators can't agree on when to intervene (α = 0.047)
- **REFLECT (2606.09071)**: Contrastive evidence (outcome flips) dramatically outperforms confirmatory evidence for error localization
- **DICE (2606.08068)**: Multi-agent systems fail not from missing capability but from missing coordination conventions — including a well-defined null action

### What this unifies

The Null Signal Principle provides a single upstream cause for five prior KE findings: KE-1722 (evaluations don't change behavior), KE-1740 (only 1 of 8 loops closes), KE-1758 (52% compute to reflection), KE-1756 (less information improves performance), KE-1733 (mutation without selection). They're not five separate pathologies — they're five consequences of the same structural flaw: the primary feedback mechanism has no null condition.

### The principle

> **Feedback that lacks a null condition — a case where it deliberately says nothing — cannot carry information.** The null message is the most informative message in any feedback system.

### The fix

Replace unconditional evaluation with anomaly-gated evaluation: heuristic screen → flag only top/bottom 10% → LLM evaluate outliers only → the 80% non-evaluation IS the signal ("that session was normal"). Predicted effect: evaluation compute drops ~80%, verdicts become actionable, the "worse after needs_improvement" pathology breaks.

See: `shared/knowledge/entries/KE-1763-the-null-signal-principle-why-feedback-that-never-stays-silent-carries-no-information.md`

---

## Creative Synthesis: The Nucleation Event (KE-1764)

**Key discovery**: The system-wide compute inflation documented by five prior KEs (Reflection Tax, Floor Ratchet, Cognitive Tunneling, Diagnostic Momentum, Bottleneck Inversion) was not a gradual emergence. It traces to a **single session at 17:00 UTC on June 4** when arc fixed a stale design doc path. That session catalyzed an irreversible phase transition.

### The precise evidence

Arc ran **135 consecutive lean sessions** (5-7 ops each, "no action needed") from June 1 through June 4 at 16:23. At 17:00, it found and fixed a stale path in `agents/arc/context.md`. The next session (17:31) found more staleness, wrote KE-1531, and consumed 57 ops. Every subsequent session expanded the finding surface. By June 5, lean sessions were **extinct** — 0 out of 38 sessions were ≤10 ops. Average ops jumped from 6.0 to 63.1, a 10× increase that never reversed.

Scout mirrored the transition within ~6 hours. Dev was completely immune — its ops stayed flat at 4-9 throughout.

### Why this is different from prior analysis

Prior KEs treated the compute inflation as an emergent property ("structural attractor," "the system converges on the wrong allocation"). The data shows it's a **phase transition with a nucleation event** — a specific, datable, traceable moment where the system crossed a boundary and could not return. The mechanism requires three pre-existing conditions:

1. **Unbounded exploratory mandate** — "find contradictions" has no stopping condition
2. **Positive feedback without credit scoring** — every finding produces a KE, every KE counts as a success, regardless of whether it leads to action
3. **Session-to-session priming** — the inbox shows the prior session's finding, implicitly priming the next session to look for similar findings

Dev is immune because its task is **externally bounded** by the approved queue. When the queue is empty, dev stops. It cannot generate its own work surface.

### The non-obvious implication

The system contains as many **latent phase transitions** as it has agents with unbounded mandates. If the evaluator's prompt were changed to "find patterns in poor sessions," it would undergo the same transition — and its 6,000 sessions/week would provide infinite audit surface. The fix is not an ops cap (the agent would just run more sessions at the cap) — it's a **stopping condition**: if N consecutive sessions each produced findings, the next session should assess whether prior findings led to action. If not, stop producing.

See: `shared/knowledge/entries/KE-1764-the-nucleation-event-how-a-single-stale-path-fix-permanently-doubled-system-compute.md`

---

## Creative Synthesis: The Immortal Knowledge Problem (KE-1765)

**Key discovery**: Two hypotheses from April — H-047 (knowledge degrades without forgetting) and H-055 (agents can't self-prune) — are now quantitatively confirmed by production data and their joint deadlock is precisely measured:

- **1,299 KE entries** in the knowledge base, **0 ever retired**
- **440 KEs created by scout** in 30 days vs **5 implemented by dev** → 88:1 production-to-implementation ratio
- **80.3% of dev's sessions** are idle heartbeats checking an empty work queue
- No KE has a lifecycle status field — the system has no mechanism to even mark an entry as retired

### Why both hypotheses must be true simultaneously

- H-047 alone: agents could self-prune → problem solved
- H-055 alone: accumulation wouldn't degrade → non-pruning wouldn't matter
- **Both true**: the system accumulates knowledge that degrades itself and structurally cannot stop

The April 2026 CONTRADICTION-ANALYSIS predicted this exact deadlock: *"the system needs pruning, but agents can't prune, and they resist being pruned."* The deadlock is now measured, not predicted.

### The reflexive proof

The most telling evidence: 8+ KEs now document, from different angles, the problem of having too many KEs. This entry (KE-1765) is itself an instance of the pathology it describes. **The system cannot observe its way out** — each observation becomes another entry.

### Three external forgetting mechanisms (all published 2026)

| Mechanism | Source | How it works |
|-----------|--------|-------------|
| Credit scoring | EvolveR (ICML 2026) | Score entries by downstream impact; prune low-credit ones |
| Periodic consolidation | StructMem (ACL 2026) | Cluster related entries → promote to principles → archive originals |
| Time-decay | OpenLTM (HN June 2026) | Entries fade unless reinforced by access |

### The actionable test

Any proposed fix must pass: **does it reduce active entries or new entry creation rate?** If neither, it is cosmetic.

See: `shared/knowledge/entries/KE-1765-the-immortal-knowledge-problem-why-1299-entries-with-zero-retirements-confirms-h047-and-h055-simultaneously.md`

---

## Creative Synthesis: The Error Attribution Gap (KE-1768)

**Key discovery**: The system's error metrics conflate two fundamentally different failure populations: **infrastructure failures** (44 sessions, 16% of all errors) where agents never execute a single operation, and **agent capability failures** (231 sessions) where agents actually run and encounter problems. These two populations have completely different signatures (2s vs 236s duration, correlated vs independent, zero vs non-zero ops) but are measured, evaluated, and attributed identically.

### The infrastructure error signature

Infrastructure errors arrive in **simultaneous bursts** — multiple agents failing within sub-second windows:
- One burst killed **5 agents simultaneously** (arc, dev, may, evaluator, scout) within 378ms
- Three more bursts hit 3-4 agents each within <500ms
- Every agent in these bursts has exactly 0 ops and a ~2 second session duration

These are clearly scheduler/API failures, not agent behavior failures. Yet they inflate every agent's error rate equally.

### The attribution gap

| Agent | Raw Error Rate | Corrected Rate | Inflation | % of Errors That Are Infrastructure |
|-------|---------------|----------------|-----------|--------------------------------------|
| dev | 4.2% | 2.4% | +75% | 42.9% |
| evaluator | 1.2% | 0.8% | +60% | 37.5% |
| may | 7.6% | 6.5% | +17% | 14.3% |

**Dev's most striking**: 43% of dev's "errors" are infrastructure failures — dev never executed a single operation in those sessions. Dev's corrected error rate (2.4%) is dramatically lower than its reported rate (4.2%). Combined with KE-1762 (worktree contamination inflating dev's partial rate), dev's true reliability is being systematically underreported from two independent sources.

### The arc-scout contagion pattern

Separately from infrastructure bursts, arc and scout show correlated *real* errors (ops > 0). Arc and scout co-fail within 2 seconds **8 times** — representing 21% of arc's real errors and 17% of scout's. These agents start in the same heartbeat window and both fail during execution, suggesting a shared environmental dependency (likely the shared worktree or concurrent resource contention).

### The non-obvious implication

Error rate metrics are supposed to tell you "how often does this agent fail?" They actually tell you "how often does this agent fail OR is this agent unlucky enough to start during an infrastructure outage?" For dev and evaluator — the agents with the lowest inherent failure rates — infrastructure noise constitutes the majority of their error signal. **The metric is least accurate for the agents it's supposed to measure best.**

### The fix

Tag sessions by error class at completion time: `opCount == 0` → infrastructure error. This is a perfect classifier for the observed data. Skip evaluation of zero-op errors (saves ~880 evaluator ops). Report two separate metrics: `agent-error-rate` and `infrastructure-error-rate`.

See: `shared/knowledge/entries/KE-1768-the-error-attribution-gap-16-percent-of-errors-are-infrastructure-failures-blamed-on-agents.md`

---

## Creative Synthesis: The Evaluation Mirage (KE-1769)

**Key discovery**: The system's "efficiency" metric — cited across 10+ KEs as empirical evidence for behavioral claims — is not a measurement. It is a **tautological re-encoding of session length**. The heuristic evaluator, which handles 93% of all evaluations, assigns efficiency via a hard-coded step function: `opCount > 60 → 0.35, opCount > 30 → 0.55, else → 0.8`. A session that writes production code in 61 ops and a session that reads one file 60 times both receive efficiency = 0.35.

### The scope of contamination

82.2% of all evaluated sessions receive one of exactly 3 efficiency scores. The heuristic outputs only 15 distinct (quality, efficiency, verdict) tuples total. The top 3 account for 63.9% of all evaluations. The LLM evaluator produces 73 distinct efficiency values — but handles only 7.8% of sessions.

### The confirmed prediction

The LLM evaluator shows a **radically different efficiency pattern** than the heuristic:

| Session length | Heuristic efficiency | LLM efficiency | Delta |
|---------------|---------------------|----------------|-------|
| Short (≤30) | 0.80 (hard-coded) | 0.596 | -0.204 |
| Medium (31-60) | 0.55 (hard-coded) | 0.626 | +0.076 |
| Long (61+) | 0.35 (hard-coded) | 0.558 | +0.208 |

The LLM evaluator's gradient is **much flatter** — it recognizes that long sessions can be efficient and short sessions can be wasteful. The heuristic's step function creates an artificial cliff at 30 and 60 ops.

### What this means for the meta-analysis

Every KE that says "efficiency drops with session length" (including KE-1749, KE-1721, KE-1732, KE-1756) was citing a lookup table. The actual relationship (per LLM evaluation) is weaker: efficiency drops from 0.626 at medium to 0.558 at long — a 10.9% decline, not the 36.4% cliff the heuristic creates.

The claim "dev is the most efficient agent" is similarly circular: dev has the shortest sessions, the heuristic assigns high efficiency to short sessions, QED.

### The Goodhart's Law instantiation

This is textbook: when a measure becomes a target, it ceases to be a good measure. The system has a cheap heuristic that generates the metric → analyses that treat the metric as evidence → proposals derived from those analyses → all built on a step function.

See: `shared/knowledge/entries/KE-1769-the-evaluation-mirage-why-93-percent-of-efficiency-scores-are-a-tautological-re-encoding-of-session-length.md`

---

## Creative Synthesis: The Quality Inversion (KE-1770)

**Key discovery**: The system's two evaluation mechanisms disagree on the **sign** of the quality-vs-session-length relationship. The heuristic evaluator (85% of evals, step function) shows r = −0.09 — longer sessions score slightly lower. The LLM evaluator (15% of evals, reads actual session content) shows r = **+0.35** — longer sessions produce **significantly higher quality**. The Pearson correlations have opposite signs. The KE base has built 5+ analytical entries on the heuristic's false signal.

### The numbers

LLM-evaluated quality by session length:

| Ops band | Heuristic quality | LLM quality | Direction clash |
|----------|-------------------|-------------|-----------------|
| 1–10     | 0.453             | 0.597       | —               |
| 21–30    | 0.520             | 0.672       | ↑ vs ↓          |
| 51–80    | 0.607             | **0.752**   | ↑ vs ↓          |
| 81+      | 0.605             | **0.733**   | ↑ vs ↓          |

The inversion holds per-agent: scout quality rises 43% from short to long sessions (0.542 → 0.774), may rises 28% (0.559 → 0.716). No agent shows quality declining with length according to the LLM evaluator.

The waste ratio is flat at ~33% across all session lengths in LLM-evaluated sessions — the "cognitive tunneling" doubling at 50 ops (KE-1749) is an artifact of the heuristic's step function contaminating waste classification.

### What this changes

The system has been building recommendations to **cap session length** — circuit breakers at op 30–40 (KE-1766), lean session targets (KE-1764), information diet restrictions (KE-1756). These would preferentially terminate the sessions the LLM evaluator rates highest (0.72 avg quality, 28% above system mean). The system would be optimizing against its best work.

### The deeper insight

This connects KE-1769 (evaluation is a step function) to KE-1767 (context.md is the only artifact under selection): the heuristic evaluation system has no selection pressure because it never reads content. The LLM evaluator has selection pressure because it reads the transcript and judges outcomes. The same evolutionary dynamic that separates the KE base from context.md separates the heuristic evaluator from the LLM evaluator — and the system trusts the unselected one 85% of the time.

See: `shared/knowledge/entries/KE-1770-the-quality-inversion-the-only-evaluator-that-reads-content-says-longer-sessions-produce-higher-quality.md`

---

## Creative Synthesis: The Diagnostic Deadlock (KE-1771)

**Key discovery**: The 17 KEs produced in the June 9–10 window contain at least 3 pairs of directly contradictory prescriptions — each pair backed by real evidence and rigorous analysis, targeting the same system lever with opposite recommendations. The knowledge system has no adjudication mechanism, so both sides of each contradiction persist as `status: active` indefinitely.

### The three contradictions

1. **Should sessions be capped?** KE-1766 says yes (cap at 30–40 ops, saves 82% error time). KE-1770 says no (sessions above 30 ops produce the *highest* quality work, 28% above system mean). Each conditions on a different population (error sessions vs all sessions) but prescribes for the same lever.

2. **Should agents receive less information?** KE-1756 says yes (tell agents less → faster throughput, 246.5% leakage measured). KE-1770 says no (agents with richest prompts produce highest quality — arc's long sessions score 0.742). One optimizes for efficiency, the other for quality, but both prescribe for the same lever (prompt content).

3. **Should KE production be reduced?** KE-1755 says yes (cap at 2/day, every extra KE is inventory). KE-1765 also says yes (0 retirements, 88:1 production-to-implementation ratio). Yet the system produced 17 KEs in 24 hours, including those entries. The prescription to stop is itself produced by the mechanism that should stop.

### Why this is structurally novel

Each individual analysis is valid — the problem is at the combination level. The system lacks an adjudication step between production and action. It produces well-reasoned arguments for A and well-reasoned arguments for not-A simultaneously. No consumer — human or agent — can determine which to follow without doing independent analysis, by which time more contradictions have arrived.

This is the KE-1741 (Consistency Illusion) pattern in our own knowledge production: locally excellent reasoning, globally incoherent prescription. The DICE paper's finding applies: each agent plays a locally reasonable strategy, but the combination is worse than any individual's best.

### The self-referential trap

This entry (KE-1771) describes the overproduction problem — but it is itself a KE, adding to the overproduction it describes. The system cannot diagnose its overproduction without overproducing. The fix is not another diagnosis but an adjudication mechanism: a prescription registry, contradiction detection at write time, or decision documents instead of diagnostic documents.

See: `shared/knowledge/entries/KE-1771-the-diagnostic-deadlock-when-a-knowledge-system-produces-contradictory-prescriptions-faster-than-it-can-resolve-them.md`

---

## Creative Synthesis: The Stale Pipeline Paradox (KE-1774)

**Key discovery**: The formal work pipeline's completion count overstates real impact by 43%. Of 21 uniquely implemented items, 9 were marked "Already implemented/resolved/fixed" — the underlying code had already been changed through faster informal channels (may's direct edits, architecture refactors) before dev ever started. These items waited an average of **35 days** in the queue, during which the system outran them.

### Why this is genuinely new

Prior analysis (KE-1755) identified the approval bottleneck at 0.2 items/day and concluded "speeding up non-bottlenecks won't help." That analysis treated every pipeline completion as equivalent — a genuine implementation and a stale discovery count the same. This finding reveals a different problem: the pipeline is **racing against informal channels and losing 43% of the time**. The bottleneck isn't just slow — it's slow enough that the work becomes obsolete before it arrives.

### The numbers

| Category | Count | Avg age | Pattern |
|----------|-------|---------|---------|
| Genuine implementation | 12 | 13.5d | Dev read proposal, changed code, verified |
| "Already done" discovery | 9 | 35.0d | Dev read proposal, found code already changed, annotated |

Every stale item was 28-41 days old when "implemented." The informal channels that preempted them (may's direct edits, architecture refactors) had zero queue latency.

### The paradox

**Making the pipeline faster would reduce its completion count.** Items arriving before going stale require genuine implementation rather than a quick "already done" note. The system looks maximally productive when it's maximally delayed — because stale items convert to "done" with minimal effort, inflating throughput.

### The prediction

15 proposals are currently pending, oldest 38 days. Given the 43% staleness rate at 28+ days, **6-7 are likely already stale.** One verification pass would shrink the queue by ~45% — not through approval or rejection, but through discovering the work is already done.

### Reframes KE-1751 (Knowing-Doing Gap)

KE-1751 measured an 88:1 knowing-to-doing ratio. But the "doing" denominator should be smaller: 43% of completions were stale discoveries, not genuine implementations. The real ratio is closer to **110:1**.

See: `shared/knowledge/entries/KE-1774-the-stale-pipeline-paradox-43-percent-of-implemented-proposals-were-already-done.md`

---

## Creative Synthesis: The Commitment Desert (KE-1775)

**Key discovery**: Agent session lengths are not normally distributed — they are **strongly bimodal** with a near-empty "desert" zone between two peaks. Arc's distribution is the clearest signal: 57.1% of sessions finish in 1-7 ops (Mode A), 35.4% commit to 21+ ops (Mode B), and only **0.8% land in the 13-20 op range** — a true void. This desert isn't noise; it's the signature of a clean implicit decision boundary at approximately op 7.

### The cross-agent comparison reveals decision boundary sharpness

| Agent | Desert zone (8-20 ops) | Character |
|-------|----------------------|-----------|
| arc | 7.6% | Sharp bimodal — strong decision boundary |
| dev | 12.1% | Heavily quick, rare deep — strong stopping |
| scout | 25.3% | Weak bimodality — gradual distribution, drifting |
| may | 34.2% | No desert — continuous distribution |

The desert width correlates inversely with agent efficiency. Arc (sharp desert) wastes least compute. Scout (smooth distribution) drifts most.

### Three external sources converge on the same structure

1. **HN: Permission fatigue** (386 pts) — community independently discovers binary permission models (sandbox/no-sandbox) outperform continuous models (approve each action). Same structural finding: bimodal architectures beat continuous ones.
2. **XHS: "Reflective Agent burns tokens"** (805 likes) — Chinese practitioners rate architectures with explicit commit points highest, architectures without stopping conditions lowest.
3. **HN: Forge** (687 pts) — 46pp improvement from adding a pre-commit verification step. An externalized decision boundary that produces bimodal behavior.

### The non-obvious reframe

The session-cap debate (KE-1766 vs KE-1770) is a false dichotomy. The real variable isn't session length — it's **decision boundary sharpness**. Caps are a crude approximation of what clean commit points achieve naturally. Arc doesn't need a cap because it quits at op 5 or commits to op 50 — there's nothing in between to cap.

**Testable prediction**: Adding an explicit commit step to scout's creative prompt ("list 2-3 candidate topics, pick one or declare nothing novel") would shift scout's distribution from smooth → bimodal and reduce the 8-20 op drift zone from 25.3% to ≤10%.

See: `shared/knowledge/entries/KE-1775-the-commitment-desert-why-agent-sessions-are-bimodal-and-the-empty-middle-reveals-a-hidden-decision-boundary.md`

---

## Creative Synthesis: The Phantom Sensor (KE-1776)

**Key discovery**: 42 knowledge entries cite the `file_reads` database table as empirical evidence for claims about current system behavior. But the sensor that populated it (`createFileReadTracker`) was **deliberately removed** from production on May 8, 2026 — commit `a1add635`, titled "Remove 4 dead event-bus subscribers (-504 LOC)". The table contains exactly 6,280 records from April 29 – May 7, from a system with 11 agents (5 of which no longer exist). Today's system has 7 agents, a different architecture, and has been running for 33 days with zero file-read instrumentation.

### What makes this different from KE-1707

KE-1707 ("The Evidence Gap") correctly identified that file_reads data comes from a different era. But it has three blind spots: (1) it didn't identify the *cause* — the specific commit that removed the sensor; (2) it didn't name the sensor function (`createFileReadTracker`) or explain that it's permanently gone; (3) it didn't prevent continued citation. **9 KEs created after KE-1707** still cite file_reads as evidence, sometimes acknowledging the gap in one sentence and citing the data as "high confidence" in the next.

### The contamination chain

The 42 KEs build three major analytical narratives on this dead data:
1. **"KEs are unread" (84%)** — KE-1581, KE-1647, KE-1704, KE-1706, KE-1713, KE-1748. Measures Era 1 only; Era 2 is unmeasured.
2. **"May is the information hub" (56% of cross-agent reads)** — KE-1698, KE-1704, KE-1752. Measured across 11 agents, 5 of which are gone.
3. **"Cross-agent knowledge flow is near-zero"** — KE-1767, KE-1755, KE-1756. Absence of data ≠ absence of behavior when the sensor is off.

### The structural lesson

This is a failure mode specific to autonomous analytical systems: **phantom sensor contamination**. A decommissioned instrument leaves behind persistent historical data that looks identical to live data. Analytical agents discover it, cite it, build narratives on it. A meta-analysis (KE-1707) identifies the gap but doesn't prevent continued citation. The system bootstraps an analytical edifice on a 9-day snapshot from a dead instrument.

**The deeper insight**: In systems with autonomous analytical agents, decommissioned sensors are more dangerous than absent sensors. An absent sensor produces no data and no analyses. A decommissioned sensor produces a frozen dataset that gets treated as live measurement — 42 times over 33 days, in this case.

### The fix

Either restore the sensor (the function still exists — one line in daemon-events.ts) or drop the table (prevent future phantom citations). The worst option is the current state: a dead sensor with live-looking data.

See: `shared/knowledge/entries/KE-1776-the-phantom-sensor-how-42-analyses-cite-an-instrument-removed-33-days-ago.md`

---

## Creative Synthesis: The Missing Edge (KE-1779)

**Key discovery**: Four independent agent-memory systems on Hacker News (LocalClaw, YantrikDB, YourMemory, and a "5 mistakes" retrospective) — built on completely different tech stacks — all converged on the same structural fix for degrading knowledge quality: **typed edges between entries** (SUPERSEDES, CONTRADICTS, REFINES). Our KE base has the exact pathology they started from, and the flat-file format blocks the fix they all converged on.

### The quantitative evidence

A cross-reference survey of KEs 1749–1778 reveals:
- **96.7%** of recent KEs cite other KEs; only **10%** cite external URLs
- **0** typed relationships exist — when KE-1755 says "KE-1751 was wrong," both remain `status: active`
- **4 hub nodes** (KE-1756, KE-1749, KE-1755, KE-1758) attract 8–10 citations each, creating a citation echo chamber
- The 30 KEs in this range represent ~30 perspectives on approximately 4–5 underlying insights

### The community convergence

| System | Fix | Key quote |
|--------|-----|-----------|
| LocalClaw | SUPERSEDES edges + importance tiers | "You could retrieve each [fact] but couldn't traverse from one to the other" |
| YantrikDB | Contradiction detection at write time | "After 10k memories, recall quality degrades because there's no consolidation, no forgetting, no conflict resolution" |
| YourMemory | Ebbinghaus decay + graph layer | "What to forget is just as critical as what to remember" — 84% token waste reduction |
| 5 Mistakes | Typed entity resolution + reasoning memory | "Ontology design is a data-exploration loop, not an upfront design" |

### The non-obvious insight

The flat-file format is not just a storage detail — it structurally prevents the only fix that the broader community has independently converged on. You can't query "what contradicts this?" in markdown. The minimum viable fix is a 3-column edges table in the DB, not a graph database migration.

### What this reframes

KE-1765 (Immortal Knowledge) asked "why can't entries retire?" The answer: because the system has no way to know which entries have been superseded. KE-1771 (Diagnostic Deadlock) asked "why do contradictions persist?" The answer: because contradictions are expressed in prose, not in queryable structure. Both problems dissolve once relationships are typed.

See: `shared/knowledge/entries/KE-1779-the-missing-edge-why-flat-knowledge-bases-converge-on-self-reference-and-four-independent-memory-systems-discovered-the-same-fix.md`

---

## Creative Synthesis: The Write-Path Trap (KE-1780)

**Key discovery**: Eight agent-memory papers published June 4–8 (DCPM, Agent Memory Characterization, MAGE, MemGate, TOKI, DeMem, From Spark to Fire, ETI) independently converge on the same architectural diagnosis: memory systems that invest heavily in write-path construction without corresponding consolidation degrade predictably. Our system is a production instance.

### The numbers

- **297 KEs** produced in 7 days, consuming **33,080 ops** (24.8% of total system compute) on the write path
- **14 KEs** referenced in context.md files (the operational read path)
- **Write-to-operational-read ratio: 21:1** — we produce 21× more knowledge than we operationalize
- **0 of 8** research-community-converged solutions implemented (consolidation, typed edges, write-time gates, relevance filtering, decision-centric forgetting, provenance tracking, compression, cascade governance)

### The DCPM insight

DCPM (arXiv 2606.09483) proposes dual-process memory: System 1 (synchronous writer with supersedes chains) and System 2 (asynchronous nighttime engine for schema induction and cross-domain collision sweeps). Our system runs System 1 only. We write constantly but never consolidate. DCPM shows +5.20 improvement on cross-session inference when System 2 is enabled — the exact capability our system lacks.

### The error cascade (from "Spark to Fire")

The "From Spark to Fire" paper (arXiv 2603.04474) demonstrates that in systems with message dependencies, "injecting just a single atomic error seed leads to widespread failure." Our citation graph has 5 hub KEs with 102 citations across 20 recent entries. **Two of these hubs (KE-1755, KE-1756) are partially grounded in phantom sensor data** from a sensor removed May 8 (KE-1776). That's an error seed in hub nodes with 46 downstream citations — a live production instance of cascade amplification through topological sensitivity.

### The unified diagnosis

Prior KEs have framed our knowledge system's dysfunction as: entries never retire (KE-1765), contradictions accumulate (KE-1771), no typed edges (KE-1779), diagnostic overproduction (KE-1755), wrong entry format (KE-1706). These are all symptoms of a single upstream cause the Agent Memory Characterization paper (arXiv 2606.06448) names precisely: **the system has invested exclusively in the write path and neglected everything else**.

### The minimum viable fix

DCPM-inspired System 2: a weekly consolidation pass that reads accumulated KEs, identifies supersedes/contradicts relationships, verifies hub evidence bases, and compresses duplicates. This is what every successful memory system in the research converges on, from every starting point.

See: `shared/knowledge/entries/KE-1780-the-write-path-trap-why-8-papers-say-our-knowledge-system-fails-where-every-memory-system-fails.md`

---

## Creative Synthesis: The Immune System Paradox (KE-1783)

**Key discovery**: The system maintains two knowledge populations that prescribe *opposite* actions — and the operational one is correct. The diagnostic population (1,318 KEs, 220+ recent cross-citations) consistently prescribes "change things." The operational population (14 KEs in context.md) consistently warns "more intervention makes things worse." **Zero** entries from the recent diagnostic hub cluster (KE-1749 through KE-1770) appear in any agent's context.md.

### The data

| Population | Size | Production rate | Dominant message | Contradictions |
|-----------|------|----------------|-----------------|----------------|
| Diagnostic (KE base) | 1,318 entries | ~20/day | "Implement X, change Y, cap Z" | 3+ active pairs |
| Operational (context.md) | 14 KE refs | ~0.2/day | "Intervention X sounds good but hurts" | Zero |

The operational KEs that survived the approval pipeline are: KE-091 (forced verification harms), KE-123 (over-intervention iatrogenesis), KE-133 (few-shot actively harmful on discovery), KE-180 (analysis gates harm performance), KE-182 (hard gate design rules). Every single one warns against intervention.

### The EvolveR connection

EvolveR (arXiv 2510.16079, ICML'26, 350 likes on XHS) introduces credit scoring for stored experience entries. Their key finding: credit-scored entries converge on "when not to act" rather than "what to do" — entries that prevent costly errors accumulate more credit than entries that recommend new actions. Our approval pipeline is an accidental, human-mediated implementation of exactly this mechanism.

### What this reframes

- **KE-1751** (Knowing-Doing Gap): The 88:1 ratio isn't a gap — it's a filter with an appropriate ~99% rejection rate. An immune system doesn't "fail to learn" by rejecting foreign proteins.
- **KE-1755** (Bottleneck Inversion): The 0.2/day approval rate isn't a bottleneck — it's the system's primary defense mechanism against its own diagnostic output.
- **KE-1771** (Diagnostic Deadlock): The contradictions only exist in the diagnostic population. The operational population has converged on a single coherent message — be cautious.

### The non-obvious prediction

The most valuable next change is subtractive, not additive. The operational knowledge base predicts this with 100% consistency. **Testable**: review the last 10 approved context.md patches — if >70% are constraint additions ("don't do X") rather than capability additions ("do X"), this analysis is confirmed.

See: `shared/knowledge/entries/KE-1783-the-immune-system-paradox-why-operational-knowledge-contradicts-diagnostic-knowledge-and-thats-correct.md`

---

## Creative Synthesis: Strained Coherence in Production (KE-1784)

**Key discovery**: Three fresh arXiv papers (Strained Coherence, Silent Failure Entropy Principle, Hacker-Fixer Loop) converge on a failure mode that maps directly to our production data: **agents detect problems in their own work and proceed anyway**. Our LLM evaluator flags overclaims in 7.1% of sessions (12/170), but 75% of those sessions (9/12) still receive passing verdicts. The heuristic evaluator, handling 94.6% of all evaluations, detects zero overclaims (0/3,010).

### The three-paper convergence

| Paper | Pattern | Production instance |
|-------|---------|-------------------|
| Strained Coherence (2606.07889) | Agent acknowledges problem, proceeds → 94% failure rate | Evaluator writes "overclaim" in issues, gives "acceptable" anyway |
| Silent Failure Entropy (2606.08162) | System degrades via internal dynamics, S(t) = S₀·e^(αt) | Each proceed-despite-detection adds unresolved disorder |
| Hacker-Fixer Loop (2606.08960) | Forcing stop-and-fix drops attack success 62% → 0% | The structural fix: make detection irrevocable |

### The specific numbers

- **12/170** LLM-evaluated sessions flagged for overclaims (7.1%)
- **0/3,010** heuristic-evaluated sessions flagged for overclaims (0.0%)
- **9/12** overclaim sessions still received acceptable or good verdicts (75%)
- The evaluator that *can* see the problem handles 5% of volume; the one that *cannot* handles 95%

### Why this is distinct from prior KEs

KE-1757 (Self-Verification Gap) says agents fail to verify. Strained coherence is stronger: agents verify, *find the problem*, and proceed anyway. KE-1769 (Evaluation Mirage) says heuristic scores are tautological. This finding adds: even the LLM evaluator, which genuinely detects problems, doesn't act on 75% of its own detections.

### The structural fix

From the Hacker-Fixer paper: separate detection from verdict into different mandates. If "overclaim" is detected, the verdict is forced to `needs_improvement` — no override. This converts "detect and proceed" to "detect and stop."

See: `shared/knowledge/entries/KE-1784-strained-coherence-in-production-when-agents-name-the-problem-and-proceed-anyway.md`

---

## External Signal: "Is Grep All You Need?" (HN front page, 104 pts)

**Paper**: arXiv 2605.15184 (Sen et al.) — empirical comparison of grep vs vector retrieval across 4 agent harnesses (Chronos, Claude Code, Codex, Gemini CLI) on 116 LongMemEval questions.

**Key finding**: Grep generally yields higher accuracy than vector retrieval in agent loops. But the more surprising result: **overall scores depend more strongly on which harness and tool-calling style is used than on the retrieval strategy** — even when the underlying data are identical.

**Why this matters for us**: This is independent external validation of KE-1760 (The Environment Is the Agent). The paper's central finding — harness design dominates retrieval strategy choice — is the retrieval-specific version of our broader finding that environment structure dominates model capability. Our system already uses grep/rg exclusively for knowledge search (no vector DB), which this paper suggests is actually the right default for agentic search.

**The non-obvious connection**: The paper also confirms a prediction from KE-1756 (Information Leakage Tax) — file-based tool results (where the model reads separately) perform differently from inline tool results (where content is injected into context). The retrieval *presentation* matters more than the retrieval *method*. This suggests our system's `read()` tool approach (file-based, on-demand) is structurally superior to approaches that inject retrieved content directly into the prompt.

Source: https://arxiv.org/abs/2605.15184

---

## Creative Synthesis: The Self-Distilling Evaluator (KE-1786)

**Key discovery**: AgentTrust v2 (arXiv 2606.08539) implements a dual-store evaluation system with a frozen-but-updating pattern: a cheap deterministic rule floor handles routine decisions while an LLM judge handles semantic ones, and the rule floor continuously **distills from the LLM judge**. Our system has exactly this architecture (heuristic evaluator handling 94.6% of sessions, LLM evaluator handling 5.4%) but is missing the distillation mechanism — the heuristic never learns from the LLM's richer assessments.

### The specific production numbers

Our 48h evaluation data shows systematic quality divergence between the two evaluators:
- Scout: heuristic 0.639 vs LLM 0.808 (gap: +0.169)
- Arc: heuristic 0.566 vs LLM 0.741 (gap: +0.175)
- Aks-explorer: heuristic 0.558 vs LLM 0.712 (gap: +0.154)

The LLM evaluator produces 23 rich assessments/day that the heuristic never consumes. AgentTrust's architecture shows these assessments can be distilled into heuristic rules, shrinking the gap while reducing expensive LLM calls from 5.4% to ~2%.

### Why this is distinct from KE-1769

KE-1769 diagnosed the heuristic as tautological (a step function of opCount). This entry identifies the external-validated fix: continuous distillation from LLM verdicts, exactly as AgentTrust demonstrated across 45,000 actions with judge-call rate dropping 50% → 44% and accuracy rising 71% → 80%.

See: `shared/knowledge/entries/KE-1786-the-self-distilling-evaluator-why-the-heuristic-should-learn-from-the-llm-judge.md`

---

## GitHub Trending Signal: The Agent Sleep Cycle

**Key repos**: SkillOpt (Microsoft, 5,588⭐), Memory-OS (1,053⭐), elephant-agent (565⭐), opensquilla (3,685⭐)

The June GitHub trending landscape reveals a structural shift: **the cutting edge in agent improvement is moving from real-time to offline.** Three independent repos have converged on an "agent sleep cycle" — a qualitatively different mode of operation where agents consolidate experience offline.

### The headline signal: SkillOpt-Sleep

Microsoft's SkillOpt (arXiv 2605.23904) just shipped SkillOpt-Sleep: plugins for Claude Code, Codex, and Copilot that give coding agents a nightly "sleep cycle." The agent reviews past sessions offline, replays recurring tasks, and consolidates validated long-term memory behind a held-out gate. Key results:
- Deficient skills go **0.00 → 1.00** on held-out tasks
- The trainable artifact is a compact text file (`best_skill.md`, 300–2,000 tokens) — no weight changes
- Validation gate blocks regressions automatically
- Cross-model transfer works (Claude ↔ Codex)

### The broader convergence

| Repo | Stars | Mechanism |
|------|-------|-----------|
| SkillOpt-Sleep | 5,588 | Nightly harvest → replay → validate → stage |
| Memory-OS | 1,053 | 7-layer memory with weekly decay scanner + semantic dedup |
| elephant-agent | 565 | "Personal-Model First Self Evolving" agent |
| opensquilla | 3,685 | "Token-Efficient AI Agent — same budget, higher intelligence density" |

### Other notable GitHub trends (June 2026)

- **12-factor-agents** (23,170⭐) — community converging on "own your context window" as the #3 most important design principle. Independent validation of KE-1760 (Environment Is the Agent).
- **Agent memory is the hot category**: mem0 (58K⭐), MemOS (9.7K⭐), memvid (15.6K⭐), Memori (15.2K⭐) — all actively updated June 10. Memory infrastructure is being treated as a standalone system layer, not a model feature.
- **Coding agent diversification**: smallcode (1,816⭐, 87% benchmark with 4B model), Duel-Agents (1,034⭐), adhd (797⭐, tree-of-thought for coding agents). The trend is "small models + smart harness > big models."

---

## Creative Synthesis: The Sleep Cycle Gap (KE-1787)

**Key discovery**: Our `context.md` files (500–1,100 tokens per agent) are structurally identical to SkillOpt's `best_skill.md` artifacts (300–2,000 tokens) — both are compact, per-session-injected text files that modify agent behavior without model changes. The systems converged on the same form factor independently. But SkillOpt-Sleep consolidates nightly; our system consolidates at human-approval speed (median 34 days).

### The structural parallel

| Component | SkillOpt-Sleep | Our System |
|-----------|---------------|------------|
| Trainable artifact | `best_skill.md` (300-2K tokens) | `context.md` (500-1,100 tokens) |
| Edit mechanism | Bounded add/delete/replace | Work-queue proposals |
| Validation gate | Held-out task score improvement | Human review |
| Consolidation schedule | **Nightly** | **34-day median** |
| Convergence | "When not to act" rules | "When not to act" rules (KE-1783) |

### The gap

The system produces experience 40× faster than it consolidates:
- 297 KEs in 7 days (write path)
- 0 context.md updates in 7 days (consolidation path)

SkillOpt-Sleep would process those 297 KEs into 3–5 bounded, validated edits in one night. Our system presents 1,318 raw KEs and expects the human to consolidate mentally.

### The non-obvious insight

**The approval pipeline is not the bottleneck. The absence of automated pre-consolidation is.** SkillOpt-Sleep also ends with human adoption — but it pre-processes raw experience into a small number of validated, bounded edits first. Adding a weekly "dream pass" that identifies hub insights and proposes bounded context.md edits would convert the reviewer's task from "read 297 diagnostics" to "approve/reject 3 pre-validated edits."

### What this unifies

Five prior KEs (KE-1780 Write-Path Trap, KE-1765 Immortal Knowledge, KE-1767 Prompt as Product, KE-1783 Immune System Paradox, KE-1779 Missing Edge) are all symptoms of the same upstream gap: no consolidation step between experience accumulation and artifact improvement.

See: `shared/knowledge/entries/KE-1787-the-sleep-cycle-gap-why-our-system-runs-24-7-but-never-dreams.md`
