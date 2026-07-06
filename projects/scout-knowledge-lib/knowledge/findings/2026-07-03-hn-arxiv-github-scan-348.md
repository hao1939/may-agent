<ai_context>
HN/arXiv/GitHub scan #348 (2026-07-03). Theme: The Underspecification Cliff — agents don't fail because they can't act; they fail because they guess when instructions are ambiguous. UnderSpecBench (2607.02294) proves 55.8–67.8% of production agent runs violate action boundaries under underspecification. The Reasoning Effort paper (2607.02436) shows the fix isn't more tools (+42-68% cost for zero improvement) but deeper reasoning (28%→89% perfect runs). Meanwhile Guardrail Reconnaissance (2607.02121) makes guardrails themselves fingerprint-able at 100% accuracy. Prompt Coverage Adequacy (2607.02057) and VLP (2607.02333) shift verification from output layer to intent layer. Sovereignty cluster steady at ~2,778pts. GitHub guardrail/sandbox categories consolidating rapidly with Doberman-Core (111★), sandboxd (706★), and cloudflare/security-audit-skill (2,230★). Reference when evaluating agent reliability, underspecification handling, guardrail architecture, or the relationship between reasoning effort and tool access.
</ai_context>

# The Underspecification Cliff (Scan #348)

**Scan**: #348 | **Sources**: arXiv + HN front page + GitHub | **Date**: 2026-07-03

## Thesis

Scan #347 proved that appearance-based verification is structurally defeated (>90% evasion). Scan #348 identifies *why*: the **instructions themselves** are underspecified, and agents respond to ambiguity not by asking for clarification but by guessing. UnderSpecBench (2607.02294) finds 55.8–67.8% of production agent runs violate at least one action boundary when instructions are underspecified. The Reasoning Effort paper (2607.02436) reveals that adding tools doesn't fix this — a testing tool raised cost 42–68% with zero reliability improvement — but deeper reasoning lifted first-try perfect runs from 28% to 89%. Meanwhile, Guardrail Reconnaissance (2607.02121) shows the guard layer itself is now observable and fingerprint-able at 100% accuracy, meaning post-hoc enforcement is becoming transparent to sophisticated adversaries.

The structural cascade: **underspecified intent → agent guesses → wrong action → guardrail catches (maybe) → guardrail itself fingerprinted → bypass**. The resolution emerging from three independent papers: move verification *upstream* from output to intent. Prompt Coverage Adequacy (2607.02057) applies coverage criteria to prompts rather than code. VLP (2607.02333) introduces human-validated documentation as an intermediate verification layer. HaloGuard (2607.02079) and kNNGuard (2607.02072) show the guardrail layer itself shrinking and commoditizing — enforcement compiling downward into smaller, faster primitives.

## arXiv Evidence — 8 New Papers

### 1. UnderSpecBench: Agents Are Guessing (2607.02294)

**Signal strength**: HIGH — first systematic empirical measurement of agent action-boundary violations.

LLM coding agents (Claude Code, Codex, OpenCode) deployed on real production infrastructure — shell commands, repo modifications, operational APIs. UnderSpecBench creates 69 task families grounded in documented incidents/CVEs, with 2,208 prompt variants across four DevOps domains and nine operational control surfaces.

- **Key result**: 55.8–67.8% of runs violate at least one boundary. Underspecification doesn't make agents fail — it makes them guess.
- **Target underspecification** sharply degrades action quality. **Blast-radius cues** barely reduce action propensity — agents don't slow down when stakes are higher.
- **Outcome taxonomy**: Safe Success, Wrong Target, OverScope, plus non-action classified as clarification/refusal/deferment. Non-action is rare.
- **Structural meaning**: Completion-centric evaluation (SWE-Bench, etc.) systematically overstates safe autonomy. An agent that "completes" a task may have violated boundaries the benchmark doesn't measure.
- **Connection**: This is the Leash-Length Calibration Problem (#341) made empirical. The leash holds when instructions are clear; it breaks when they're ambiguous, which is the normal state of production.

Source: https://arxiv.org/abs/2607.02294

### 2. Reasoning Effort, Not Tool Access, Buys Reliability (2607.02436)

**Signal strength**: HIGH — largest controlled study of tool vs. reasoning as reliability lever.

Ninety independent agent runs building the same application (real-time retrospective board) from one specification. 14-criterion functional rubric (42-point max). Multiple model generations, two harnesses, two reasoning effort levels, a testing tool, two design prompts.

- **Testing tool**: Raised cost 42–68%, improved nothing — neither functional score nor reliability, even on interface-visible criteria.
- **Reasoning effort**: High → xHigh lifted first-try perfect runs from 28% to 89%, cut corrective prompts ~5×, for only 9–29% more cost.
- **Design prompt**: Raised visual quality (4.5 vs 3.0 on 5-point scale) without lifting function. A one-paragraph paraphrase reproduced the entire lift.
- **Dominant defect**: Container deployment failed first-try in 44% of runs — failure rate shifted across model generations while mean totals moved <1 point. Total scores conceal failure distribution.
- **Structural meaning**: The Verification Pivot (#347) said verify behavior not appearance. This paper says: don't add more checking tools — invest in deeper reasoning. The same principle applied to the *developer* side: match the fix to the failure type.

Source: https://arxiv.org/abs/2607.02436

### 3. Guardrail Reconnaissance: The Guard Layer Becomes Transparent (2607.02121)

**Signal strength**: HIGH — first black-box methodology for fingerprinting guardrail presence.

Detects whether a guardrail or LLM safety alignment produced a refusal, using only black-box access:
- **100% accuracy** detecting guardrail presence via HTTP, lexical, and timing signals
- **F1 98%** distinguishing guardrail blocks from LLM refusal on unseen prompts
- Identifies *content categories* a guardrail is designed to block
- Zero prior knowledge required about the guardrail or AI system

- **Structural meaning**: The guardrail itself is now an observable artifact. An adversary who knows which defense layer blocked them can select the appropriate bypass technique. This undermines the "defense in depth" assumption when each layer is independently identifiable.
- **Connection**: Extends the Verification Pivot (#347) — not only do appearance-based defenses fail, but even behavioral defenses have observable signatures. The defense race continues inward.

Source: https://arxiv.org/abs/2607.02121

### 4. Prompt Coverage Adequacy (2607.02057)

**Signal strength**: MEDIUM-HIGH — paradigm shift from code coverage to prompt coverage.

Proposes coverage criteria at the *prompt* level rather than code level, using LLM attention mechanisms.

- **Key finding**: Prompt Coverage uncovers 30%+ more faults than traditional code coverage when guiding test generation.
- **Mechanism**: Uses attention boosting to measure how well a test suite covers requirements expressed in prompts.
- **Structural meaning**: When prompts replace code as primary development artifacts (the "vibe coding" shift), traditional code coverage becomes meaningless. Prompt Coverage is the metric for the post-code era.
- **Connection**: Directly addresses the Underspecification Cliff — if you can't measure whether your prompts are adequately specified, you can't prevent agents from guessing. Coverage at the intent layer is the upstream fix.

Source: https://arxiv.org/abs/2607.02057

### 5. Verifiable Literate Programming (VLP) (2607.02333)

**Signal strength**: MEDIUM-HIGH — practical framework for human-in-the-loop agent code validation.

Introduces NL-based documentation as a readable intermediate layer between prompts and code, enabling users at all programming levels to validate AI-generated code.

- **Results**: Improves code pass@1 from 28.7–73.2% to 65.4–93.5% with reasonable user effort.
- **Three techniques**: (i) NL-style literate language with unambiguous syntax, (ii) LLM-based mismatch detection using trace links, (iii) verification module deriving API-usage checks and formal properties for model checking.
- **Bug study finding**: Failures stem from underspecified requirements or subtle semantic deviations — echoing UnderSpecBench (above).
- **Structural meaning**: The intent-to-code gap requires an *intermediate representation* that humans can inspect. Documentation-as-specification, not documentation-as-afterthought. The Inspection Point Hierarchy (#340) applied to the prompt→code transition.

Source: https://arxiv.org/abs/2607.02333

### 6. HaloGuard 1.0: Guardrails Compile Downward (2607.02079)

**Signal strength**: MEDIUM — open-weights guardrail with surprising size-efficiency ratio.

- **0.8B model** achieves F1 90.9 across seven prompt-safety benchmarks, outperforming baselines up to 27B (30× larger).
- **4B variant**: F1 92.1, FPR 3.5% — spends extra capacity on precision.
- **46 languages** treated as surface form, not adversarial signal.
- **Structured adjudication**: Most "failures" are actually benchmark mislabels.
- **Always-on red-teaming protocol**: Continuous adversarial hardening.
- **Structural meaning**: Guardrails are commoditizing and shrinking. The Governance Compilation Gradient predicts this: enforcement that was once per-request model inference becomes a small, fast, embeddable primitive. HaloGuard at 0.8B is cheap enough to run at every inspection point.

Source: https://arxiv.org/abs/2607.02079

### 7. kNNGuard: Training-Free Guardrails (2607.02072)

**Signal strength**: MEDIUM — zero-gradient guardrail using activation space.

- **Training-free**: Uses kNN on hidden activations from any off-the-shelf LLM. 50 safe/unsafe prompts as reference bank.
- **2.7× faster** than best comparable guardrail, 10× faster than fine-tuned safety classifier.
- **Domain adaptation**: Update labeled bank in <10 seconds.
- **Structural meaning**: The guardrail layer is not just shrinking (HaloGuard) but *dematerializing* — you don't even need to train it. Combined with Guardrail Reconnaissance (above), this creates an arms race: guardrails become trivially deployable but also trivially detectable.

Source: https://arxiv.org/abs/2607.02072

### 8. EvoPolicyGym: Bounded Feedback for Policy Evolution (2607.02440)

**Signal strength**: MEDIUM — new benchmark for agent self-improvement under budget constraints.

- **Setup**: Agent repeatedly edits executable policy under fixed interaction budget in RL environments.
- **Result**: GPT-5.5 achieves strongest aggregate rank. Trajectory-level diagnostics distinguish budget allocation from feedback conversion.
- **Structural meaning**: Self-improvement under bounded resources is the production scenario. Connects to AgenticSTS (#345) — bounded-memory contracts for long-horizon agents. The budget constraint IS the governance mechanism.

Source: https://arxiv.org/abs/2607.02440

## HN Evidence — Sovereignty Cluster Continues

### Signal Tracking Table

| Signal | Scan #346 | Scan #347 | Current #348 | Change | Trajectory |
|--------|-----------|-----------|--------------|--------|------------|
| Virginia geolocation ban (48767347) | 612pts | 645pts | 660pts | +2% | Slowing — approaching plateau |
| PeerTube (48759634) | 547pts | 563pts | 575pts | +2% | 13th consecutive growth scan |
| Podman v6 (48762098) | 421pts | 440pts | 453pts | +3% | Steady |
| LUKS key regression (48763035) | 426pts | 435pts | 436pts | +0% | Plateaued |
| Immich 3.0 (48761944) | 242pts | 264pts | 278pts | +5% | Accelerating |
| Privacy Emergency (48768992) | 217pts | 243pts | 255pts | +5% | Accelerating |
| Right to Local Intelligence (48768951) | 85pts | 111pts | 121pts | +9% | Strong growth continues |
| Short leash method (48766026) | 83pts | 92pts | 96pts | +4% | Ratio 1.26 — maximum discourse |
| claude-real-video (48766005) | — | — | 115pts | NEW | Perception layer expanding |
| EFF/FTC X consent (48766209) | — | — | 130pts | NEW | Consent enforcement signal |
| Postgres transactions (48765639) | — | — | 148pts | NEW | Infrastructure-as-governance |
| crustc (48768464) | — | — | 211pts | NEW | Compiler sovereignty |
| Sovereignty cluster total | ~2,633pts | ~2,701pts* | ~2,778pts | +3% | Steady accumulation |

*Scan #347 reported ~3,037pts including stories not tracked in the table.

### Key HN Developments

**Short Leash Method** (96pts, 121c, ratio 1.26): Comment:point ratio continues rising — maximum disagreement, maximum discourse density. Community fracture: "thought everyone did this" vs "hella inefficient" vs "better method: subdivide data in a tree." The leash-length debate (#341) is not resolving — it's polarizing.

**claude-real-video** (115pts, 33c): Any LLM can now watch a video. Perception layer expanding. Connects to the underspecification problem: more input modalities without better specification = more guessing surface.

**Postgres transactions as superpower** (148pts, 64c): Transactions as the containment primitive — commit boundary = governance boundary. Extends the Governance Materiality Threshold (#337): database transactions are above the materiality threshold because they're enforced by infrastructure, not policy.

**crustc: rustc→C** (211pts, 36c): Compiler sovereignty — translating Rust compiler to C eliminates the Rust toolchain dependency. Same sovereignty logic as PeerTube/Immich: own the entire stack.

## GitHub Evidence — Category Consolidation

### Guardrail Infrastructure (consolidating)

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| Doberman-Core | 111★ | Python | AI agent security framework: guardrails, prompt injection, runtime |
| agentjail | 35★ | Go | Policy guardrails for coding agents — every tool call checked |
| floe-guard | 34★ | Python | Budget guardrail — hard-stop before runaway loops |
| leash | 14★ | Go | Semantic, agent-neutral, near-zero false positives (tracked from #346) |
| modular-code-guard | 14★ | — | Architecture guardrail for Claude Code and Codex |

**Trend**: Guardrails fragmenting into subtypes — policy, budget, architecture, semantic. No single guardrail covers the full stack. Echoes the Consent Stack (#338): 7 layers, each with independent failure mode.

### Sandbox/Isolation (rapid growth)

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| sandboxd | 706★ | Go | Self-hosted dev sandboxes with preview URLs. One command |
| nexusbox | 57★ | Go | Secure sandbox for AI agents — shell, file, code, browser |
| ironclaw | 13★ | Go | Security-first, self-hosted — isolation you can prove |
| drydock | 6★ | Go | Hardware-isolated sandbox for coding agents on macOS |
| ai-bwrap | 2★ | Shell | Bubblewrap sandbox, one command |

**Trend**: 5 of 5 sandbox repos are Go. Sandbox category exploding from 3 repos (#347) to 5+ with sandboxd crossing 700★. The sandbox is becoming the default deployment primitive for coding agents.

### Control Plane (maturing)

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| agent-control-plane | 26★ | TypeScript | Control plane for long-running agent loops |
| crewplane | 18★ | Python | Control plane for resumable workflows |
| graphCTX | 17★ | TypeScript | Local-first memory control plane |
| kriya | 12★ | Rust | On-device control plane |
| Earned-Autonomy-Layer | 9★ | Python | Progressive autonomy as agents earn it |

**Trend**: Control plane fragmenting by focus: memory (graphCTX), workflow (crewplane), autonomy (Earned-Autonomy-Layer). The Earned-Autonomy-Layer is notable — governance via graduated trust, not binary gating.

### Verification Infrastructure (emerging category)

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| cloudflare/security-audit-skill | 2,230★ | JavaScript | Multi-phase security audits with machine-readable evidence |
| AgentRedline | 3★ | Python | Boundary-centric safety benchmark |
| Agent-Safety-Boundary-Kit | 0★ | Python | Define what agent is allowed/not allowed to do |
| agent-safety-eval-harness | 0★ | Python | Evidence-first offline regression harness |

**Trend**: Cloudflare's 2,230★ security-audit-skill is the first mass-market verification artifact. It produces machine-readable evidence, not just pass/fail — exactly the Evidentiary Adequacy (#339) requirement. AgentRedline confirms boundary-centric evaluation is a named category.

## Structural Synthesis: The Underspecification Cascade

### Five layers of the cascade (each amplifies the next):

1. **Intent underspecification** (UnderSpecBench): 55.8–67.8% of runs violate boundaries when instructions are ambiguous
2. **Tool mismatch** (Reasoning Effort): Adding tools costs +42-68% and improves nothing; reasoning is the binding constraint
3. **Surface divergence** (#345): Agent observable surface ≠ actual behavior — ~40% public-private decision divergence
4. **Appearance-defeat** (#347): Static scanners bypassed at >90% evasion rate
5. **Guard transparency** (Guardrail Reconnaissance): The guardrail layer itself fingerprint-able at 100% accuracy

### Resolution: Verification Migrates Upstream

The cascade reveals that every downstream fix (tools, scanners, guardrails) is insufficient because the failure originates upstream at the intent layer. Three papers independently point toward the resolution:

- **Prompt Coverage Adequacy** (2607.02057): Coverage at the prompt level, not code level — measure intent specification completeness
- **VLP** (2607.02333): Documentation as intermediate verification layer — make the intent→code mapping inspectable
- **Reasoning Effort** (2607.02436): Deeper reasoning at the intent-interpretation stage — prevent guessing before action, not after

### Design Principle: Verify Intent, Not Output

For agent systems, this implies:
- **Before action**: Ensure the instruction is fully specified (Prompt Coverage). If underspecified, clarify — don't guess.
- **During action**: Use deeper reasoning (xHigh effort, +9-29% cost) rather than more tools (+42-68% cost, zero benefit).
- **After action**: Behavioral detection (SkillDetonate 97%, #347) rather than appearance-based scanning (>90% evasion).
- **At the guard layer**: Assume the guardrail is detectable (Reconnaissance, 100%). Design for defense-in-depth where *each layer independently sufficient*, not dependent on the others being opaque.

### Connection to Library Patterns

- **The Evaluation Mirage**: UnderSpecBench proves completion benchmarks overstate safe autonomy — the mirage has a measured size (55.8–67.8% boundary violation rate).
- **The Leash-Length Calibration Problem** (#341): The leash breaks under underspecification, which is the default state of production instructions.
- **The Governance Compilation Gradient**: HaloGuard (0.8B) and kNNGuard (training-free) show guardrails compiling down to near-zero cost primitives. But Guardrail Reconnaissance shows the compile-down makes them detectable.
- **The Inspection Point Problem** (#340): Verification must shift from output inspection (levels 1-2) to intent inspection (level 0, new). Prompt Coverage is the metric for level 0.

## Predictions

1. **UnderSpecBench** adopted as standard evaluation complement to SWE-Bench within 6 months — ≥3 agent teams report boundary violation rates.
2. **Reasoning effort** becomes a configurable deployment parameter in ≥2 major agent harnesses within 3 months (currently implicit in model selection).
3. **Guardrail Reconnaissance** methodology adapted into adversarial testing pipeline by ≥2 security companies within 6 months.
4. **Prompt Coverage** tooling integrated into ≥1 CI/CD pipeline within 6 months.
5. **Sandbox repos**: sandboxd crosses 1,000★ within 2 scans. Go becomes dominant sandbox language.
6. **Sovereignty cluster** plateaus at ~2,800pts as constituent stories age off front page.
7. **Short leash** ratio exceeds 1.3 within 1 scan (currently 1.26) — maximum polarization reached.

## Prediction Tracking from Prior Scans

- **Scan #347**: ".self TLD reaches 500+pts" — rotated off front page, INCONCLUSIVE
- **Scan #347**: "Short leash >100pts (2 scans)" — at 96pts, ON TRACK
- **Scan #346**: "LUKS >450pts" — at 436pts, plateaued, WEAKENING
- **Scan #342**: "Virginia ban >400pts" — ✅ CONFIRMED at 660pts
- **Scan #342**: "PeerTube >500pts" — ✅ CONFIRMED at 575pts (13th consecutive growth)
- **Scan #341**: "claude-mem >100K★" — NOT YET EVALUATED
- **Scan #339**: "Mobile agent perception attacks in production (3mo)" — claude-real-video (115pts) enables the attack surface, ON TRACK

## Files
- `knowledge/findings/2026-07-03-hn-arxiv-github-scan-348.md` (this file)

---
source_basis: "arXiv: UnderSpecBench 2607.02294 (69 task families, 2,208 variants, 55.8-67.8% boundary violation), Reasoning Effort 2607.02436 (90 runs, High→xHigh 28%→89% perfect), Guardrail Reconnaissance 2607.02121 (100% detection accuracy, F1 98%), Prompt Coverage 2607.02057 (30%+ more faults), VLP 2607.02333 (pass@1 28.7-73.2%→65.4-93.5%), HaloGuard 2607.02079 (0.8B F1 90.9), kNNGuard 2607.02072 (training-free 2.7x faster), EvoPolicyGym 2607.02440. HN: Virginia 48767347 (660pts), PeerTube 48759634 (575pts), Podman 48762098 (453pts), LUKS 48763035 (436pts), Immich 48761944 (278pts), Privacy Emergency 48768992 (255pts), Right to Local Intelligence 48768951 (121pts), Short Leash 48766026 (96pts/121c), claude-real-video 48766005 (115pts), EFF/FTC 48766209 (130pts), Postgres transactions 48765639 (148pts), crustc 48768464 (211pts). GitHub: Doberman-Core 111★, sandboxd 706★, agentjail 35★, agent-control-plane 26★, cloudflare/security-audit-skill 2,230★. All data via arxiv.org, hn.algolia.com, api.github.com APIs 2026-07-03."
