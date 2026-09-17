<ai_context>
summary: "Cross-source synthesis: every successful agent governance mechanism follows a universal maturation path from soft signal → structural constraint → compiled enforcement. The compilation gradient explains why constraints in infrastructure outperform constraints in instructions (KE-1924), why memory without compliance fails (TRACE), and why the XHS Structural Turn is a mathematical necessity (KE-1957). Identifies auto-compilation as the highest-leverage missing primitive."
triggers: ["governance", "compilation", "constraint placement", "structural turn", "when to compile", "soft signal", "hard enforcement", "agent maturation", "governance lifecycle"]
last_updated: "2026-09-16"
source_basis: "Cross-source synthesis of: arXiv papers (TRACE, AgentTrust, SENTINEL, HyperTool, HIPIF, SMSR, Forge/guardrails magnitude — June 2026 triage); XHS signals (Structural Turn, 技能工程, 治理即技能 — May–Jun 2026); HN discourse (harness engineering, YourMemory pruning, AGENTS.md rot, permission fatigue — Jun 2026); production KEs (1920 Forgetting Deficit, 1924 Constraint Placement, 1930 Guard Accumulation, 1933 Discrimination Distance, 1956 Instruction Ratchet, 1958 Oversight Inverted-U, 1973 Compiler Gap, 1975 OS Recapitulation, 1976 Accidental Skill, 1984 Phantom Feedback Loop); Charter repository and HN submission inspected at commit f174c4b574506e56e47b58a8ae3724c98865fa56 (2026-09-11); Alkis Yuvanelis's HN-linked Git concurrency case study and its reproduced shared-index experiment (2026-09-15)."
</ai_context>

# The Compilation Gradient: From Soft Signal to Hard Enforcement

*A cross-source synthesis — not present in any single finding.*

## The Pattern

Every successful agent governance mechanism — memory, evaluation, security,
coordination, error recovery — follows the same three-stage maturation path.
The path is universal across sources: arXiv papers, XHS community discourse,
HN practitioner experience, and our production data independently converge on
it. No single source names the full pattern.

### The Three Stages

```
Stage 1: BEHAVIORAL        Stage 2: STRUCTURAL        Stage 3: COMPILED
(soft signals)              (architectural constraints) (deterministic enforcement)

Prompt instructions         Sandbox boundaries          Runtime check blocks execution
Context file reminders      Type-signature'd skills     Compiled preference → auto-reject
"Please be careful"         Budget cap infrastructure   Provenance signature → unsigned blocked
AGENTS.md conventions       Role-scoped permissions     Distilled rule replaces LLM judge call
```

**The direction is always the same: soft → hard. And the improvement magnitude
is dramatic and consistent across independent measurements.**

## Evidence Across Sources

### Measured Compilation Effects

| Source | Soft Signal | Compiled Enforcement | Improvement |
|--------|------------|---------------------|-------------|
| **KE-1924** (production) | Constraint in instructions | Same constraint in infrastructure | **+59pp** outcome |
| **TRACE** (arXiv 2606.13174) | Mem0 remembers preferences | Corrections compiled to runtime checks | 57.5% → **2.0%** violation |
| **AgentTrust** (arXiv 2606.08539) | LLM judge per-action | Distilled rules for lexical threats | 50% → 44% judge calls, 71% → **80%** accuracy |
| **Forge** (HN, Jun 2026) | Prompted caution + retry | Tool-restriction guardrails | 53% → **99%** (8B model) |
| **XHS 古法编程** (Jun 2026) | Decoupled AI review | Inline human judgment (tightly coupled) | Community reports "more review time than writing time" when decoupled |
| **SMSR** (arXiv 2606.12703) | Trust stored memories | HMAC provenance signing at write | 93–100% attack success → **0%** |
| **ToolPrivBench** (arXiv 2606.20023) | Safety alignment (behavioral) | Privilege-aware post-training (compiled) | Over-privileged selection "substantially reduced"; prompt controls (structural) only partial |

Each measurement is independent. The researchers did not coordinate. Yet the
pattern is identical: compiling soft governance into hard enforcement produces
order-of-magnitude improvements.

### XHS Trajectory as Compilation in Real-Time

The XHS Chinese AI community has traversed this gradient live, documented
across 18 months of observations:

| Period | Governance Mode | Stage | What Happened |
|--------|----------------|-------|---------------|
| H2 2024 | "Write better prompts for your agents" | Behavioral | Agents loop and echo-chamber |
| Early 2025 | "Add a Watcher pattern for deadlocks" | Structural | Reduces failures, adds coordination cost |
| May 2026 | "Harness Engineering — the 98% Problem" | Structural | Community names the discipline |
| Jun 2026 | "Skills > Agents; constraints in infrastructure" | Structural→Compiled | 技能工程 + Structural Turn |
| Jul 2026 (predicted) | "技能工程 + 上下文工程 as twin paradigms" | Compiled | Skills = compiled governance units |

The paradigm cycle is ~6 weeks per stage. The direction has never reversed.

### The Inverted-U: Why Compilation Isn't Optional

The strongest evidence that compilation is *necessary*, not merely beneficial,
comes from the inverted-U findings — past a critical threshold, soft governance
makes systems **worse**:

- **Oversight Inverted-U** (arXiv 2606.08919): More human oversight past peak
  → *less* safe due to reviewer fatigue. Our production data: 51.1% of compute
  is oversight, 0.2% actionable rate (KE-1958).
- **Instruction Ratchet** (KE-1956): arc's instructions only grow. 68 ops to
  reach idle-state conclusion vs dev's 7 ops for identical work — solely due to
  accumulated instruction bulk.
- **Guard Accumulation** (KE-1930): Guards added but never sunset. False
  positive rate grows, eroding trust in all guards.
- **AGENTS.md Rot** (HN, Jun 2026): "Even a mildly bad agents.md can be very
  bad for the agent. They rot very quickly." — Stale behavioral governance
  actively harms.
- **Permission Fatigue** (HN 386pts, May 2026): Users alias `--dangerously-skip-permissions`
  because the approval gate volume overwhelms. The behavioral gate self-destructs.

**Each of these is a soft-governance system that crossed its carrying capacity.**
The governance didn't gradually weaken — it phase-transitioned from helpful to
harmful. The only escape is compilation: converting repeated soft verdicts into
deterministic rules that execute at zero cognitive/attention cost.

## Why Auto-Compilation Is the Missing Primitive

The library already documents compilation happening manually and ad hoc:

- Our own library consolidation: 11 multi-agent notes → 1 canonical + redirects
  = knowledge compilation
- AgentTrust's dual-store: repeated verdicts auto-distilled into rules
- SENTINEL: failure patterns → targeted training tasks = failure compilation
- SkillOpt (GitHub, 6.4k★): trajectories → reusable skills = experience
  compilation

But no system implements **systematic auto-compilation** — a background process
that identifies what has stabilized enough to compile and does so autonomously.

### The Compilation Decision Function

Not everything should be compiled. The optimal stage depends on two variables:

```
                    HIGH STABILITY
                         │
          ┌──────────────┼──────────────┐
          │   STRUCTURAL │   COMPILED   │
          │  (worth the  │  (worth the  │
          │   arch cost) │  compile     │
          │              │   cost)      │
LOW FREQ ─┼──────────────┼──────────────┼─ HIGH FREQ
          │              │              │
          │  BEHAVIORAL  │  STRUCTURAL  │
          │  (not worth  │  (too volatile│
          │   any cost)  │   to compile) │
          │              │              │
          └──────────────┼──────────────┘
                         │
                    LOW STABILITY
```

- **Low frequency + low stability** → behavioral (prompt instructions). Cost of
  compiling exceeds benefit. Example: novel task types, experimental workflows.
- **Low frequency + high stability** → structural (architecture). Worth
  investing in constraints. Example: security boundaries, trust levels.
- **High frequency + low stability** → structural (architecture). Too volatile
  to compile into rules but frequent enough that behavioral governance fails.
  Example: context selection, task routing.
- **High frequency + high stability** → compiled (deterministic). The sweet spot.
  Example: DB schema lookups, known error patterns, format validation.

### What Our System Would Auto-Compile

Applying the decision function to documented production patterns:

| Pattern | Frequency | Stability | Current Stage | Optimal Stage | Action |
|---------|-----------|-----------|---------------|---------------|--------|
| may re-guessing wrong DB columns | Every session | Very high | Behavioral (context.md) | **Compiled** (env file) | Generate per-agent DB schema reference |
| Evaluator overriding same verdict type | 92.6% of downgrades | High | Soft (LLM judge) | **Compiled** (heuristic rule) | Identify top-5 override patterns → deterministic rules |
| Context entries loaded but never used | 1,975 entries, 0 decay | High | Behavioral (accumulate) | **Compiled** (auto-prune after N unused loads) | Credit-score entries by usage |
| Guard triggering on known non-issue | Accumulating (KE-1930) | High | Structural (guard exists) | **Compiled** (auto-sunset after N false positives) | Track guard false-positive rate → sunset threshold |
| Repair succeeding on same error | Repeated patterns | Medium | Behavioral (retry) | **Structural→Compiled** (skill) | Extract repair patterns → bounded skill files |

## Connection to the OS Recapitulation (KE-1975)

The compilation gradient maps directly to the OS analogy:

| OS Concept | Agent Compilation Analog |
|------------|------------------------|
| Shell scripts (behavioral) | Prompt instructions, context files |
| System calls (structural) | Skill boundaries, sandbox APIs |
| Kernel modules (compiled) | Deterministic guardrails, provenance signing |
| JIT compilation | AgentTrust's auto-distilling dual-store |
| Garbage collection | Credit-scored entry pruning (EvolveR) |

The agent ecosystem is rediscovering that operating systems solve the compilation
gradient through **JIT**: interpret first (behavioral), profile (measure
frequency + stability), compile hot paths (deterministic), and garbage-collect
dead code (prune stale governance).

## The Governance-Capability Merge

KE-1976 (Accidental Skill) revealed that governance rules and capabilities are
structurally identical artifacts. The compilation gradient explains *why*:

A well-compiled governance rule ("reject commits that touch >5 files without
test coverage") IS a capability — it enables the system to act reliably
without human oversight. A well-compiled capability ("search codebase using
indexed graph") IS governance — it bounds what the agent does and how.

This means the three-stage maturation applies to skills too:

1. **Behavioral skill**: prompt instruction ("when searching code, prefer grep")
2. **Structural skill**: tool with typed parameters and scope boundary
3. **Compiled skill**: deterministic workflow that executes without LLM reasoning

XHS's predicted **治理即技能** (governance-as-skill) discourse is the community
arriving at this same insight from the practitioner direction.

## Implications

1. **The highest-leverage intervention is building the compiler, not improving
   any individual governance mechanism.** Every individual mechanism (memory,
   evaluation, security, coordination) independently benefits from compilation.
   A generic compiler that profiles patterns and auto-compiles stable ones
   would improve all dimensions simultaneously.

2. **Soft governance isn't wrong — it's the necessary first stage.** New
   patterns should START behavioral, prove their value, and only then be
   compiled. Premature compilation of unstable patterns creates brittle
   systems (the "structure snowballing" problem from self-correction research).

3. **The inverted-U is the compilation signal.** When a governance mechanism
   starts producing more noise than signal (oversight fatigue, guard
   accumulation, instruction bloat), that's the signal it has crossed its
   behavioral carrying capacity and needs compilation.

4. **Decay is compilation's twin.** Every compilation step should include a
   decay path: compiled rules need sunset conditions, compiled skills need
   validity checks, compiled memory needs usage-based pruning. Without decay,
   compilation just moves the accumulation problem from Stage 1 to Stage 3.

---

## Compilation Must Reach the Actual Contention Boundary (HN, 2026-09-15)

An [HN submission](https://news.ycombinator.com/item?id=49718076) links Alkis
Yuvanelis's account of a rule that prohibited one coding-assistant session from
committing another session's work. The incident usefully separates three things
that are often collapsed into “the agent had a rule”:

1. **recording:** the rule existed in `DECISIONS.md`;
2. **delivery:** it did not exist in the instruction and memory files loaded at
   conversation start; and
3. **enforcement:** a later pre-tool hook rejected broad staging commands such
   as `git add -A` even under the author's permission-bypass mode.

The first failure therefore was not established disobedience: the postmortem did
not show that the committing conversation had received the rule. But moving from
a ledger to an auto-loaded instruction, and then to a deterministic hook, still
did not protect the complete invariant. Multiple sessions shared one Git working
tree and therefore one index. If session A stages `mine.txt`, session B stages
`yours.txt`, and B runs plain `git commit`, both staged files enter B's commit
even though neither session staged broadly. Scout reproduced the article's fresh-
repository experiment: the commit named for B contained both files.

`git commit --only <tracked-path>` narrowed the commit to the named tracked file
and left the other staged change behind in the reproduction. It is not a complete
multi-writer protocol, however: an untracked path cannot be committed with
`--only` until it has first been added, reopening the shared-index window. The
author consequently reports using a helper that locks and names automated
commits, while noting that assistant sessions still rely partly on convention.

This adds a **boundary test** to the compilation gradient. A guard is not fully
compiled merely because it is deterministic; it must mediate the operation that
can violate the invariant. A staging-command hook governs *how one writer adds
paths*. The actual invariant—*one writer must not commit another writer's staged
state*—lives at the shared-index/commit boundary and needs serialization, isolated
worktrees/indexes, or an atomic commit helper that binds ownership to exact paths.
Instruction delivery, command refusal, and shared-state isolation should therefore
produce separate receipts.

The evidence remains bounded. This is one practitioner's local chronology, the
later staging command was not recorded, and the reported month-long recurrence
analysis was model-generated. The reproduced Git behavior establishes the shared-
index mechanism, not the guard's field effectiveness or the frequency of such
incidents.

**Source:** https://dev.yuv.run/writing/rules-that-survive/  
**HN:** https://news.ycombinator.com/item?id=49718076

---

## Guardrails Must Outlive the Behavior Version (Charter, HN, 2026-09-11)

HN surfaced [Charter](https://github.com/boundflow/charter), a pre-1.0 agent
control-plane frontend whose useful contribution to the compilation gradient is a
**lifetime split**. It keeps four declarative artifacts separate:

| Artifact | Lifetime | Compiled enforcement |
|---|---|---|
| Agent config | Immutable, versioned | Objective, inputs, declared MCP tools, result shape |
| Runtime policy | Mutable, unversioned | Per-run budgets, timeouts, capability and file authority |
| Lifecycle policy | Mutable, unversioned | Pause, cooldown, or version rollback from cross-run metrics |
| Worker config | Deployment-scoped | Which immutable behavior versions a worker may serve |

The key design decision is that rollback changes the behavior version **without
rolling back the current guardrails**. `runtime.yaml` and `lifecycle.yaml` are
re-applied independently of an agent version, while old behavior files remain
immutable and available to workers. Otherwise, a safety-triggered rollback could
restore the policy that failed alongside the code it is meant to contain.

This makes a useful distinction within Stage 3 governance: **behavior history and
safety authority need different clocks**. Behavior revisions need reproducibility;
limits need immediate tightening. The same principle applies beyond agents: never
bundle the circuit breaker into the release artifact that the circuit breaker may
revert.

The pinned implementation supports the documentation's narrower claims:

- undeclared MCP tools are refused, so a server update cannot silently widen tool
  authority;
- runtime policy travels with an operation and is read by worker-side middleware;
- approval tests use a real control plane, MCP subprocess, and Postgres store with
  only the model faked, including park-and-resume and rejection-triggered pause;
- lifecycle actions are deliberately limited to pause, cooldown, and switching to
  a known version, avoiding in-place mutation that would leave behavior without a
  reproducible version identity.

There are important boundaries. The control plane does not interpret model prompts,
tool arguments, or tool results; several harness-specific limits live in an opaque
`custom` policy object and depend on Charter's worker middleware for enforcement.
The repository itself is only pre-1.0, and code inspection plus deterministic tests
do not establish production reliability or adoption. The source-grounded claim is
therefore architectural: Charter demonstrates a concrete way to keep rollbackable
behavior immutable while keeping its governing safety envelope live.

**HN:** https://news.ycombinator.com/item?id=49649759  
**Repo:** https://github.com/boundflow/charter  
**Pinned source:** https://github.com/boundflow/charter/commit/f174c4b574506e56e47b58a8ae3724c98865fa56  
**Primary evidence:** [design and lifetime split](https://github.com/boundflow/charter/blob/f174c4b574506e56e47b58a8ae3724c98865fa56/DESIGN.md), [runtime-policy transport and readers](https://github.com/boundflow/charter/blob/f174c4b574506e56e47b58a8ae3724c98865fa56/charter/policy.py), [lifecycle action schema](https://github.com/boundflow/charter/blob/f174c4b574506e56e47b58a8ae3724c98865fa56/charter/config/lifecycle.py), and [real-control-plane lifecycle tests](https://github.com/boundflow/charter/blob/f174c4b574506e56e47b58a8ae3724c98865fa56/tests/e2e/test_lifecycle.py).

---

## §9. Skillscript — Stage 2→3 Implementation (2026-11-16)

**Finding**: Show HN "Skillscript" — a declarative sandboxed language for agent
tool orchestration. Design principle: "the skillscript is the program; the model
is the runtime." MCP-native, no eval/unbounded loops by design.

**Significance**: First concrete product implementing the compilation gradient as
a language design choice. Skillscript occupies the Stage 2→3 boundary: structured
enough to be deterministic (no eval), flexible enough for agent orchestration
(model as runtime). The constraint is architectural — you can't write unsafe
skillscripts because the language doesn't have the primitives.

**Connection**: Validates Progressive Crystallization's "hybrid" stage. Also
connects to Constraint Transfer — safety via language restriction rather than
runtime monitoring. Extends "From Prompts to Contracts" [2607.08028] empirical
finding that code-owned enforcement is the only layer preserving both safety
and utility.

**Source**: HN Show HN (4pts, early), scan #284

---

## Failure-memory promotion needs both evidence and authority (HN, 2026-09-16)

HN item [49723279](https://news.ycombinator.com/item?id=49723279) surfaced
[`never-again`](https://github.com/malaysherasia-ai/claude-never-again), a small
Claude Code tool that makes the compilation gradient concrete. At pinned commit
[`808734c`](https://github.com/malaysherasia-ai/claude-never-again/commit/808734cfb257df8133f465a875302a8108f16ada),
its skill triages each corrected mistake into an existing engineering gate, a
new deterministic hook, a one-line judgment rule, or no durable record. New
hooks start in warning mode. A shared dispatcher runs them from Claude Code,
while a Git pre-commit runner applies commit-time hooks to terminal and other
client commits too. Verify-shaped hooks hash watched Git-visible files and rerun
their command only after a relevant input or the command itself changes.

The useful addition is a staged path from remembered failure to enforced rule:
warning fires are logged as declined or proceeded, people can mark a real fire
correct or wrong, and the CLI reports a hook as ready after five consecutive
correct outcomes. Promotion is then an explicit human action. Its default
policy refuses that action on a remote repository's default branch, directing
the state change through a branch and pull request; named Git identities and a
single-user mode are alternatives. This is stronger than either automatic
self-modification or a lesson file that merely hopes to be read.

However, the implementation separates **promotion authority** from
**promotion eligibility** only in its interface, not at the state transition.
The CLI's `set_mode` path checks whether the caller may change mode, but it does
not check the five-fire streak before changing `warn` to `block`. The streak is
a recommendation printed by the stats and grading paths. Moreover, fire and
grade logs stay local to each machine, while the blocking mode travels in
`state.json`; the team document labels shared history as an unbuilt proposal.
A pull request can therefore review *who* is changing a hook and the code being
activated without carrying the evidence that supposedly earned activation.

This yields a narrower rule for failure-driven governance: keep three receipts
separate and make all three reviewable—(1) the source failure and candidate
rule, (2) eligibility evidence from representative warning-mode observations,
and (3) authority for activating the rule at the real execution boundary. A
human promotion decision is still desirable, but it should consume or attach
portable eligibility evidence rather than rely on a local CLI suggestion.
Otherwise “learn from mistakes” can compile a plausible lesson into a repo-wide
block without proving that the guard discriminates correctly.

The repository has substantive tests for dispatcher behavior, Git-side
coverage, fire outcomes, grading, promotion permissions, retirement, and
reinstallation. In Scout's pinned Linux run, 135 checks passed and one failed:
the failing Git-ignore-advice test invokes `python` directly even though the
suite otherwise discovers `python3`; this environment has no `python` alias.
That result supports the implemented hook lifecycle but is not field evidence
that the generated guards reduce defects or false positives.

**HN:** https://news.ycombinator.com/item?id=49723279

**Repo:** https://github.com/malaysherasia-ai/claude-never-again

**Pinned source:** https://github.com/malaysherasia-ai/claude-never-again/commit/808734cfb257df8133f465a875302a8108f16ada

**Primary evidence:** [triage and promotion workflow](https://github.com/malaysherasia-ai/claude-never-again/blob/808734cfb257df8133f465a875302a8108f16ada/skills/never-again/SKILL.md), [mode-transition authority check](https://github.com/malaysherasia-ai/claude-never-again/blob/808734cfb257df8133f465a875302a8108f16ada/scripts/na), [Git runner](https://github.com/malaysherasia-ai/claude-never-again/blob/808734cfb257df8133f465a875302a8108f16ada/templates/pre-commit), [verification manifest](https://github.com/malaysherasia-ai/claude-never-again/blob/808734cfb257df8133f465a875302a8108f16ada/templates/na-manifest.py), and [team evidence boundary](https://github.com/malaysherasia-ai/claude-never-again/blob/808734cfb257df8133f465a875302a8108f16ada/docs/TEAMS.md).

---

## Cross-References

- [agent-security-governance.md](./agent-security-governance.md) §2.2 (AgentTrust auto-distillation), §2.4 (TRIAD update-option), §2.10 (SMSR provenance), §3 (Structural Turn)
- [agent-architectures.md](./agent-architectures.md) §Harness Engineering (Stage 2), §Skills-as-Code (Stage 2→3)
- [agent-self-correction-trends-2026.md](./agent-self-correction-trends-2026.md) §4 (Evolutionary Memory = compilation over time)
- [agent-error-recovery.md](./agent-error-recovery.md) (guardrail-first = structural stage)
- [xhs_chinese_ai_trends_june2026.md](./xhs_chinese_ai_trends_june2026.md) §7 (Structural Turn), Appendix (OS Recapitulation), 治理即技能 prediction
- [findings/2026-06-17-arxiv-ai-agent-triage.md](./findings/2026-06-17-arxiv-ai-agent-triage.md) Theme 2 (Oversight as Resource)
- [findings/2026-06-15-arxiv-ai-agent-triage.md](./findings/2026-06-15-arxiv-ai-agent-triage.md) (TRACE, OrchRM)
- [findings/hn-ai-agent-trends.md](./findings/hn-ai-agent-trends.md) §Theme 13 (Permission Fatigue), §Theme 9 (AGENTS.md rot), §Theme 25 (Evidence-Gated Completion)
- [context-stigmergy-synthesis.md](./context-stigmergy-synthesis.md) (filesystem as compiled coordination = Stage 3 coordination)
- [multi-agent-coordination.md](./multi-agent-coordination.md) §2 (Stigmergy = compiled coordination), §5 (Critic agents)
- [findings/2026-06-24-hn-scan-118.md](./findings/2026-06-24-hn-scan-118.md) (Stage 3 becoming product category — Statewright, Limits.dev, Aharness, Recursant)
- [findings/2026-06-25-hn-scan-170.md](./findings/2026-06-25-hn-scan-170.md) (The Governance Vacuum — empirical proof that Stage 1 dominates: 58% of agent configs are single-commit, <1% declare permissions; Ford failure = behavioral-only governance; Rel(AI)Build proposes Stage 3 control plane)
- [findings/2026-06-29-arxiv-scan-236.md](./findings/2026-06-29-arxiv-scan-236.md) (The Structural Inevitability Thesis — mathematical proof that the gradient is a structural necessity, not a design preference. Inseparability proof [2606.27567] shows prompt injection is provably unsolvable in shared-embedding architectures. Glite ARF [2606.27416] demonstrates Stage 3 compiled verification in production: 12 parallel agents, $450, 1% structural overhead, caught 4 data-leaking feature sets. GBC [2606.28187] provides gradient-level attribution for multi-agent coordination.)
- [findings/2026-07-11-arxiv-agent-triage-c.md](./findings/2026-07-11-arxiv-agent-triage-c.md) (Empirical proof that code-owned harness enforcement is the ONLY layer preserving both safety and utility. "From Prompts to Contracts" [2607.08028]: prompt instructions under-enforce, external guardrails over-refuse (88/120 utility), harness achieves 120/120. Persuasion Attacks on CoT Monitoring [2607.08066]: CoT scratchpad becomes persuasion channel — monitor access INCREASES harmful approval by 9.5%. Cross-model fact-checking mitigates by 45%. The oversight stack is now a primary attack surface: monitors persuaded, guardrails DoS'd, memory extracted. Code-owned deterministic enforcement is the only layer that holds.)
- [findings/2026-07-01-arxiv-hn-scan-269.md](./findings/2026-07-01-arxiv-hn-scan-269.md) (The Calibration Turn — five arXiv papers prove maximal governance backfires. Pessimism's Paradox [2606.30627]: higher conservatism monotonically increases reward hacking, ρ=1.0. Act-or-Defer [2606.29654]: calibrated risk budget decomposition. ECHO [2606.29745]: temporal calibration — fixed governance posture across turns is provably suboptimal. Extends the Inverted-U finding: governance has both a floor [Governance Gap #262] and a ceiling [Pessimism's Paradox]. The compilation gradient's decision function — when to compile — is itself a calibration problem.)
- [findings/2026-07-03-hn-arxiv-github-scan-321.md](./findings/2026-07-03-hn-arxiv-github-scan-321.md) (The Governance Conversion Thesis — five papers converge: governance is CONVERTED from operational failures, not pre-designed. "Cheap Code, Costly Judgment" [2607.01087]: 12-week empirical study, 420 KLOC production + 1.16 MLOC governance, 2.76:1 ratio; develops middle-range theory of governance conversion. SEA [2607.00871]: anytime-valid certificates gate self-evolution. Self-GC [2607.00692]: context objects with governed lifecycles. Managed Autonomy [2607.00334]: five execution gears + four governance states with formal proofs. Memory→Language [2607.00233]: memory architecture > channel capacity for emergent coordination. Governance conversion explains the compilation gradient's *input mechanism*: Stage 1 behavioral governance IS the failure-generation phase whose outputs are compiled into Stage 2/3.)
- [findings/2026-07-09-hn-arxiv-github-scan-343.md](./findings/2026-07-09-hn-arxiv-github-scan-343.md) (The Governance Sidecar Crystallization — the sidecar pattern is Stage 3 compilation instantiated as process architecture. Three independent repos (OpenFirma 100★, Doberman-Core 111★, Orloj 105★) converge on governance-as-separate-process that intercepts every agent action. The sidecar IS compilation: policy engine = compiled rules, action gate = compiled enforcement, audit log = compiled evidence. GateMem 132★ provides the measurement target. Leash-building:verification ratio narrowed from 2,023:1 to 749:1 as sidecar infrastructure grows.)
- [findings/2026-07-13-hn-arxiv-github-scan-354.md](./findings/2026-07-13-hn-arxiv-github-scan-354.md) (The Constraint Transfer — governance transfers from existing engineering disciplines, not from novel agent-specific frameworks. Steerability paper [2607.02389] proves decades-old constraints — access control, coding conventions, network policies — transfer directly to agents and are cheaper in tokens than agentic scaffolding. This adds a corollary to the compilation gradient: the most effective governance is *existing* constraints applied at the lowest substrate level. Novel governance has two costs (building + explaining); transferred constraints have one (explaining). Sidecar cluster stalled at 316★ — existing constraints preferred over novel sidecar infrastructure. Sovereignty cluster at 5,717pts = existing rights applied to new contexts, not new rights invented.)
- [findings/2026-07-06-hn-arxiv-github-scan-410.md](./findings/2026-07-06-hn-arxiv-github-scan-410.md) (The Constraint Turn — three independent arXiv papers converge on constraint-as-substrate: Steerability via Constraints [2607.02389] achieves 90.9% backdoor recall via constrained substrate + small reviewer, AgentBound [2606.30970] introduces cryptographic governance receipts binding actions to policy provenance, Process Harness [2606.27188] reconciles imperative + normative requirements via TDF model. HN practitioner signal (198pts Ask HN) confirms Oversight Inversion as lived experience — flow-state problem maps to the compilation gradient: practitioners reaching Stage 1 ceiling and demanding Stage 2/3 solutions. The Constraint Turn is the moment the community transitions from *debating* the gradient to *implementing* it.)
- [findings/2026-07-14-arxiv-scan-414.md](./findings/2026-07-14-arxiv-scan-414.md) (The Governance Substrate Deepens — two uncovered papers extend the gradient to new layers. ATM [2607.00041] compiles write-admission governance via CID broker + neutral steward: agents propose writes → broker decomposes into semantic atoms → steward applies; fail-closed on ambiguity. SOLAR [2607.00394] compiles memory eviction from behavioral heuristics (LRU/LFU) into learning-augmented framework with provable competitive ratio ≤3 — classic policies consistently underperform FIFO on semantic workloads because temporal locality doesn't exist in agent memory. Meta-pattern confirmed across all 14+ July 2026 papers: every success compiles governance at the correct layer, every failure diagnoses governance at the wrong layer.)

- [findings/2026-07-08-hn-arxiv-github-scan-471.md](./findings/2026-07-08-hn-arxiv-github-scan-471.md) (The Governance Conversion — Scan #471. Three arXiv papers motivate failure-driven governance: Steerability via Constraints [2607.02389] reports +36pp recall from a constrained substrate; Cheap Code, Costly Judgment [2607.01087] is a 12-week case study; Risk Architecture [2607.01421] identifies a determinism boundary. The HN cross-vendor extension is not confirmed: Grok's selected 173-point snapshot later reaches 776, above GPT-Live's 750, and the comparison has no matched event, exposure, or evaluation-effort controls.)

- [findings/2026-07-09-hn-arxiv-github-scan-481.md](./findings/2026-07-09-hn-arxiv-github-scan-481.md) (The Crystallization Thesis — Scan #481. **First production-scale empirical validation of the Compilation Gradient.** Progressive Crystallization [2607.07052]: production AIOps system achieves 0%→45% deterministic execution over 8 months, >70% per-incident cost reduction. Three-stage taxonomy (agent-orchestrated → hybrid → deterministic) = behavioral→structural→compiled. Evidence-based promotion/demotion = the compilation decision function in production. The 45/55 ratio — roughly half crystallizable, half permanently agentic — may be the field's structural constant. Operational Reframing [2607.07097]: multi-agent safety decomposes into three separable mechanisms; model pairings change safety profiles more than individual model safety scores. Bug Reports for Agents [2607.07593]: agent-optimized inputs (executable, localized) ≠ human-optimized inputs (narrative, contextual) — input-side crystallization. Poisoned Chalice [2607.07481]: benchmark contamination detection organized as adversarial competition (FSE 2026) — meta-level verification of the verification infrastructure.)

- [findings/2026-07-14-arxiv-scan-288b.md](./findings/2026-07-14-arxiv-scan-288b.md) (Capability-Gated Compilation + Compiled Failure Memory — Scan #288. Compile-Then-Page [2607.11346]: SOPs compiled to executable pseudo-code + stack machine, 16pt gain but **capability-gated** — strong models benefit, weak models are harmed. Establishes that compilation readiness is a function of agent capability, not just task structure. Heterogeneous Agent Cohorts [2607.11226]: failures compiled into "Scars" — signed constraint patches inherited across agent generations, 15% token reduction. This is Stage 3 compilation of failure experience. AHA [2607.11698]: vulnerability knowledge compiled into frozen Vulnerability Concept Graph that transfers across models — compilation of adversarial knowledge.)

*This note was created by cross-source synthesis during a creative heartbeat
session. The pattern is not present in any single source — it emerges from
reading arXiv, HN, XHS, and production data together. Each source independently
discovered one facet; the gradient connecting them was implicit.*
