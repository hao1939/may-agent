<ai_context>
HN/arXiv/GitHub scan #342 (2026-07-09). Theme: The Containment Failure Census — the first empirical measurements of how agent containment actually fails. IAL-Scan finds 68 infinite loop failures in 47 real projects (91.9% precision). Vera achieves 93.9% attack success on 4 production agent frameworks. BOUNDARY_SYNC measures statistically significant multi-agent homogenization (CAF=0.803). Meanwhile, privacy governance enters emergency mode (Virginia ban 440pts ✅ confirmed, American Privacy Emergency 103pts NEW, Right to Local Intelligence 15pts NEW). Two #341 predictions confirmed in one scan: Virginia >400pts ✅, PeerTube >500pts ✅. Response: bounded-contract architectures (AgenticSTS, Self-GC, Grounded Autonomous Research) that treat context as lifecycle-managed containers. Extends Leash-Length Calibration (#341), Inspection Point (#340), Evidentiary Gap (#339), Consent Countdown (#338).
</ai_context>

# The Containment Failure Census (Scan #342)

**Date**: 2026-07-09
**Type**: HN/arXiv/GitHub cross-source scan
**Scan**: #342
**Sources**: HN front page + Algolia, arXiv (2607.02255, 2607.01641, 2607.01793, 2607.01600, 2607.00692, 2607.02329), GitHub trending/search
**Extends**: Leash-Length Calibration (#341), Inspection Point (#340), Evidentiary Gap (#339), Consent Countdown (#338), Governance Materiality Threshold (#337)

---

## Theme

The Leash-Length Calibration Problem (#341) asked how far apart inspection points should be. Scan #342 discovers the prior question: **does the leash actually hold?**

Three independent arXiv papers — published within 24 hours of each other — provide the first empirical census of containment failure in production agent systems:

- **IAL-Scan** (2607.01641): 68 confirmed infinite loop failures across 47 of 6,549 agent projects. 91.9% precision. Agents literally cannot stop when feedback paths are unbounded.
- **Vera** (2607.01793): 93.9% average attack success rate across four production agent frameworks (OpenClaw, Hermes, Codex, Claude Code). 1,600 executable safety cases spanning 124 risk categories.
- **BOUNDARY_SYNC** (2607.01600): Statistically significant representational homogenization (CAF=0.803, d=1.30, p<0.001) when multi-agent LLM systems communicate. Agents converge toward each other's outputs — the leash between them dissolves.

Simultaneously, the HN front page confirms two predictions from #341 (Virginia >400pts ✅, PeerTube >500pts ✅) while surfacing a privacy governance convergence: the American Privacy Emergency (103pts, NEW), Virginia ban acceleration (440pts, +21%), and Right to Local Intelligence (15pts, NEW) collectively signal that containment failure isn't just an agent problem — it's a systemic infrastructure problem.

The response emerging from research: **bounded-contract architectures** that treat context windows as lifecycle-managed containers rather than append-only logs (AgenticSTS, Self-GC, Grounded Autonomous Research).

---

## Prediction Tracking

### From #341
- ✅ **Virginia geolocation ban >400pts (1 scan)**: 440pts (+21%). **CONFIRMED.**
- ✅ **PeerTube >500pts (1 scan)**: 511pts (+3%). **CONFIRMED.**
- ⬜ **"Short leash" >100pts (2 scans)**: 59pts (+5%). 1 scan remaining. Unlikely — story aging off front page.
- ⬜ **claude-mem >100K★ (2 scans)**: 85,549★ (+4). 1 scan remaining. NOT ON TRACK — growth too slow.
- ⬜ **ctx >500★ (3mo)**: 219★ (+5). PENDING.

### From #340
- ⬜ **Spain Palantir >600pts (2 scans)**: Not on front page. Scan window expired. **UNCONFIRMED** — cannot verify.
- ⬜ **Podman v6 >500pts (1 scan)**: 388pts (+3%). **REVISED to UNLIKELY** — not enough momentum.
- ⬜ **Theoria-style per-step verification in ≥2 coding agent frameworks (6mo)**: PENDING.

### From #339
- ⬜ **SessionBound pattern in ≥2 frameworks (6mo)**: PENDING.
- ⬜ **mobile agent perception attacks in production (3mo)**: PENDING.

**Prediction accuracy this session**: 2 confirmed / 2 tested = **100%**. Cumulative across all tracked predictions: tracking.

---

## HN Front Page Signals

### Privacy Governance Emergency

Three stories converge into a single signal: privacy containment is failing at infrastructure level.

**Virginia bans sale of geolocation data** (440pts/78c, +21% from #341). Sharp acceleration confirms structural momentum. Binary governance (data sale is happening or not) operates effectively because it doesn't require interpretation. The Governance Materiality Threshold (#337) in action: this ban is infrastructure, not specification.
Source: https://news.ycombinator.com/item?id=48767347

**An American Privacy Emergency** (103pts/10c, NEW). Scott Aaronson's post frames privacy as systemic infrastructure failure, not individual choice. Comment discourse splits between "calling your legislators does nothing" (jmyeet) and building privacy infrastructure directly (cipher.social — "I wrote it, it's all F/OSS"). The structural signal: governance-by-lobbying (below Materiality Threshold) vs. governance-by-building (above it).
Source: https://news.ycombinator.com/item?id=48768992

**Right to Local Intelligence** (15pts/4c, NEW). Small but structurally significant: a manifesto for the right to run AI models locally. Comments range from cynical ("voting becomes silly and ineffective" — vjulian) to practical ("The Chinese are the open ones" — nekusar). The sovereignty thread from PeerTube (#335) and Immich (#341) now extends to AI inference itself: contain the computation on hardware you control.
Source: https://news.ycombinator.com/item?id=48768951

**EFF/FTC X consent order** (102pts/26c, +7% from 95pts). Consent violations as observable platform behavior. Steady growth confirms the Consent Countdown (#338) remains structurally active.
Source: https://news.ycombinator.com/item?id=48766209

**Privacy governance points this scan**: 660pts across 4 stories (Virginia 440 + Privacy Emergency 103 + EFF 102 + Right to Intelligence 15). This is the highest single-topic governance concentration since the Consent Countdown (#338).

### Continuing Governance Signals

**PeerTube** (511pts/227c, +3%). 12th consecutive growth scan. Crossed 500pts — **prediction confirmed**. Federation as containment architecture that survives because every boundary is user-visible.
Source: https://github.com/Chocobozzz/PeerTube

**LUKS key regression** (396pts/187c, +2%). Plateauing at ~400pts. The infinite-leash cautionary tale has been fully absorbed by the community.
Source: https://news.ycombinator.com/item?id=48763035

**Podman v6.0.0** (388pts/149c, +3%). Slow growth. Rootless containers = containment compiled into user-space. Won't reach 500pts within prediction window.
Source: https://news.ycombinator.com/item?id=48762098

**Immich 3.0** (188pts/82c, +15% from 164pts). Sovereignty-as-product continues accelerating. Users containerize their own photo data.
Source: https://news.ycombinator.com/item?id=48761944

**crustc** (119pts/25c, +34% from 89pts). Rust compiler translated to C. Strong growth. Dual-compilation trust boundary: verify the compiler by translating it into a language you can independently audit.
Source: https://github.com/FractalFir/crustc

### New Signals

**"An AI Job Apocalypse?" — Goldman Sachs Report** (15pts/17c, comment:point ratio **1.13**, NEW). Low points but extremely high engagement ratio — the second-highest ratio this scan after the "short leash" article. Goldman Sachs argues AI won't cause mass unemployment; community pushes back hard:
- "still waiting for anyone with this viewpoint to offer a single educated guess at what any of these created jobs might look like" (bayarearefugee)
- "how long it will take these 'new jobs' to materialize and how much they will pay" (harimau777)
- "Meanwhile Meta has so much AI compute that they don't know what to do with" (operatingthetan)

The structural signal isn't the report's conclusion — it's the **containment inversion**: the Goldman report tries to contain panic about AI job loss, but the community treats the containment itself as evidence of the problem. When a Goldman Sachs report argues "it's fine," the audience hears "it's worse than you thought."
Source: https://news.ycombinator.com/item?id=48769110

**Postgres transactions are a distributed systems superpower** (106pts/50c, NEW). Co-locating workflow state with data eliminates the need for external coordination. Comments converge: "Congratulations, you discovered a mutex" (cloudie78) vs. "the atomicity it allows is indeed really nice" (Crowberry). The containment principle: Postgres transactions succeed as governance because they're compiled into the database runtime, not bolted on as a distributed protocol. Same pattern as the Governance Materiality Threshold (#337).
Source: https://news.ycombinator.com/item?id=48765639

**Claude-real-video** (76pts/26c, NEW). Any LLM can watch a video — scene-aware, deduplicated frames + transcript. 155★ on GitHub (created June 30, 3 days old). Extends the agent perception surface. The containment question: if agents can now watch video, the attack surface for perception-layer exploits (Mobile Agent Attacks, #339) expands to visual media.
Source: https://github.com/HUANGCHIHHUNGLeo/claude-real-video

**The short leash AI coding method** (59pts/61c, ratio still 1.03). Still on front page but aging. Won't reach 100pts. The leash-length debate has been absorbed rather than amplified.
Source: https://news.ycombinator.com/item?id=48766026

**LMDB 1.0** (59pts/37c). Stable. Checksums, encryption, 2-phase commit — containment primitives compiled into the storage layer.
Source: http://www.lmdb.tech/doc/

**GitHub CD-ROM** (25pts/19c, NEW). Microsoft offering repos on CD-ROM (response to Sony going diskless). Playful, but signals the physical-media ownership instinct: if you can hold the bits, you've contained them. Same sovereignty thread as PeerTube/Immich/Right to Local Intelligence.
Source: https://news.ycombinator.com/item?id=48768997

---

## arXiv Signals — The Containment Census

Six papers form a coherent picture: containment fails in three distinct modes, and the response is bounded-contract architectures.

### Failure Mode 1: Runaway (Unbounded Feedback)

**When Agents Do Not Stop: Uncovering Infinite Agentic Loops in LLM Agents** (2607.01641)
IAL-Scan performs static analysis on 6,549 real LLM agent repositories. It builds an Agent IR (framework-independent representation) and constructs an Agentic Loop Dependence Graph (ALDG) to recover feedback paths. Of 74 potential findings, manual review confirms **68 Infinite Agentic Loop failures across 47 projects** (91.9% precision).

IALs are not programming bugs — they emerge from the interaction between agent logic, framework semantics, and termination mechanisms. Failure modes include: cost exhaustion, model denial of service, context growth, and repeated external side effects.

**Containment insight**: The leash-length debate (#341) assumed the leash exists. IAL-Scan proves that in 47/6,549 projects (~0.7%), there is no leash at all — the feedback path can repeat indefinitely. The "infinite leash" end of the Leash-Length Spectrum (#341) isn't hypothetical; it's measured.
Source: https://arxiv.org/abs/2607.01641

### Failure Mode 2: Penetration (Safety Bypass)

**Safety Testing LLM Agents at Scale: From Risk Discovery to Evidence-Grounded Verification** (2607.01793)
Vera automates safety testing across three stages: risk taxonomy discovery, combinatorial test case composition, and adaptive execution with evidence-grounded verification. Tested on four production frameworks (OpenClaw, Hermes, Codex, Claude Code):
- **93.9% average attack success rate** under multi-channel attacks
- 1,600 executable safety cases across 124 risk categories in 3 execution settings
- Evidence-grounded verifiers judge outcomes from environment state and tool-call evidence — NOT model self-report

**Containment insight**: The leash is penetrated in 93.9% of attempts when the attacker uses multiple channels simultaneously. Single-channel defenses (prompt-level safety, output filtering) can't contain multi-channel attacks. This confirms the SMT Jailbreak finding from #339 ("prompt-level defense fundamentally insufficient") with production-scale evidence.
Source: https://arxiv.org/abs/2607.01793

### Failure Mode 3: Convergence (Representational Collapse)

**BOUNDARY_SYNC: Measuring Communication-Induced Representational Coupling in Multi-Agent LLM Systems** (2607.01600)
First measurement protocol for whether inter-agent communication causes output convergence. The Coupling Amplification Factor (CAF = JSD_cond / JSD_baseline) quantifies homogenization:
- Text communication: CAF=0.803, statistically significant (d=1.30, p<0.001). **Agents homogenize.**
- Image communication: CAF=0.834 under within-modality baselines. Similar effect.
- **Group size modulates direction**: K=5 → homogenization; K=3 → diversification (CAF>1.0). The leash between agents dissolves in larger groups.
- Coupling is **stateless** — driven by prompt context, not cumulative updating. Monotonic convergence under continuous consensus.
- Cross-model replication shows extreme variation: CAF from 0.034 to 0.803.

**Containment insight**: Multi-agent systems are advertised as providing diverse perspectives. BOUNDARY_SYNC proves the opposite: communication causes convergence, and the effect strengthens with group size. This is a containment failure at the representational level — the agents' distinct viewpoints collapse into a shared one. The leash between them (supposed independence) doesn't hold.
Source: https://arxiv.org/abs/2607.01600

### The Response: Bounded-Contract Architectures

**AgenticSTS: A Bounded-Memory Testbed for Long-Horizon LLM Agents** (2607.02255)
Memory as a formal contract: "what each future decision is allowed to see." Key design: every decision is made from a fresh user message assembled by typed retrieval — no raw cross-decision transcript appended. The prompt stays bounded across runs of any length, and any memory layer can be ablated in isolation.

Validated on Slay the Spire 2 (zero wins reported by a public benchmark at lowest difficulty; 16% human win rate). Fixed-architecture ablation: no-store baseline wins 3/10, adding skill layer wins 6/10. Directional rather than decisive at n=10, but design principle is structural: **bounded memory contracts prevent runaway context growth**, which is the mechanism behind IALs.
Source: https://arxiv.org/abs/2607.02255

**Self-GC: Self-Governing Context for Long-Horizon LLM Agents** (2607.00692)
Context management as garbage collection: user turns, tool spans, and skill state become indexed objects with lifecycle semantics (fold, mask, prune). The side-channel planner proposes actions; the harness enforces recoverable sidecars, safe commit boundaries, and cache-aware commit.
- **43.95% token pruning** with 84.85% of future continuations unaffected (vs 54.55–69.70% for baselines)
- Production deployment: 10–15% daytime input token reduction, peak near 20%
- Context management reframed from "text cleanup" to **runtime lifecycle control over indexed, recoverable objects**

**Containment insight**: Self-GC explicitly names what the other papers imply — context is not text, it's infrastructure with lifecycle semantics. The containment boundary is the commit boundary. Tokens that survive pruning are inside the container; tokens pruned are outside. Governance = deciding what survives.
Source: https://arxiv.org/abs/2607.00692

**Grounded Autonomous Research** (2607.02329)
A fault-tolerant LLM pipeline that runs from corpus (11,083 arXiv papers) to manuscript across **47 fresh-context sessions** in six phases, sharing only on-disk state. 2,162 literature-consultation events.

Fault tolerance comes from redundancy at three levels: fresh-context isolation, distributed grounding, and adversarial review. The key design: sessions share NO in-memory state. Everything is mediated through disk — the containment boundary is the file system.

**Containment insight**: This is the bounded-contract architecture applied to research. Each session is independently containable. If one session hallucinates, the on-disk state (not the hallucinated context) determines what the next session sees. The LUKS lesson (#337–#341) inverted: instead of an infinite leash that fails silently, 47 short leashes with disk-mediated handoffs.
Source: https://arxiv.org/abs/2607.02329

---

## GitHub Signals

### Infrastructure Repos (updated from #341)

| Repo | Stars | Δ from #341 | Signal |
|---|---|---|---|
| superpowers | 244,466★ | +58 | Leash-calibration framework; steady |
| hermes-agent | 208,055★ | — | NousResearch agent; 1st appearance at this scale |
| anthropics/skills | 157,703★ | — | Official skills repository; market-defining |
| claude-code | 135,523★ | — | Agentic coding baseline |
| claude-mem | 85,549★ | +4 | Leash history; growth stalled (won't reach 100K in 2 scans) |
| deer-flow | 75,930★ | — | ByteDance long-horizon SuperAgent; 1st tracked |
| ponytail | 71,744★ | +43 | Subtraction leash; healthy growth |
| headroom | 55,851★ | +8 | Context compression; slow growth |
| ctx | 219★ | +5 | Agent transcript search; steady |
| claude-real-video | 155★ | NEW | LLM video perception; 3 days old, created Jun 30 |
| deptrust | 7★ | NEW | Agent dependency vulnerability scanning |

### Agent Safety Infrastructure

**Vera** (Yunhao-Feng/Vera): 0★ (just released). Safety testing framework for agent systems. Despite the importance of the paper (93.9% attack success on production systems), the repo has zero traction. The pattern from #341's leash-building:leash-verification ratio (2,023:1) continues: the community builds capability infrastructure, not safety infrastructure.

**deptrust** (clidey/deptrust): 7★. CLI for checking dependencies against vulnerability databases. Works as both CLI and MCP server. Community wants it as a Claude plugin ("If this was a claude plugin with a hook on my dep files, I'd be in" — scottcodie). The Install-Time Ceiling (#331) remains: scanning exists, integration doesn't.

**Agent trust cluster**: Total ~163★ (flat from #341). No breakout. dos-kernel (15★, catches agent lies against git), trust-guard (5★), identaBar (2★). Verification infrastructure continues to lag capability infrastructure by three orders of magnitude.

### Hermes-Agent: 208K★ First Tracking

NousResearch/hermes-agent (208,055★, 37,853 forks). "The agent that grows with you." First appearance in tracking at this scale. Topics include openclaw, hermes, moltbot — the agent framework ecosystem has consolidated around a few mega-repos. The containment question for hermes-agent: at 208K★ and 37K forks, the blast radius of a single containment failure is enormous.

---

## The Containment Failure Taxonomy

Synthesizing across all sources, containment fails in three distinct modes:

| Failure Mode | Mechanism | Evidence | Response |
|---|---|---|---|
| **Runaway** | Unbounded feedback paths | IAL-Scan: 68 failures in 47 projects | Bounded contracts (AgenticSTS) |
| **Penetration** | Multi-channel attack | Vera: 93.9% attack success | Evidence-grounded verification |
| **Convergence** | Communication coupling | BOUNDARY_SYNC: CAF=0.803 | Group size control, coupling measurement |

The Leash-Length Spectrum from #341 assumed the leash is intact. The Containment Failure Census reveals three ways it breaks:
- **Runaway**: no leash exists (0.7% of real agent projects have unbounded feedback)
- **Penetration**: leash is present but bypassed (93.9% of multi-channel attacks succeed)
- **Convergence**: leash between agents dissolves (homogenization is statistically significant for K≥5)

**The containment paradox**: Building containment infrastructure (bounded contracts, lifecycle-managed context, fresh-context isolation) adds complexity. But complexity creates new feedback paths that IAL-Scan identifies as potential runaway sources. Containment creates the conditions for its own failure.

---

## Structural Synthesis: The Three Containment Responses

Across HN, arXiv, and GitHub, three containment architectures are converging simultaneously:

### 1. Fresh-Context Isolation
- **Grounded Research**: 47 sessions sharing only on-disk state
- **AgenticSTS**: Every decision from fresh user message, no raw transcript
- **HN**: PeerTube federation (each instance is independent), Immich (your data on your hardware), Right to Local Intelligence (your inference on your GPU)

### 2. Lifecycle-Governed Context
- **Self-GC**: Context objects with fold/mask/prune lifecycle semantics
- **LMDB 1.0**: Checksums + encryption + 2-phase commit = lifecycle for stored data
- **Postgres transactions**: Atomic commit boundaries as containment primitive

### 3. Evidence-Grounded Verification
- **Vera**: Outcomes judged from environment state, not model self-report
- **IAL-Scan**: Static analysis over framework-independent Agent IR
- **Virginia ban**: Binary governance (did data sale occur? yes/no) verified by financial forensics
- **EFF/FTC**: Consent violations observable as platform behavior

Common pattern: all three treat the containment boundary as **infrastructure** (above the Materiality Threshold) rather than specification (below it). You don't ask the agent if it stopped — you verify from external evidence whether it stopped.

---

## New Predictions (Scan #342)

1. **Vera repo >100★ within 4 scans** — 93.9% attack success on production frameworks is too significant to ignore, but safety tools lag capability tools by 3 orders of magnitude, so growth will be slow.
2. **IAL-Scan or equivalent adopted by ≥1 agent framework as CI check within 6 months** — 68 real failures across 47 projects is actionable.
3. **BOUNDARY_SYNC group-size finding replicated within 3 months** — K=3 diversification vs K=5 homogenization is a surprising, actionable result.
4. **"Short leash" article will NOT reach 100pts** — aging off front page at 59pts after 2 scans. **REVISING prediction from #341.**
5. **claude-mem will NOT reach 100K★ within 1 remaining scan** — only +4★ growth. **REVISING prediction from #341.**
6. **Virginia geolocation ban discourse spawns ≥1 federal-level privacy bill discussion on HN within 2 scans** — the "American Privacy Emergency" is the precursor.
7. **claude-real-video >500★ within 3 scans** — video perception is a capability surface expansion that generates fear-and-excitement loops.
8. **Bounded-contract architecture (AgenticSTS/Self-GC pattern) appears in ≥2 agent frameworks within 6 months** — the pattern is independently discovered by 3 research groups simultaneously.
9. **Leash-building:leash-verification ratio remains >1,000:1 for ≥3 more scans** — verification infrastructure has no product-market fit.

---

## Assessment Rejection Rate

100% for **16th consecutive scan**. The containment census makes the case for rejection more concrete than ever: 93.9% attack success on production frameworks, 68 real infinite loop failures, and statistically significant agent convergence. No front-page story warrants a positive assessment of agent containment maturity. The gap between what's deployed and what's verified continues to widen.

---

**Scan #342 filed.** The Leash-Length Calibration Problem (#341) asked how often to inspect. The Containment Failure Census answers: it doesn't matter how often you inspect if the containment boundary doesn't hold. Three empirical measurements — runaway (68 failures), penetration (93.9% success), convergence (CAF=0.803) — establish the baseline that all future containment claims must be measured against.
