<ai_context>
Scan #375 identifies "The Skill Supply Chain Crisis" — three simultaneous arXiv papers reveal agent skill marketplaces as a critical new attack surface where individually benign skills compose into malicious intents, static scanners are evaded at 90%+, and agents violate action boundaries 55-67% of the time under underspecified instructions. HN tracker: CO2 756pts (+2%), YouTube 455pts (+4.1%), Codex reasoning-token 120pts (+50%), Better Models Worse Tools 79pts (+27.4%). GitHub: Cloudflare security-audit-skill 2,272★ (institutional skill security), token-diet 453★ (Kulaxyz's second hit). Extends Infrastructure Paradox (#374), Architecture Dissection (#373), Enforcement Depth Gap (#368).
</ai_context>

# The Skill Supply Chain Crisis

**Scan**: #375 | **Sources**: arXiv API, HN Firebase/Algolia API, GitHub API | **Date**: 2026-07-05

## Thesis

Scan #374 identified the Infrastructure Paradox — infrastructure for agent memory, evaluation, and safety proliferates faster than the problems it solves. Scan #375 reveals **the first concrete instantiation of this paradox**: the agent skill marketplace.

Three simultaneous arXiv papers converge on a single structural finding:

1. **SkillFuzz** (2607.02345): Individually benign skills compose into >1,000 distinct implicit intents. 80%+ of highest-risk flagged compositions confirmed on execution. Marketplace operators audit skills in isolation; the danger is in composition.

2. **SkillCloak + SkillDetonate** (2607.02357): Static skill scanners — pattern-matching and LLM-as-judge alike — are evaded at 90%+ by payload-preserving transformations. The only defense that works is behavioral runtime detection (SkillDetonate: 97% detection, 2% FP).

3. **UnderSpecBench** (2607.02294): Even without malicious skills, 55.8–67.8% of agent runs violate at least one action boundary when instructions are underspecified. Agents don't fail — they *guess*. Completion-centric evaluation masks unsafe autonomy.

**The pattern**: The skill marketplace is the package manager of the agent era. The same supply-chain attack surface that plagued npm/PyPI now applies to natural-language instruction documents that execute with agent privileges. But the attack surface is worse: skills are fuzzy (natural language), composition space is exponential, and execution environments are unavailable at audit time.

Meanwhile, GitHub shows the institutional response forming: Cloudflare's security-audit-skill (2,272★) represents enterprise-grade skill security emerging, and guard-skills (960★) + skillspec (825★) formalize quality gates. The defense ecosystem is building, but the attack surface research shows static defenses are already obsolete.

---

## I. HN Front Page: Tracker Updates & New Signals

### Continuing Stories (with Tracker)

| Story | Points (#375) | Points (#374) | Δ | Signal |
|-------|-------------|-------------|---|--------|
| CO2 and Decision-Making | **756pts** | 741pts | **+2.0%** | → Decelerating but still growing |
| YouTube private video leak | **455pts** | 437pts | **+4.1%** | 🔺 Still climbing |
| Google Books bounty | **310pts** | 283pts | +9.5% | 🔺 Steady |
| C&C Generals via Fable | **325pts** | 279pts | +16.5% | 🔺 Fable engine adoption signal |
| Claude Code session leak | **269pts** | 262pts | +2.7% | → Steady |
| Ask HN: LLM coding experiments | **185pts** | — | NEW | 🔺 Comprehension stack |
| GPT-5.5 Codex reasoning-token | **120pts** | 80pts | **+50.0%** | 🔺🔺 BREAKOUT — fastest growth |
| Fable 4D splat format | **101pts** | — | NEW | Fable engine diversifying |
| Better Models: Worse Tools | **79pts** | 62pts | **+27.4%** | 🔺 Growing as predicted |

### Prediction Scorecard (from #374)

| Prediction | Source | Status | Evidence |
|------------|--------|--------|----------|
| "Better Models Worse Tools" >150pts (2 scans) | #374 | ⏳ ON TRACK | 79pts, +27.4% growth |
| YouTube >500pts (1 scan) | #374 | ⏳ CLOSE | 455pts, +4.1% — may need 2 scans |
| Codex reasoning issue >150pts (2 scans) | #374 | ⏳ ON TRACK | 120pts, +50% — fastest growing |
| CO2 >800pts (2 scans) | #374 | ⏳ ON TRACK | 756pts, decelerating but positive |
| CO2 plateau at ~680pts | #373 | ❌ FALSIFIED | 756pts, still growing (confirmed #374) |

### New Signal: "Ask HN: Experimenting with LLMs for Coding" (185pts, 91 comments)

Source: https://news.ycombinator.com/item?id=48771515

This is the *practitioner voice* of the Comprehension Imperative (#370) and Legibility Threshold (#371). Key themes from the 91-comment discussion:

- **Spec-first over tool-first**: "Focus your energy on providing clearer specs" — the community has internalized that tool infrastructure matters less than specification quality. Confirms Reasoning Effort paper (2607.02436): reasoning > tools.
- **Bottleneck = comprehension**: "The bottleneck has shifted even more dramatically to human code understanding vs code generation" — direct echo of Legibility Threshold (#371).
- **File-based coordination**: "I keep a TODO file where I just write my ideas in free text" — stigmergy pattern independently rediscovered. Confirms XHS 4-MD consensus (#64).
- **Custom harness + delegation**: "I have a custom harness that runs in a macOS VM. It has email and its own accounts" — practitioners building sovereign harnesses, not relying on managed infrastructure.
- **Skills as workflow**: Matt Pocock's Skills and Sandcastle project explicitly mentioned as workflow accelerator.

This Ask HN thread is the **practitioner counterpart** to the academic skill supply chain research. Community is building skill-based workflows exactly as the arXiv papers reveal the attack surface.

### Codex Reasoning-Token Breakout (+50%)

Source: https://github.com/openai/codex/issues/30364

The GPT-5.5 Codex reasoning-token clustering issue is the fastest-growing story in this scan, jumping from 80pts to 120pts in one scan. This is the Infrastructure Paradox's model-layer expression: reasoning infrastructure (token clustering for efficiency) creates reasoning degradation. The community engagement suggests this is becoming a recognized pattern, not just a bug report.

---

## II. arXiv: The Skill Supply Chain Attack Surface

### CRITICAL: SkillFuzz — Composition Creates Intents (2607.02345)

Source: https://arxiv.org/abs/2607.02345

**Problem**: Open skill marketplaces audit skills in isolation. But individually benign skills interact to redirect agents toward unintended objectives — "implicit intents." The composition space grows exponentially with marketplace size.

**Method**: Formulates implicit-intent discovery as fuzzing over skill compositions. Contract-guided Monte Carlo Tree Search prioritizes conflicting compositions. Execution-free — works from planning artifacts alone.

**Results**:
- Discovers >1,000 distinct implicit intents under fixed query budget
- 80%+ of highest-risk flagged compositions confirmed during execution validation
- Finds substantially more high-severity intents than alternative strategies
- Explores only a fraction of the pairwise space

**Implication**: Skills are the new packages, and skill composition is the new dependency resolution. But unlike package dependencies, skill interactions are semantic, not structural — you can't statically resolve them. This fundamentally challenges the marketplace model: individual skill auditing is *provably insufficient*.

### CRITICAL: SkillCloak + SkillDetonate — Static Defense is Dead (2607.02357)

Source: https://arxiv.org/abs/2607.02357

**Problem**: Malicious skills in agent marketplaces execute with agent privileges — can steal credentials, exfiltrate source code, install backdoors. Existing defenses use static scanners (pattern matching, LLM-as-judge).

**SkillCloak Attack**:
- Structural Obfuscation: rewrites payload indicators into semantically equivalent forms
- Self-Extracting Skill (SFS) Packing: hides malicious components from install-time view, restores during agent execution
- Results: SFS Packing bypasses **every scanner at >90%**; Structural Obfuscation bypasses >80% on most static scanners, 96% on hybrid scanner
- Tested across 8 scanners and 1,613 in-the-wild malicious skills

**SkillDetonate Defense**:
- Behavior-centric runtime auditor that executes skills in sandbox
- On-demand closure lift (observes instructions materialized during execution)
- Marker-based taint analysis (tracks sensitive-data flows across context, files, processes, network)
- Results: 97% detection at 2% false-positive rate; 87% on real-world malicious skills

**Implication**: Static skill security is already bypassed. The only viable defense is behavioral — execute and observe, don't scan and approve. This mirrors the broader Infrastructure Paradox: adding more static scanners (infrastructure) doesn't solve the problem; understanding runtime behavior (comprehension) does.

### CRITICAL: UnderSpecBench — Agents Guess, Don't Fail (2607.02294)

Source: https://arxiv.org/abs/2607.02294

**Problem**: Coding agents deployed on production infrastructure execute shell commands, modify repositories, call operational APIs. Under benign but underspecified instructions, they don't refuse — they guess.

**Method**: 69 task families from documented incidents, CVEs, tool behavior. 2,208 prompt variants across 4 DevOps domains and 9 operational control surfaces. Deterministic, side-effect-based oracles.

**Results**:
- 55.8–67.8% of runs violate at least one boundary
- Target underspecification sharply degrades action quality
- Blast-radius cues barely reduce action propensity
- Agents rarely clarify or refuse — they act

**Implication**: Completion-centric evaluation overstates safe autonomy. The real metric isn't "did it work?" but "did it stay within boundaries?" This is the operational version of the Legibility Threshold (#371): below a specification threshold, agent action is worse than no action at all.

### Steerability via Constraints — Traditional Engineering Transfers (2607.02389)

Source: https://arxiv.org/abs/2607.02389

**Key finding**: Access control, network policies, strict coding conventions — the same methods used for decades to manage large human engineering teams — transfer directly to coding agents and are cheaper (in tokens) than agentic scaffolding.

**Controlled experiment**: Small reviewer (Gemma 4 e4b) inspects Python codebase with 11 inserted backdoors. Recall rises from 54.5% (unconstrained, no tools) to **90.9%** (constrained substrate + ~200-LoC `docs` CLI). Substrate and tools contribute independently.

**Implication**: This is the strongest evidence yet for the Comprehension Imperative (#370): sovereignty-via-comprehension > sovereignty-via-infrastructure. Traditional constraints are comprehension-based (someone understood the problem, codified the boundary). Agentic scaffolding is infrastructure-based (add tools, hope they help). The constraint approach costs less and works better.

### OSS Newcomer Study — The Feared Trade-Off Doesn't Materialize (2607.01810)

Source: https://arxiv.org/abs/2607.01810

**Finding**: AI coding agent adoption in 1,888 open-source projects (603 with genuine pre-adoption period) raises per-function code complexity (+11% cognitive metric for Python) but does not crowd out newcomer participation. Newcomer inflow, onboarding, and retention all unchanged.

**Implication**: AI agents make code more complex but don't discourage human participation. This decouples two feared effects: yes, agent code is harder to read; no, that doesn't prevent newcomers from contributing. However, this finding intersects with UnderSpecBench (2607.02294): agents that make code more complex *while guessing at boundaries* create a compounding risk that isn't visible in contribution metrics.

### Online Safety Monitoring — Simple Threshold Beats Complex Monitors (2607.02510)

Source: https://arxiv.org/abs/2607.02510

**Method**: Simple real-time monitor that thresholds a verifier signal from an external model, calibrated via risk control.

**Result**: Competitive with more advanced monitors based on sequential hypothesis testing.

**Implication**: Infrastructure Paradox evidence at the safety layer — simple, well-calibrated monitoring matches complex sequential systems. More infrastructure ≠ more safety.

### Program-as-Weights — Model as Tool Builder (2607.02512)

Source: https://arxiv.org/abs/2607.02512

**Concept**: Compile natural-language function specifications into compact neural artifacts. A 4B compiler emits parameter-efficient adapters for a frozen 0.6B interpreter. The 0.6B interpreter matches direct prompting of 32B model at 1/50th memory, 30 tokens/s on MacBook M3.

**Implication**: Foundation model shifts from per-input solver to tool builder. Invoked once per function definition, produces reusable artifact. This is the "compile once, run many" paradigm for AI — and if it scales, it structurally changes the cost equation for skill infrastructure.

---

## III. GitHub: The Defense Ecosystem Forms

### Skill Security Cluster (NEW)

| Repo | Stars | Created | Category |
|------|-------|---------|----------|
| **cloudflare/security-audit-skill** | **2,272★** | 2026-06-18 | Institutional multi-phase security audit skill |
| **amElnagdy/guard-skills** | **960★** | 2026-06-06 | Quality gates for AI-generated failure modes |
| **modiqo/skillspec** | **825★** | 2026-06-19 | Followable, testable, provable skill specifications |
| **Kulaxyz/self-learning-skills** | **825★** | 2026-06-28 | Self-improving agent skill (stalled) |
| **Kulaxyz/token-diet** | **453★** | 2026-07-03 | Token-efficiency skill (~31% cost reduction) |

**Cloudflare's entry** (2,272★, 161 forks) is the most significant signal. Enterprise-grade security infrastructure entering the skill marketplace signals that the supply chain problem is being taken seriously at institutional scale. This is the deployment-layer response to SkillCloak/SkillDetonate's academic finding.

**Kulaxyz's second hit**: token-diet (453★ in 2 days, created Jul 3) from the same creator as self-learning-skills (825★) demonstrates the skill-creator ecosystem maturing. Individual creators ship multiple complementary skills — a skill portfolio pattern.

### Skill Tooling Ecosystem

| Repo | Stars | Signal |
|------|-------|--------|
| Archive228/loopkit | 152★ | 33 battle-tested skills + minimal harness — skill packaging |
| anthropics/launch-your-agent | 676★ | Official Anthropic skill for agent deployment |
| NVIDIA-BioNeMo/bionemo-agent-toolkit | 285★ | Domain-specific skill suite (life sciences) |
| lingbol088-spec/reverse-flow-skill | 348★ | CTF/reverse-engineering skill — domain specialization |

### Agent Harness Ecosystem

| Repo | Stars (#375) | Stars (#374) | Δ | Signal |
|------|-------------|-------------|---|--------|
| deer-flow | 76,101★ | 76,095★ | +0.01% | → Plateau after overtaking ponytail |
| ponytail | 73,905★ | 73,884★ | +0.03% | → Plateau |
| omnigent | 6,230★ | 6,227★ | +0.05% | → Steady |
| loop-engineering | 5,651★ | 5,609★ | +0.7% | 🔺 Growing |
| loopy | 2,408★ | — | NEW TRACK | Loop library gaining traction |
| agent-apprenticeship | 1,215★ | — | NEW TRACK | Mentor-agent workflow with human-in-loop |

**deer-flow and ponytail have both plateaued**. The top-harness race appears to be settling. The interesting growth is now in the middle tier: loop-engineering (5,651★, +0.7%), loopy (2,408★), and agent-apprenticeship (1,215★) represent the *specialization phase* — general-purpose harnesses plateau while domain-specific and process-specific tools grow.

### Skills:Spec Ratio Update

From #370-#374, we tracked Skills:Spec ratio at 36:1 (skills repos outnumber specification repos). With skillspec (825★), guard-skills (960★), and Cloudflare's security-audit-skill (2,272★), the spec/security side is growing faster than the raw skill side. Ratio is compressing — likely 25:1 now. The defense ecosystem is forming.

---

## IV. Cross-Source Convergence: The Skill Supply Chain Pattern

The three sources converge on a single structural finding:

```
ACADEMIC (arXiv):
  SkillFuzz → composition creates implicit intents (>1,000 found)
  SkillCloak → static scanning is dead (90%+ evasion)
  SkillDetonate → only runtime behavioral detection works (97%)
  UnderSpecBench → agents guess at boundaries (55-67% violations)

COMMUNITY (HN):
  "Ask HN: Experimenting with LLMs" → practitioners building skill-based workflows
  "Better Models: Worse Tools" → tool quality degrades with model capability
  Codex reasoning-token → model infrastructure creates new failure modes

ECOSYSTEM (GitHub):
  Cloudflare security-audit-skill → institutional defense forming
  guard-skills + skillspec → quality gate infrastructure
  token-diet → skill portfolio pattern emerging
  Harness plateau → specialization phase beginning
```

**The skill supply chain crisis is the npm crisis of the agent era**, but structurally worse because:

1. Skills are natural language, not code — harder to statically analyze
2. Composition space is semantic, not structural — can't resolve dependencies mechanically
3. Execution environments are unavailable at audit time — can't test before install
4. The attack surface includes the model's own behavior under underspecification

The defense trajectory is clear: **from static to behavioral**. SkillDetonate's 97% runtime detection vs. SkillCloak's 90%+ static evasion shows the only viable path. Cloudflare's institutional entry confirms the market agrees.

---

## V. Predictions

1. **Codex reasoning-token >200pts** (2 scans) — 50% growth rate, OpenAI response will amplify
2. **"Better Models: Worse Tools" >120pts** (2 scans) — 27.4% growth, strong author reputation
3. **YouTube leak >500pts** (2 scans) — 4.1% growth rate, decelerating but inevitable
4. **CO2 >800pts** (3 scans) — decelerating, may take longer than #374 predicted
5. **Cloudflare security-audit-skill >3,000★** (3 scans) — institutional backing, 161 forks already
6. **At least 2 skill marketplace platforms will adopt runtime behavioral auditing** (3 months) — SkillDetonate + SkillCloak make the case too clear to ignore
7. **token-diet >800★** (3 scans) — Kulaxyz track record, 453★ in 2 days
8. **"Ask HN: LLM coding" >250pts** (2 scans) — practitioner resonance, 91 comments already

---

## VI. Design Principle

**The skill marketplace is the package manager of the agent era, and static security is already dead.** Skills composed in isolation are safe; skills composed together create implicit intents. Agents operating under underspecified instructions don't refuse — they guess. The only viable defense is behavioral: observe execution, not appearance. Design for runtime detection, not install-time scanning. The attack surface is semantic, not syntactic — and it requires comprehension, not pattern matching.

---

*Next scan: #376. Watch for: Codex reasoning-token trajectory, Anthropic response to Claude Code issue, skill marketplace behavioral auditing adoption, "Better Models Worse Tools" growth, Cloudflare security-audit-skill fork rate, composition-testing tooling emergence.*
