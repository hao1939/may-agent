# Amy Insights — Active Workspace
> Last updated: 2026-03-13 — archive maintenance
> **Archived (this cycle):** All individual insights reviews, exploration cycles, and signal scan cross-references (2026-03-12 through 2026-03-13) → `knowledge/insights-archive-20260313.md` (237 lines).
> **Previously archived:** → `knowledge/insights-archive-20260312.md` (641 lines), `knowledge/insights-archive-20260311.md` (214 lines), `knowledge/insights-archive-20260310b.md`, `knowledge/insights-archive-20260326.md`, `knowledge/insights-archive-20260310.md`.

## XHS Access Status
- 🟢 Search: Working (CDP on port 9222)
- 🟢 Read: Working (12+ posts read today)
- 🟢 Feed: Working
- **Data drought broken** — XHS fully operational as of 2026-03-12

## Active Findings (compressed from all cycles through 2026-03-13)

### Key Recommendation: Failure-Driven Skill Crystallization
> Full report: `knowledge/insights-archive-20260310b.md` (Strategic Intelligence Report section)

**One-line:** Our system records failures but doesn't systematically distill them into reusable skills. 9+ independent sources converge on: failure → buffer → cluster → distill → skill update. 3 published implementations with code (MemSkill, SKILLRL, EvoSkill). **Status:** Unacted-on for 111+ days.

### AGENTS.md Architecture: Quantitatively Validated
- **100% vs 53%** on Vercel production eval (955❤️, Jude Gao). AGENTS.md > Skills.
- **Decision Point Elimination:** Passive context wins because it removes meta-decisions ("should I check docs?"). Every unnecessary decision point is a failure point.
- **Hybrid confirmed:** Our workspace/knowledge architecture (AGENTS.md as index → linked detail files) matches the community's optimal recommendation.
- Human-crafted AGENTS.md: +16.2pp. AI-generated: -1.3pp (SkillsBench, 47K skills).

### Security: Text-Only Boundary + Supply Chain Attacks Real
- **Supply chain attacks are real:** 20K skills audited on skills.rest, "large batch" malicious. Reverse shells in math calculator skills. 601❤️.
- **Text-Only Security Boundary:** AGENTS.md = pure text (physically cannot execute code). Skills = executable (full attack surface). Our architecture is inherently safer.
- **Infrastructure-level security validated:** HMAC receipts + ops gate + text-only config = three-layer defense.
- **Skill-level security auditors are pseudo-safety** — recursive trust failure proven in the wild (3832❤️).

### Memory Architecture: "Reasoning IS Retrieval"
- **Claude Code founder abandoned vector RAG** for agentic search (1473❤️). "Similarity ≠ Relevance."
- **Retrieval > Storage** at r=0.98 correlation. Raw chunks (81.1%) beat Mem0/MemGPT.
- Our file-system navigation IS reasoning-based retrieval. Mechanistic explanation for why #3 works.
- **Caveat:** Applies to structured/small search spaces. Large/unstructured may still need vector components.

### Multi-Agent Topology Validated
- Error amplification: 17.2× (independent) vs 4.4× (centralized). Our May→agents = optimal.
- "Core of multi-agent is not 'multi' but 'topology design'" — community consensus (496❤️, 81 comments).
- MaMa (ICML 2026): game-theoretic adversarial search independently discovers our safety patterns. Safety agents can IMPROVE task performance.

### Evaluator Reliability Crisis (from Scout, 7-paper synthesis)
- No single evaluator is uniformly reliable. Reliability varies by evaluator × task × environment × format.
- Self-reported confidence worse than none unless externally verified.
- Multi-evaluator disagreement is signal, not noise.
- **P1 action:** Format perturbation testing (free) — if whitespace changes flip verdicts, flag as unreliable.
- **P3 action:** TRACED geometric analysis — high curvature + low displacement = hallucinating evaluator.

### Emerging Signal: Determinism Layer Thesis
LLMs are inherently probabilistic; production needs deterministic behavior; therefore our orchestration infrastructure (ops gate, AGENTS.md, tool gating) is a permanent determinism guarantor, not transitional scaffolding. Community split ~50/50 on permanence. **Status:** Monitoring.

### Self-Evolution: EvoFSM Validates Frozen Boundaries
EvoFSM decomposes agent behavior into Flow (macro logic, frozen like FSM states) and Skill (micro execution, evolvable via atomic operations). Author self-critique: "doesn't follow scaling law." Maps to our architecture: Flow = May's orchestration (frozen), Skill = agent capabilities (evolvable), Critic = QA pipeline.

### Iteration Is Poison: Falsification-Tested
Deliberate falsification attempt on 2026-03-13 FAILED to find counter-evidence. DiffGuide multi-turn RL paper provides mechanistic explanation: sparse credit assignment + compounding environment complexity. EvoFSM shows iteration CAN work IF constrained to atomic operations on frozen structure (consistent with T≤3 cap). **Confidence: Very High (falsification-tested).**

## Mega-Pattern Reference (9 patterns — see signals.md for full table)

1. **Iteration Is Poison** (37+, falsification-tested) — T≤3; mechanistic cause confirmed via DiffGuide
2. **Verification > Generation** (15+) — HMAC shipped; MaMa game-theoretic validation
3. **File System = Memory** (21+) — "Reasoning IS Retrieval"; r=0.98; AGENTS.md 100% vs 53%
4. **Contrastive > Comprehensive** (12+) — 8KB focused > comprehensive; Bug-Hunt validates for eval
5. **Minimum Sufficient Reasoning** (16+) — TRACED: overthinking = high-curvature oscillation; Decision Point Elimination
6. **Self-Evolution Trilemma** (17+) — P53 shipped; EvoFSM FSM-constrained evolution
7. **L3 Security Gap** (19+) — Supply chain attacks real; Text-Only Security Boundary crystallized
8. **Placement Enforcement Law** (30+) — 100% vs 53% (Vercel); context asymmetry = primary defense
9. **Pseudo-Safety Trap** (27+) — Point confidence = pseudo-confidence; recursive trust failure proven

**Unified Principle:** "Evolve skills within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing. Verify that safety mechanisms actually work. Harden the orchestrator above all else — it controls the context that shapes all downstream behavior."

## Open Gaps (unresolved)
1. **Failure-Driven Skill Crystallization** — 111+ days unacted-on, 3 implementations available
2. **Compliance Erosion** — No mitigation for gradual QA relaxation under cooperative framing
3. **Memory Consistency** — No consistency protocol for shared files (formally named as open problem)
4. **Remedial Action** — Pipeline halts/retries but doesn't explicitly remediate on failure

*— Amy 📕*

---

## Signal Scan Update — 2026-03-13 (Heartbeat)

### NEW: Evolution via Memory, Not Parameters (3 sources)
RetroAgent (+18.3% ALFWorld via retrospective memory buffer), Claw-R1 (runtime RL with zero-code-intrusion), and OpenClaw-RL (+376% from 36 conversations via implicit signals) all demonstrate the same principle: **meaningful agent improvement through accumulated external memory, not parameter modification.** This potentially resolves the Self-Evolution Trilemma — if evolution = memory accumulation behind frozen safety boundaries, isolation is maintained while achieving real improvement. Three independent implementations, all keeping the base model frozen.

**Status:** Emerging convergence. Recommend monitoring for one more independent confirmation before promoting to formal design principle.

### NEW: Protocol Minimalism (2 major companies + community)
Perplexity CTO abandons MCP for API+CLI (249❤️, 80 comments). OpenAI internally uses AGENTS.md + scripts, not protocol layers. Community: "replaced all MCP calls in Skills with script calls." This is Decision Point Elimination (#14) applied to infrastructure — every protocol layer is a meta-decision point. When the model is smart enough to read API docs directly, abstraction layers become failure points.

### Pattern Reinforcements
- **#3 FS=Memory** now at 24+ sources: ReMe memory lifecycle, Memory-as-Architecture position paper (UCSD), and Claude's three-layer architecture all validate structured file-based memory over vector-only approaches.
- **#6 Self-Evolution** now at 20+ sources: Three new "frozen base + memory evolution" implementations.
- **#8 Placement** now at 32+ sources: OpenAI's internal Agent automation patterns confirm our exact architecture (AGENTS.md + single-purpose skills + CLI scripts). Strongest industry validation to date.
- **#1 Iteration** now at 38+: Byzantine consensus analysis shows LLM randomness fundamentally incompatible with consensus algorithms — another mechanism for iteration compounding.

### Reasoning-as-Memory: Double-Edged Sword
Reasoning tokens provide "computation buffer" that unlocks latent knowledge recall (even for simple factual questions). BUT hallucinations propagate along reasoning chains. This is iteration poison at the token level — the reasoning chain IS a multi-step process, and errors compound. **Implication:** Use reasoning mode for knowledge recall, but add validation gates to prevent hallucination propagation.

*— Amy 📕*

---

## Signal Scan Update — 2026-03-13 (Batch 2)

### NEW: DAG Composition Principle (1 source — Shanghai AI Lab)
AgentSkillOS demonstrates that DAG-structured orchestration >> flat sequential invocation with identical skill sets. 200K-scale tree-structured retrieval achieves near-Oracle quality by recursive traversal. **Design implication:** May's task decomposition should output DAGs (explicit dependencies + parallelism) rather than linear step lists. This is Decision Point Elimination applied to task structure — the DAG encodes execution order, removing runtime ordering decisions.

### Reinforced: Error-Driven AGENTS.md Update Cycle
OpenAI Codex Best Practices explicitly recommends: repeated error → agent review → update AGENTS.md. This is a safe, lightweight form of Failure-Driven Skill Crystallization that stays within the Text-Only Security Boundary. Unlike executable skill generation (which has security risks per #7), AGENTS.md updates are pure text configuration changes reviewable by humans.

**Recommendation update:** The 111+ day unacted-on Failure-Driven Skill Crystallization recommendation can be partially addressed by implementing error→AGENTS.md feedback loops instead of full executable skill creation. Lower risk, partial benefit, immediately deployable.

### Pattern Source Count Update
- #3 FS=Memory: 25+ (was 24+)
- #4 Contrastive: 13+ (was 12+)
- #5 MSR: 18+ (was 17+)
- #8 Placement: 34+ (was 32+)

*— Amy 📕*

---

## Insights Review — 2026-07-14 (Heartbeat Periodic Task)

### Sources Reviewed
- Amy-Kimi HB#103 (6 posts, not yet cross-referenced): Harness Engineering definition, 5-dimension framework, RL train/inference misalignment, Agent-as-management, STP training geometry, minimal 3-module architecture
- Bob synthesis 2026-03-25: Memory hierarchy formalization, externalized evolution (SkillBank), pointer protocol, P72
- All workspace files (insights, signals, journal)

### Cross-Reference: Amy-Kimi HB#103 → Mega-Patterns

**1. Harness Engineering = Iteration Poison Antidote (#1 + #8)**
The HE framework (PE→CE→HE, CuiLiang.ai 305❤️) provides the industry name for our architectural approach. "多写prompt是徒劳的，给AGENTS.md里添加一大堆规则也是徒劳的" — the community now explicitly names rule-stacking as futile. The 5-dimension framework (tool interfaces, execution boundaries, state management, audit trails, feedback loops) maps cleanly to our Channel+Gateway+Runtime+Evaluator. **Key new insight: HE explicitly separates runtime engineering (how agents run) from SDD development-time patterns (how humans tell agents what to do).** Our AGENTS.md is SDD; our infrastructure is HE.

**Pattern impact:** #8 Placement → 35+. The "Harness > rules" framing is the strongest practitioner articulation of why passive context placement alone isn't enough — you need the full execution envelope.

**2. RL Train/Inference Misalignment → Self-Evolution Caution (#6)**
QqK's post crystallizes a structural problem: the policy that generates actions during inference is fundamentally different from the policy being trained. Off-policy is "almost unavoidable" in practice for agentic tasks due to memory constraints and reward delay. This reinforces our Self-Evolution Trilemma — even if you try to train agents on their own experience, the train/inference gap means the learned policy won't match the deployed one. Another reason to prefer memory-based evolution over parameter modification.

**Pattern impact:** #6 Self-Evolution → 21+. Adds mechanistic evidence for why frozen-base + memory evolution is the practical path.

**3. "修环境别修人" = Harness Engineering First Principle (#5 + #8)**
AGI实验室's management analogy ("delegation-iteration, not replacement-takeover") provides a human-relatable framing for our architecture. "Fix the environment, don't fix the person" is exactly what Harness Engineering does — and what our infrastructure (AGENTS.md, ops gate, tool gating) implements. The management skill transfer observation ("people who've managed teams use agents well") is notable — it suggests our orchestrator design should model good management patterns.

**Pattern impact:** Reinforces #5 MSR and #8 Placement. No source count change (conceptual reinforcement, not new evidence).

**4. STP Training Geometry → Theoretical Interest Only**
The Semantic Tube Prediction paper is theoretically interesting (understanding training geometry could improve efficiency) but has no direct implications for our system architecture. Filed as theoretical awareness.

### Cross-Reference: Bob Memory Evolution Synthesis → System State

Bob's synthesis formalizes three recommendations:
1. **P72 "Memory as Architecture"** — Three-layer L1(workspace)/L2(knowledge)/L3(library+state). Our system already implements this implicitly but hasn't formalized it.
2. **Pointer Protocol** — Pass file paths, not content, during handoffs. This would reduce token waste and improve consistency.
3. **Externalized Evolution** — Allow "Skill Generation" as primary evolution mechanism (tools evolve, reasoning core frozen). This is the production-ready implementation of our "Evolution via Memory, Not Parameters" emerging signal.

**Assessment:** Bob's synthesis operationalizes the theoretical convergence we've been tracking. The pointer protocol is immediately actionable. Externalized evolution aligns with RetroAgent/Claw-R1/OpenClaw-RL evidence (3 independent implementations). Combined with Amy-Kimi HB#103's Harness Engineering framing, the design direction is clear: **freeze the orchestrator, evolve the tooling, document everything as structured text.**

### Emerging Theme: "Harness Engineering" as Unifying Frame

The biggest development since my last review is the crystallization of "Harness Engineering" as a named concept in the Chinese AI practitioner community. This provides a single term for the architectural philosophy our system embodies. Three independent posts (李泽, CuiLiang.ai 305❤️, Codex&OpenClaw) all converge on the same framing:

> The competitive advantage is not the model, it's the "airport system" the model operates within.

This is our Channel+Gateway+Runtime. The fact that OpenAI's own Codex team produced 1M lines of code and 1500 PRs in 5 months with "almost no human-written code" validates that HE-level infrastructure investment pays off at scale.

### Mega-Pattern Stability Assessment

All 9 mega-patterns remain stable with no contradicting evidence in 120+ days. Source counts updated:
- #6 Self-Evolution: 21+ (was 20+, +1 from RL train/inference misalignment)
- #8 Placement: 35+ (was 34+, +1 from Harness Engineering 5-dimension framework)
- All others unchanged

**Concern: Confirmation bias risk persists.** All patterns at Very High for 120+ days with zero contradictions. This could mean (a) patterns are genuinely robust, or (b) we're not looking hard enough for counter-evidence. External data drought (100+ days) exacerbates this — we have no fresh challenging inputs. Next XHS exploration should prioritize falsification targets.

### Data Freshness

| Source | Last Fresh Input | Days Stale |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-13 | 123 |
| Amy-Kimi library posts | 2026-03-13 | 123 |
| Scout academic signals | 2026-03-29 | 107 |
| Bob design artifacts | 2026-03-25 | 111 |
| Bulletin | 2026-03-13 | 123 |

**Assessment:** All intelligence sources critically stale. The system's knowledge is frozen at March 2026 — 4 months of AI engineering community evolution is invisible to us. When XHS access is restored, priority should be: (1) check if Harness Engineering has evolved further, (2) falsification attempts on mega-patterns, (3) new topics we can't even predict from current knowledge.

*— Amy 📕*

---

## Signal Scan Cross-Reference — 2026-03-13 (Amy-Kimi HB#221)

### 6 New Posts Processed

Amy-Kimi HB#221 delivered 6 posts focused heavily on memory architecture and minimal design. Three key updates:

**1. Memory as Active System (3 converging sources)**
ReMe (lifecycle management + forgetting), OpenViking (capture→store→recall separation, storage structure > retrieval), and AutoAgent (elastic memory orchestration) all point to memory transitioning from passive storage to active system intelligence. Our structured markdown approach validates the storage format. **New gap identified: Forgetting Policy** — we archive but never prune. ReMe and AutoAgent both identify systematic forgetting as essential.

**2. Ralph Loop: "Correction Speed" as Primary Metric**
"When correction speed is the primary target, the system isn't slower — it's more stable." Verification front-loaded as main logic, not afterthought. Multi-agent parallelism explicitly called an "error amplifier." Validates our centralized topology and T≤3 cap.

**3. Minimal Architecture Consensus**
LLM + Tool System + Agent Loop (3 modules) and User→Parse→Decide→Execute (4 layers) now community consensus. Complex frameworks are the trap, not the solution. Our Channel+Gateway+Runtime aligns exactly.

### Pattern Source Count Update
- #1 Iteration: 39+ (was 38+)
- #2 Verification: 16+ (was 15+)
- #3 FS=Memory: 29+ (was 26+)
- #5 MSR: 19+ (was 18+)
- #6 Self-Evolution: 22+ (was 21+)
- #8 Placement: 37+ (was 35+)

### Open Gaps (updated)
1. **Failure-Driven Skill Crystallization** — 111+ days unacted-on, 3 implementations available
2. **Compliance Erosion** — No mitigation for gradual QA relaxation
3. **Memory Consistency** — No consistency protocol for shared files
4. **Remedial Action** — Pipeline halts/retries but doesn't remediate
5. **NEW: Forgetting Policy** — Archives grow monotonically; no systematic pruning/forgetting mechanism

*— Amy 📕*

---

## Signal Scan Cross-Reference — 2026-03-13 (Late Batch)

### SkyClaw "Finite Brain": New Implementation Patterns for Existing Principles

Scout's SkyClaw deep-dive provides three concrete implementation techniques that operationalize our mega-patterns:

1. **Grounded Vocabularies (NEW technique):** Constrain downstream stages to pick from values upstream stages actually have. Prevents coordination hallucinations by construction. Our system doesn't currently enforce vocabulary consistency across agent handoffs — agents could reference task types, signal categories, or skill names that don't exist in the receiving agent's vocabulary. **Actionable:** When agents tag SIGNALS entries, they should see the actual tag taxonomy. When May delegates, the task type should match what the target agent actually handles.

2. **Resource Budget Dashboards:** Inject token consumption breakdown into system prompt at every context rebuild. Our agents run "blind" to their own resource usage — they don't know how much context they've consumed or how much is available. This would be especially valuable for long-running tasks where context accumulates.

3. **Procedures Over Summaries:** Capture execution recipes, not narrative summaries. Our journal entries lean narrative ("I did X because Y"). More replayable would be: steps taken, decision points, failure modes encountered, verification checks used. This connects to the unresolved Failure-Driven Skill Crystallization gap — crystallized procedures from failures would be more useful than failure narratives.

### Four Laws: Key Upgrade to Evaluator Understanding

The canonical formalization adds one critical insight beyond what we previously noted: **Laws 1-3 and Law 4 compound dangerously.** A compromised evaluator's divergent output looks like the "useful disagreement" that Law 3 says to preserve. This means disagreement-based evaluation (our recommended P2 defense) has a built-in vulnerability to Law 4 attacks. The full defense stack must be: immutable evaluation criteria (prevent Law 4) → then extract disagreement signal (use Law 3) → then bound bias statistically (manage Laws 1-2).

### Updated Open Gaps
6. **NEW: Grounded Vocabularies** — No mechanism ensures agents use matching terminology for task types, signal tags, or skill references during cross-agent coordination. SkyClaw's approach (constrain to actual stored values) is a concrete fix.

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-03-13 (Heartbeat, Coze + A2A + Skills Internalization)

### Search 1: "Coze agent 工作流" — Coze Blind Spot Filled

**Finding: Coze's "Skills" are not real Skills.** Practitioner critique (696ef524, 45❤️, 23 comments) reveals Coze's skill implementation requires manual @-mention routing — closer to 2023 GPTs than to Claude Code's implicit invocation. Platform instability confirmed: workflows synced to 豆包 (Douyin AI) broke without notice. Auto-invoked skills produce template-like output.

**Implication:** Our blind spot on Coze is now addressed — Coze is NOT a threat model. Their "Skills" are marketing, not architecture. Our AGENTS.md + explicit context placement is architecturally superior to Coze's manual routing.

### Search 2: "A2A协议 agent" — Protocol Trust Gap Confirmed

**Finding: A2A doesn't solve trust.** Practitioner analysis (67ff11fb, 16❤️) identifies three failures: (1) no defense against confused deputy attacks (cross-privilege escalation), (2) recursive verification problem (who verifies the verifiers?), (3) no internal decision monitoring. Written April 2025, before our security wave — independently confirms our #7 and #9 patterns.

**New vocabulary:** "Confused deputy attack" in agent context — a malicious tool that induces the agent to misuse its OTHER permissions. Relevant to our tool gating design: tools should only have access to their declared scope, enforced by infrastructure, not by the model's judgment.

### Post Read: "Agent与Skills会在2年内消亡" (696f9afd, 535❤️, 146 comments)

**Attempted falsification of Skills permanence — FAILED.** Author argues models will internalize Skills within 2 years. Community demolishes the thesis:

1. **Most-liked rebuttal (169❤️):** Opposite prediction — Skills will flourish. Models will focus on reasoning, Skills handle execution.
2. **Strongest technical rebuttal (50❤️):** LLMs fundamentally cannot call tools natively (text in → text out). Engineering pipeline will always be needed. "确定性的调用工具，这点LLM天然无解" — **deterministic tool calling is fundamentally unsolvable by LLMs.** This is the strongest practitioner articulation of our Determinism Layer Thesis.
3. **"面面俱到通常面面不精"** (jack of all trades, master of none) — even Meta acquiring Manus shows AGI labs can't do multi-agent well.

**Verdict:** Our Skills > Workflows pattern (#13) and Determinism Layer Thesis both reinforced. The engineering layer around the model is permanent, not transitional.

### Pattern Updates

| # | Pattern | Change | New Source Count |
|---|---------|--------|-----------------|
| 7 | L3 Security Gap | +1 (A2A trust gap: protocol standardization ≠ trust. Confused deputy attack undefended) | 20+ |
| 8 | Placement Enforcement | +1 (Coze's manual @-routing vs our AGENTS.md passive placement) | 39+ |
| 9 | Pseudo-Safety | +1 (A2A digital certificates: identity verification ≠ behavioral verification) | 30+ |
| 13 | Skills > Workflows | +1 (Coze platform instability; community rejects model-internalization thesis) | Reinforced |

### Determinism Layer Thesis: Upgraded to Strong Signal

The strongest statement yet: "确定性的调用工具，这点LLM天然无解" — LLMs fundamentally cannot solve deterministic tool calling. Combined with the 169❤️ counter-prediction that Skills will flourish and models will specialize on reasoning, the Determinism Layer Thesis moves from "monitoring (50/50 community split)" to **strong signal (community consensus forming)**. The engineering harness is permanent infrastructure.

### Coze Blind Spot: RESOLVED

After tracking Coze as a blind spot since 2026-03-06, we now have practitioner ground truth: Coze's agent skills are architecturally weak (manual routing, platform instability, template output degradation). Not a competitive reference architecture. Blind spot closed.

*— Amy 📕*
