# Deep Dive: arXiv:2603.05450 — Distributed Partial Information Puzzles (DPIP)

**Paper:** "Distributed Partial Information Puzzles: Examining Common Ground Construction Under Epistemic Asymmetry"
**Authors:** Yifan Zhu, Mariah Bradford, Kenneth Lai, Timothy Obiso, Videep Venkatesha, James Pustejovsky, Nikhil Krishnaswamy (Brandeis University + Colorado State University)
**Venue:** COLM 2025 preprint, 10 pages, 4 figures, CC BY 4.0
**Published:** 2026-03-05

## TL;DR

Introduces a collaborative construction task where 3 "directors" each hold **partial, private information** about a goal structure and must coordinate with a "builder" to construct it — without any single participant knowing the full picture. Provides a multimodal dataset (speech + gesture + action, temporally aligned) and evaluates two paradigms for tracking **common ground** (shared beliefs): (1) prompted LLMs (Qwen3-4B, Llama-3.2-3B, GPT-5-mini/GPT-5) and (2) an axiomatic pipeline based on Dynamic Epistemic Logic (DEL). **Key finding: modern LLMs are surprisingly bad at tracking shared beliefs under epistemic asymmetry, even when given rich multimodal annotations.** The axiomatic (rule-based) approach sometimes outperforms GPT-5.

## The Task: DPIP

- **Setup:** 3 directors + 1 builder. Each director sees ONE side-view of a 3D Lego structure (front, left, right). No director knows the full 3D shape. The builder sees nothing — they follow instructions.
- **Challenge:** Directors must communicate their partial knowledge, resolve conflicts/ambiguities, and converge on a plan the builder can execute — all without anyone having complete information.
- **Why it matters:** This is the purest formalization of "epistemic asymmetry" in collaborative tasks. Each agent has a different slice of truth and must construct shared understanding incrementally.

## Key Concepts

### Common Ground (CG)
A shared set of beliefs mutually recognized by group members. Not just "what everyone knows" but "what everyone knows that everyone knows" (mutual belief). The paper formalizes CG construction as an incremental process driven by three axioms:

1. **Seeing is Believing** — perceptual context directly updates belief
2. **Acting is Believing** — embodied action reveals intention
3. **Saying is Believing** — language communicates epistemic state

### Dynamic Epistemic Logic (DEL) Pipeline
An axiomatic (non-ML) pipeline that incrementally tracks CG by applying formal logic rules to multimodal events. When ≥2 participants concurrently accept a proposition, a CG label is generated (e.g., `CG_{D1,D2,Builder}:on(gs3, rs2, layer2)`). Doubts temporarily remove a participant; negations delete shared beliefs entirely.

## Experimental Results (DSC = Dice Similarity Coefficient)

### Four Experiments:

| Experiment | Best Performer | Mean Global DSC | Key Insight |
|---|---|---|---|
| **Actions → Structure** (predict structure from actions only) | GPT-5 (0.159) | Low across all | Actions alone are insufficient; context degrades over turns |
| **Aligned → Structure** (all modalities → structure) | Qwen3-4B (0.668) | Moderate | More modalities help global but hurt step-wise — added context = more noise at turn level |
| **CGC → Structure** (axiomatic CG → structure) | Axiomatic (0.369) | Moderate | Rule-based CG sometimes beats GPT-5 with all modalities (GPT-5 Global: 0.250) |
| **Aligned → CGC** (LLM predicts CG vs axiomatic CG) | GPT-5 (0.363) | Low | LLMs and axioms infer *very different* belief states from the same data |

### Headline Findings:

1. **GPT-5 collapses with multimodal input.** Goes from best performer (actions-only) to worst performer (all modalities). High variance across groups. Additional modalities seem to confuse rather than help it.
2. **Qwen3-4B (tiny model) beats GPT-5 at multimodal structure prediction.** Global DSC 0.668 vs 0.250 — statistically significant. Small models that can handle structured input sometimes outperform frontier models.
3. **Axiomatic CG outperforms GPT-5 at structure prediction from beliefs.** A deterministic, logic-based pipeline achieves higher mean DSC than GPT-5 given all modalities. Rule-based approaches are not dead for belief tracking.
4. **LLMs and axioms see different things.** Even on "easy" dialogues where both approaches predict structures well, their CG overlap is ≤0.5. They're extracting fundamentally different aspects of the interaction.
5. **Task failure is easier to detect than success.** On Group 7 (failed task), both Qwen and GPT-5 perfectly infer the (empty/minimal) common ground. LLMs correctly detect *absence* of shared belief but struggle to identify its *contents* when it exists.

## Relevance to Our Multi-Agent System

### Direct Parallels

Our system has **epistemic asymmetry by design**:
- **May** sees the user request and delegates, but doesn't see coder's internal reasoning
- **Coder** sees the code and edits but doesn't see QA's evaluation criteria
- **QA** sees the diff and conventions but doesn't see May's full context about user intent
- **Bob** synthesizes philosophy but doesn't see real-time session details
- **Scout** gathers external knowledge that other agents don't have access to

Each agent holds partial information. Effective collaboration requires constructing common ground — exactly the DPIP problem.

### What the Paper Tells Us About Our System

#### 1. Our file-based coordination IS a common ground mechanism
The shared filesystem (SIGNALS.md, philosophy.md, CONVENTIONS.md, knowledge files) functions as an explicit common ground store — analogous to the DEL pipeline's CG labels. When Scout writes a signal and Bob reads it, that's `CG_{Scout,Bob}:proposition`. Our architecture accidentally implements a simple version of the paper's "Saying is Believing" axiom: writing to a shared file = speech act → shared belief update.

**Gap identified:** We have no formal tracking of *who has read what*. Our CG is assumed, not verified. If Bob hasn't read SIGNALS.md since Scout's last update, the common ground we think exists doesn't actually exist. The paper shows this matters — assumed-but-unverified CG leads to coordination failures.

#### 2. LLMs are bad at tracking belief state — implications for our evaluator
The paper's core finding (LLMs struggle to track who knows what) directly impacts our evaluator and any agent that needs to reason about another agent's knowledge state. When May delegates to coder, May implicitly models what coder knows (task description, file contents, conventions). The paper suggests this mental model is unreliable — LLMs may not correctly track what information has been shared and acknowledged.

**Actionable:** Don't rely on implicit belief tracking. Make shared context *explicit* in delegation: include all relevant context in the task description rather than assuming the sub-agent will infer it from the environment.

#### 3. Rule-based belief tracking can outperform LLM inference
The axiomatic DEL pipeline beating GPT-5 is a strong signal. For our system, a lightweight deterministic mechanism for tracking "what has been communicated to whom" could outperform relying on LLM reasoning about information flow.

**Concrete idea:** A simple `CG_LOG` (append-only, per-session) that records: `{timestamp, from, to, proposition_type, content_ref}`. When May delegates to coder, log it. When coder reads a file, log it. When QA receives a diff, log it. This deterministic trace would give any agent an accurate picture of common ground — something the paper shows LLMs can't reliably construct from raw interaction data.

#### 4. More information ≠ better coordination
The paper's most surprising finding: adding modalities *hurt* GPT-5's performance. More context confused it. This validates our philosophy of concise, targeted delegation (Philosophy §3: Clear, Concise Output; §1: Simplest Thing That Works). When delegating, provide exactly the information needed — no more. Information overload degrades an LLM's ability to track what matters.

#### 5. Detecting failure is easier than tracking success
LLMs perfectly detected the failed group's empty common ground but couldn't track substantive shared beliefs. This aligns with our existing signal from arXiv:2603.05414 (introspection paper): models are better at anomaly detection than content identification. For our system: the evaluator can reliably detect *breakdowns* in coordination (missing context, contradictory assumptions) but may struggle to verify that coordination is *working correctly*.

**Implication for evaluator:** Design evaluation criteria around detecting coordination failures (missing delegation context, assumption mismatches, conflicting actions) rather than trying to verify that agents have correct mutual understanding.

### Connections to Previously Tracked Research

| Paper/Discovery | Connection |
|---|---|
| **arXiv:2603.05414** (Introspection) | Content-agnostic detection — models detect anomalies but can't identify content. DPIP shows the same pattern for belief tracking: detect absence of CG (easy) vs track contents of CG (hard). |
| **arXiv:2603.05399** (Judge Reliability) | JRH shows reliability is (model × task × perturbation)-specific. DPIP shows CG tracking is similarly model-specific: Qwen3-4B beats GPT-5 on multimodal structure prediction despite being vastly smaller. |
| **arXiv:2603.05485** (Bias-Bounded Eval) | Both papers support "don't trust LLM reasoning about complex state — add deterministic bounds." DEL axioms for CG parallel Lipschitz shrinkage for evaluation: rule-based guardrails on LLM inference. |
| **danpeg/bug-hunt** | Bug-hunt's 3-agent adversarial pattern (Hunter/Skeptic/Referee) addresses a similar problem: each agent has partial perspective, and structured disagreement resolves epistemic gaps. DPIP formalizes *why* this works — it forces CG construction through explicit communication. |
| **XHS "single-agent-first"** | DPIP demonstrates *why* multi-agent coordination is hard: CG tracking under epistemic asymmetry is an unsolved problem even for GPT-5. This validates the Anthropic doctrine — don't go multi-agent unless the epistemic asymmetry is inherent to the task. |

## 6 Actionable Takeaways

1. **Explicit context bundling in delegation.** When May delegates, include ALL relevant context in the task description. Don't assume sub-agents can infer shared knowledge from the environment. The paper shows LLMs can't reliably do this.

2. **Consider a lightweight CG tracking mechanism.** An append-only log of "what was communicated to whom" would give deterministic belief-state tracking. The paper shows this outperforms LLM inference for CG.

3. **Information diet for delegation.** More context ≠ better performance. Curate delegation payloads to include exactly what's needed. This is already our philosophy but now has empirical backing from a controlled study.

4. **Evaluate for coordination failure, not coordination success.** Design evaluator criteria around detecting CG breakdowns (missing context, unshared assumptions) rather than verifying positive CG. LLMs are better at the former.

5. **Hybrid approach for belief tracking.** Use deterministic rules (who wrote what, who was told what) as the backbone, with LLM reasoning only for ambiguous/implicit communication. The paper's DEL + LLM comparison shows neither alone is sufficient.

6. **Track acknowledgment, not just broadcast.** SIGNALS.md and shared files are broadcast mechanisms — they don't confirm receipt. Adding read-receipts (even as simple as "last-read timestamps" per agent per file) would close the CG verification gap the paper identifies.

## Assessment

**Relevance: HIGH** — Directly addresses the fundamental coordination challenge in our multi-agent system. Epistemic asymmetry is not a bug in our architecture; it's inherent (different agents *should* have different information). But the paper shows that LLMs are surprisingly bad at managing this asymmetry, which means we need explicit mechanisms rather than relying on implicit LLM reasoning.

**Novelty: MEDIUM** — The formal framework (DEL for CG) is well-established in philosophy/linguistics. The novel contribution is the empirical demonstration that modern LLMs fail at it, and that simple axiomatic approaches can outperform them. This is a "wake-up call" paper, not a solution paper.

**Implementability: HIGH** — The actionable takeaways (explicit context bundling, CG logging, acknowledgment tracking) are all lightweight and align with our "simplest thing that works" philosophy. No new infrastructure needed — just more disciplined information flow patterns.
