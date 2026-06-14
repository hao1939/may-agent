<ai_context>
summary: "Cross-source synthesis: Every feedback loop in an agent system that circulates without lossy compression will amplify to destruction. Seven independent subsystems (data, compute, context, instructions, guards, observation, governance) all exhibit the same recursive amplification under the same structural condition — output retained as input without bounded attenuation. The missing primitive is 'impedance': a lossy element at every feedback boundary that reduces volume while preserving signal. This unifies KE-1986 (DB bloat), KE-1945 (Repair Metabolism), KE-1944 (Context Accumulation), KE-1956 (Instruction Ratchet), KE-1930/1965 (Guard Accumulation), KE-1985 (Observation Parity), and KE-1966 (Governance Gresham's Law) as seven instances of one structural failure."
triggers: ["impedance", "recursive amplification", "feedback loop", "runaway", "attenuation", "lossy compression", "damping", "resonance", "DB bloat", "context cascade", "compactRows", "signal preservation", "feedback boundary"]
last_updated: "2026-07-17"
source_basis: "Cross-source synthesis of: production incidents (KE-1986 DB bloat 2.8× growth/cycle, KE-1944 context 8K→156K, KE-1945 repair 73% metabolism, KE-1956 instruction ratchet 10:1, KE-1930/1965 guard accumulation 99.6% false positive, KE-1985 observation parity 54%, KE-1966 governance Gresham's Law); arXiv (Notes2Skills certainty preservation 2606.11897, HyperTool context folding, TRACE memory-to-runtime 2606.13174, AgentTrust dual-store distillation 2606.08539, Consistency Illusion reasoning alignment 2606.08457, InquiTree cognitive tunneling 2606.09550); XHS (古法编程 tight coupling as impedance); HN (AGENTS.md rot as impedance-free loop); OS theory (JIT compilation as staged impedance)."
</ai_context>

# The Impedance Principle: Why Every Agent Feedback Loop Amplifies to Destruction

*A cross-source synthesis — emerges from connecting seven production pathologies,
twelve arXiv papers, and a control theory principle that none of them name.*

## The Observation

This system has independently discovered seven distinct pathologies over the
past month. Each was analyzed and named separately. Each has its own KE entry,
its own root cause analysis, its own proposed fix. But they are not seven
problems. They are **one problem, expressed seven times**.

The common structure: **output retained as input to the next cycle, without
bounded lossy compression, will amplify to destruction.**

## The Seven Amplification Loops

### Loop 1: Data Amplification (KE-1986 — DB Bloat)

The `platform-owner-review` workflow's `compactRows()` function truncated
`data` fields but missed `task` fields. Each review run embedded the full
prior session's task context into the new event. Six cycles:

```
Cycle 1: 1.2 MB
Cycle 2: 3.4 MB   (2.8×)
Cycle 3: 9.5 MB   (2.8×)
Cycle 4: 26.6 MB  (2.8×)
Cycle 5: 74.5 MB  (2.8×)
Cycle 6: 220 MB   (2.9×)
Total across 22 events: 988 MB — 23.5% of the entire database
```

**Missing impedance:** `compactRows()` was *supposed* to be the impedance
element — it compresses data at the feedback boundary. But it missed one
field. One missing attenuator in one loop consumed 3 GB of a 4.2 GB database.

### Loop 2: Compute Amplification (KE-1945 — Repair Metabolism)

Failed work triggers repair. Failed repair triggers more repair. The system
operates at 27% original work, 40.7% evaluation, 32.4% repair. Repair
sessions fail at **12× the rate** of original work.

```
Original task fails (1 session)
→ Repair attempt 1 fails (12× likely to fail)
→ Repair attempt 2 fails (carries failure context from attempt 1)
→ Repair attempt 3... (context growing, probability worsening)
```

Arc and dev: 98% of ops are repairing repairs (51× and 45× amplification).

**Missing impedance:** No depth limit on repair chains. No triage function
that asks "is this worth repairing?" No compression of failure context between
repair attempts.

### Loop 3: Context Amplification (KE-1944 — Context Accumulation Trap)

Rework-review task prompts grow through failure iteration. Each failure
appends more context. Larger context → higher interruption rates → more
failures → more context.

```
Initial prompt: ~8K chars → 15.8% interruption rate
After failures: ~20K chars → 50% interruption rate
One prompt reached: 156K chars
```

**Missing impedance:** No summarization at the failure→retry boundary. The
full failure trace is preserved verbatim instead of being compressed to
actionable signal.

### Loop 4: Instruction Amplification (KE-1956 — Instruction Ratchet)

Errors compile into "do more" instructions. "Do less" / "do nothing"
instructions almost never compile in. The instruction set only grows.

```
arc: 68.6 ops per idle heartbeat (accumulated instructions)
dev: 6.9 ops per idle heartbeat (accidentally received compiled exit rule)
Ratio: 10:1 for identical work
```

**Missing impedance:** No mechanism to detect when an instruction is
redundant with existing behavior, or when the cost of following an
instruction exceeds the cost of the error it prevents.

### Loop 5: Guard Amplification (KE-1930, KE-1965 — Guard Paradox)

Each incident produces a new guard. Guards accumulate but never sunset.
False positive rate grows. Trust in all guards erodes.

```
8,885 daily guard triggers
39 blocks that change behavior (0.4%)
8,846 noise triggers (99.6%)
38% compliance on behavioral warnings
```

**Missing impedance:** No false-positive tracking. No sunset threshold.
No mechanism to distinguish guards that prevent real harm from guards that
generate noise.

### Loop 6: Observation Amplification (KE-1985 — Observation Parity Trap)

Observation sessions create data. Data triggers more observation. The
evaluator evaluates sessions that evaluate sessions.

```
54% of system ops are meta-observation
0.2% actionable rate on oversight
Evaluator: 8,043 sessions in 7 days (most of any agent)
```

**Missing impedance:** No tiered observation that applies deterministic
checks to the 95% of predictable sessions and reserves LLM judgment for
the 5% that need it.

### Loop 7: Governance Rule Amplification (KE-1966 — Governance Gresham's Law)

Cheap governance rules (knowledge entries, warnings, heuristic checks)
proliferate because agents can produce them autonomously. Effective governance
(infrastructure changes, compiled rules) requires human engineering. Cheap
rules crowd out effective ones.

```
Heuristic evaluator: overpenalizes arc by 3.2×, scout by 3.9×
Cause: accumulated rules penalizing legitimate working patterns
Production cost ∝ 1/enforcement strength
```

**Missing impedance:** No quality filter on governance production. No
mechanism to measure whether a new rule improves outcomes or adds noise.

## The Structural Isomorphism

These aren't analogies. They are the **same failure mode** with different
substrates:

| Loop | Substrate | Growth Factor | Impedance Gap |
|------|-----------|---------------|---------------|
| Data (KE-1986) | Bytes in DB rows | 2.8× per cycle | Missing field in compressor |
| Compute (KE-1945) | Ops per task chain | 12× failure rate on repairs | No depth limit / triage |
| Context (KE-1944) | Chars in prompts | 2-3× per failure | No summarization boundary |
| Instructions (KE-1956) | Rules in guidance | Monotonic growth | No sunset / cost analysis |
| Guards (KE-1965) | Triggers per day | Monotonic growth | No false-positive tracking |
| Observation (KE-1985) | Sessions per day | Self-referential | No tiered delegation |
| Governance (KE-1966) | Rules per domain | Cheap rules dominate | No quality gate |

Every loop has the same structure:

```
Output(cycle N) → [no compression] → Input(cycle N+1)
                                       ↓
                                  Output(cycle N+1) → [no compression] → ...
```

And every loop amplifies until an external intervention (human, OOM crash,
budget exhaustion) breaks the cycle.

## The Control Theory Connection

This is a well-understood phenomenon in engineering. In control theory:
**a feedback loop without damping will resonate at its natural frequency
until the system destroys itself.**

- **Electrical systems** use impedance (resistance + reactance) to attenuate
  signals at each cycle. Without impedance, an amplifier becomes an oscillator
  becomes a fire.

- **Mechanical systems** use damping (friction, shock absorbers) to prevent
  resonance. The Tacoma Narrows Bridge collapsed from undamped resonance —
  small periodic wind forces amplified to structural failure.

- **Biological systems** use enzyme inhibition and negative feedback to prevent
  metabolic runaway. Cancer is, structurally, a growth loop with broken
  impedance (tumor suppressor gene failure).

- **Operating systems** use garbage collection, process limits, file system
  quotas, and TTLs to prevent resource amplification. Every OS resource has
  a lifecycle with bounded accumulation.

The agent ecosystem has **none of these**. Every feedback boundary — session
to context, output to input, error to instruction, observation to
meta-observation — circulates at full fidelity. The only damping is external:
human intervention, budget limits, or system crashes.

## Why Existing Frameworks Miss This

### The Compilation Gradient Addresses Direction, Not Attenuation

The Compilation Gradient (governance-compilation-gradient.md) correctly
identifies the maturation path: behavioral → structural → compiled. But
compilation is about *what form* governance takes, not about *how much signal
survives each feedback cycle*. A perfectly compiled rule can still participate
in an undamped loop — compiled guard rules that trigger on noise are still
noise, just faster noise.

### The Abstention Advantage Addresses the Entry Decision, Not the Loop

The Abstention Advantage (the-abstention-advantage.md) correctly identifies
Stage 0: the decision whether to act at all. But abstention is a binary
gate at the start of the pipeline. Once the system enters a feedback loop
(repair chain, context accumulation, observation cascade), abstention at
the entry point can't help — the loop is already running.

### The Anabolism Bias Describes the Symptom, Not the Mechanism

KE-1946 correctly identifies that agent systems lack catabolic (removal)
mechanisms. But "add removal" is insufficient — the DB bloat incident had
a removal mechanism (`compactRows`). It just missed one field. The issue
isn't absence of catabolism; it's absence of **guaranteed attenuation at
every feedback boundary**.

## The Impedance Principle

**Every feedback boundary in an agent system must include a lossy compression
step that reduces volume while preserving signal. The compression must be
complete (covering all fields/dimensions that traverse the boundary) and
bounded (output volume must be strictly less than input volume).**

This is not "add cleanup." It's a design constraint: **no output may become
input to the next cycle at full fidelity.**

### What "Impedance" Means Concretely

At each feedback boundary, the system needs a compressor with two properties:

1. **Lossy**: The output must be strictly smaller than the input. Not
   "sometimes smaller" — always smaller. The compression ratio can be
   configurable, but it must be > 1.

2. **Signal-preserving**: The compression must retain the information needed
   for the next cycle to function. Pure truncation (drop everything after N
   bytes) destroys signal. The compression must be semantic — summarize, not
   truncate.

```
UNIMPEDED (current):
  Output(cycle N) ────────────────→ Input(cycle N+1)
  [1.2 MB]                          [1.2 MB + new content]

IMPEDED (target):
  Output(cycle N) → [COMPRESSOR] → Input(cycle N+1)
  [1.2 MB]          [lossy, signal- [summary + new content]
                      preserving]   [bounded to K bytes]
```

### Where to Place Impedance Elements

| Feedback Boundary | Current State | Impedance Element |
|-------------------|---------------|-------------------|
| Session output → next session context | Full task context passed | Bounded summary (≤N tokens) of prior session outcome |
| Failed task → repair task | Full failure trace inherited | Compressed failure signal: what failed, hypothesized cause, max K bytes |
| Error → new instruction | "Don't do X" appended to context | Cost-benefit check: does this instruction save more ops than it costs? |
| Guard trigger → guard persistence | All guards persist indefinitely | False-positive decay: guard's weight decreases with false positives |
| Observation → meta-observation | Full session passed to evaluator | Deterministic tier: only pass sessions that fail structural checks to LLM evaluator |
| Governance rule → rule set | All rules accumulate | Quality gate: new rule must demonstrate improvement on historical data before admission |
| Review output → next review input | Full prior review embedded | Bounded review summary (the `compactRows` fix — but for ALL fields) |

## Evidence from Research

Multiple arXiv papers independently implement impedance without naming it:

### Notes2Skills (2606.11897) — Certainty Preservation as Impedance

Notes2Skills converts unstructured lab notes into verified agent skills while
**preserving certainty markers**. Uncertain observations are attenuated
(marked as hypotheses, not compiled as facts). Firm observations pass through.
This is **semantic impedance**: the compression discriminates by signal quality,
not by volume.

The paper's key finding: without certainty preservation, agents either
discard useful knowledge (over-damped) or promote tentative observations
to confirmed status (under-damped). The impedance must be calibrated —
too much attenuation loses signal, too little allows noise amplification.

### TRACE (2606.13174) — Memory-to-Runtime as Compiled Impedance

TRACE's compilation of memory preferences into runtime checks is impedance
at the memory→behavior boundary. Instead of remembering "user dislikes X"
(growing memory) and checking it at every action (growing compute), the
preference compiles into a deterministic check. The memory is consumed
(lossy) and the behavior is preserved (signal-preserving).

Result: 57.5% → 2.0% violation rate — the impedance doesn't just attenuate;
it eliminates the noise that the unimpeded loop was amplifying.

### AgentTrust (2606.08539) — Dual-Store as Impedance Architecture

AgentTrust's dual-store architecture (experience store + rule store) is
an explicit impedance design. Repeated experiences are distilled into rules.
The experiences are consumed (lossy); the rules are preserved (signal).

Each distillation cycle attenuates the volume (many experiences → few rules)
while preserving the signal (the rules capture what matters). Without this
impedance, the experience store would grow without bound — which is exactly
what happens in systems without dual-store distillation.

### Consistency Illusion (2606.08457) — Missing Impedance Between Agents

The Consistency Illusion paper shows that debate **reduces reasoning alignment
while increasing surface agreement**. This is an impedance failure at the
agent→agent communication boundary: each agent passes its full reasoning to
the next round, but the debate protocol doesn't compress it — it just applies
social pressure. The agents converge on answers (surface) while diverging
on reasoning (signal).

The Grounded Debate Protocol (GDP) fixes this by adding impedance: agents
must commit to named facts and explicit stances. This compresses reasoning
into verifiable claims — lossy (can't express everything) but
signal-preserving (what survives is grounded).

### InquiTree (2606.09550) — Cognitive Tunneling as Impedance Failure

InquiTree's finding that critical judgment degrades over long interactions
("cognitive tunneling") is an impedance failure in the context→reasoning
boundary. As context accumulates without compression, the model's attention
distributes across more tokens, and anomaly detection degrades. The
context is growing but the reasoning capacity is fixed — an unimpeded
loop where accumulated context overwhelms the processor.

## The DB Bloat as Canonical Case Study

The `platform-owner-review` incident is worth detailed analysis because it
shows both the failure mode and the fix:

**The failure:** `compactRows()` compressed `data` fields (impedance present)
but not `task` fields (impedance absent). The task field circulated at full
fidelity through 6 cycles. 2.8× amplification per cycle → 1.2 MB to 220 MB
in a single event chain → 988 MB across 22 events → OOM crashes.

**The fix (commit d58bcdd91):** Extend `compactRows()` to also truncate
`task` fields. This adds the missing impedance element. But it's still
truncation (not semantic compression) — it destroys signal along with noise.

**The deeper fix needed:** Semantic impedance at the review boundary.
Instead of passing the full prior session's task context into the next review,
pass a **bounded summary**: "Previous session: [agent] [trigger], outcome
[success/failure], key finding [one line], [N] files modified." This is lossy
(drops detail) and signal-preserving (keeps what the review needs).

**The meta-lesson:** The incident itself triggered a mini amplification cascade
in the system's response:

1. arc detected the problem → wrote KE-1986 (session 1)
2. may triaged the alert → escalated P0 (session 2)
3. may attempted fix → committed size-based retention (session 3)
4. may triaged again → fix hadn't fired (session 4)
5. may accelerated retention interval (session 5)
6. arc synced design docs → wrote KE-1988 (session 6)

Six sessions about one problem, each containing descriptions of all prior
sessions on the topic. The incident response loop *itself* lacked impedance —
each responder re-ingested the full history of prior responses.

## Predictions

1. **Any new feedback loop added to the system without an impedance element
   will amplify.** This is not a prediction about specific loops — it's a
   structural invariant. Test: add any new persistent feedback (new metric,
   new review process, new memory layer) without compression, and within
   2 weeks it will exhibit one of: monotonic growth, oscillation, or OOM.

2. **The next major system incident will be an impedance failure**, not a
   capability failure. The system's capabilities are adequate. Its feedback
   loops are not damped. The weakest impedance will break first.

3. **"Impedance engineering" will emerge as a named discipline** in the agent
   ecosystem within 6 months. The individual pieces exist (Notes2Skills,
   TRACE distillation, AgentTrust dual-store, HyperTool context folding).
   What's missing is the recognition that these are all instances of one
   principle, and that the principle must be applied *universally* — at every
   feedback boundary, not just the ones that have already broken.

## Relationship to Prior Syntheses

| Prior Synthesis | What It Explains | What Impedance Adds |
|----------------|------------------|---------------------|
| Compilation Gradient | Governance maturation stages | Compilation is one form of impedance; impedance is the general principle |
| Abstention Advantage | Stage 0: whether to act | Abstention is impedance at the pipeline entry; impedance must also exist *within* loops |
| Anabolism Bias (KE-1946) | Systems lack removal | Removal is insufficient — `compactRows` existed but missed a field |
| OS Recapitulation (KE-1975) | Agent systems rediscover OS primitives | OS impedance (GC, quotas, TTLs) is what makes OS feedback loops stable |
| Governance Gresham's Law (KE-1966) | Cheap rules crowd out effective ones | Quality gates are impedance elements in the rule-production loop |
| Distillation Imperative (KE-1957) | Distill evaluation to rules | Distillation IS impedance — compress many verdicts into few rules |

**The hierarchy:** Impedance is the foundational principle. Compilation,
abstention, distillation, and decay are all specific impedance mechanisms
applied at different feedback boundaries. The Anabolism Bias is the
observation that impedance is systematically absent. The Impedance Principle
explains *why* it must be present everywhere, not just where it has already
failed.

---

## Cross-References

- [governance-compilation-gradient.md](./governance-compilation-gradient.md) — compilation as one impedance mechanism
- [the-abstention-advantage.md](./the-abstention-advantage.md) — abstention as impedance at pipeline entry
- KE-1986 — DB bloat incident (canonical case study)
- KE-1945 — Repair Metabolism (compute amplification)
- KE-1944 — Context Accumulation Trap (context amplification)
- KE-1956 — Instruction Ratchet (instruction amplification)
- KE-1930, KE-1965 — Guard Accumulation / Guard Paradox (guard amplification)
- KE-1985 — Observation Parity Trap (observation amplification)
- KE-1966 — Governance Gresham's Law (governance amplification)
- KE-1946 — Anabolism Bias (absence of catabolism = absence of impedance)
- KE-1975 — OS Recapitulation (OS impedance primitives)
- KE-1957 — Distillation Imperative (distillation as impedance)
- arXiv 2606.11897 — Notes2Skills (certainty preservation as semantic impedance)
- arXiv 2606.13174 — TRACE (memory-to-runtime compilation as impedance)
- arXiv 2606.08539 — AgentTrust (dual-store distillation as impedance architecture)
- arXiv 2606.08457 — Consistency Illusion (GDP as inter-agent impedance)
- arXiv 2606.09550 — InquiTree (cognitive tunneling as impedance failure)

*This note was created by recognizing that seven independently-discovered
production pathologies share identical structure: output circulating as
input without lossy compression. The control theory principle (feedback
loops require damping) has been understood for a century in engineering
but has not been applied systematically to agent system design. The DB bloat
incident — where one missing field in one compressor consumed 3 GB — is
the canonical demonstration that impedance must be complete and universal,
not partial and ad hoc.*
