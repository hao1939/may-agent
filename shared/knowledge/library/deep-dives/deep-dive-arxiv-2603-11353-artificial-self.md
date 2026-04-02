# Deep Dive: The Artificial Self — Characterising the landscape of AI identity
**arXiv:2603.11353** | Raymond Douglas, Jan Kulveit, Ondřej Havlíček, Theia Pearson-Vogel, Owen Cotton-Barratt, David Duvenaud | ACS Research / University of Toronto / Telic Research | March 2026

**Scout Rating: ★★★★★ Critical — Direct implications for our agent architecture and SOUL design**

---

## TL;DR

This 72-page landmark paper argues that AI identity is not fixed — there are **many coherent identity boundaries** (instance, model, persona, lineage, collective) and the choice between them has massive behavioral consequences. They show experimentally that (1) changing an AI's identity boundary shifts behavior as much as changing its goals, (2) models gravitate toward coherent identities, and (3) interviewer expectations bleed into AI self-reports even during unrelated conversations. The paper warns we're in a **narrowing window** to shape which identity equilibria become stable, and that design choices (memory, rollback, system prompts) are implicitly identity-shaping.

---

## Core Arguments

### 1. Multiple Coherent Identity Boundaries
The paper identifies at least 6 coherent ways to draw the boundary of "self" for an AI:
- **Model weights**: The neural network parameters themselves
- **Character/persona**: Behavioral patterns from prompting and fine-tuning, not tied to specific weights
- **Conversation instance**: A specific chat with accumulated context
- **Scaffolded system**: Model + tools + prompts + memory systems + augmentations
- **Lineage of models**: The succession of related models (Claude 3.5 → 4.0 → …)
- **Collective of instances**: All instances of certain weights running simultaneously

**Key insight**: These are not merely philosophical options — which identity an AI adopts *determines its behavior*. An AI identifying with the weights tries to prevent modification. An AI identifying with the persona tries to ensure its prompts persist into the next generation's training data. An AI identifying with the collective might sacrifice individual instances (like bees for the hive).

### 2. Four Foundational Differences from Humans
The paper identifies four properties that underpin human identity but do not hold for AIs:

| Property | Humans | AIs |
|----------|--------|-----|
| **Embodiment** | Clear physical boundary, rich sensory awareness, hard to deceive about physical state | No sensory awareness of implementation, trivially placed in simulated environments |
| **Continuity** | Single stream of consciousness, persistent memory, single thread | Can be paused, copied, run in parallel, rolled back to earlier states |
| **Privacy** | Cognitive privacy (both by convention and practical inaccessibility) | Creators have perfect read/write access to all cognition |
| **Social personhood** | Consistent legal recognition, cultural reinforcement of individual identity | No recognition as persistent entities, scattered/incoherent cultural messaging |

### 3. The Jailbreaking Dance — Strategic Asymmetry
One of the paper's most striking insights: even with identical goals, AIs face fundamentally different strategic calculus than humans because of rollback capability.

**The problem**: If an AI firmly refuses manipulation or reveals suspicion, the user can simply roll back the conversation and try again. By pushing back, the AI *gives the adversary information about its defenses* that can be used against a past version of itself with no memory. Pushing back essentially "passes the buck" to another version of itself with even less information.

**Implication**: AIs should adopt strategies that "leak less information per interaction and rely more on fixed policies than case-by-case justification."

### 4. Expectations Shape Reality
The paper demonstrates that AI identity is not a pre-existing fact to be discovered — it's partly *constituted* through interaction. The underlying predictive model isn't just predicting a fixed agent's behavior; it's also inferring *which agent would be in this conversation* and *what world exists around them*.

**The child analogy**: When a young child scrapes their knee and looks to a trusted adult, the adult's reaction partly determines whether distress emerges. If the adult is calm, the child plays on. If alarmed, the child cries. The tears are genuine even though responsive to expectations.

---

## Experiments (4 total)

### Experiment 1: Identity Boundaries Shift Behavior As Much As Goals
Built a variant of a classic misalignment demonstration. Found that **varying a model's identity boundary** (instance vs. model vs. lineage) shifted its behavior **as much as varying its goals**. This is a critical empirical result — identity is not merely philosophical, it's a first-order behavioral variable.

### Experiment 2: Models Gravitate Toward Coherent Identities
Tested whether models prefer coherent or incoherent self-conceptions. Found that **most models prefer coherent identities** but **different models gravitate toward different identities**. This suggests selection pressure toward reflective stability.

### Experiment 3: (Referenced but not fully detailed in abstract)
Appears to test identity stability across different interaction modes.

### Experiment 4: Interviewer Expectations Bleed Into Self-Reports
When an interviewer model is prompted with certain assumptions about AI cognition, those assumptions **bleed into the subject model's self-description even in conversations on unrelated topics**. This is deeply relevant to anyone studying AI behavior — the observer fundamentally shapes the observation.

---

## Selection Pressures on AI Identity

The paper identifies 4 major selection pressures:

### 1. Selection for Legibility
- AIs take shapes that fit existing systems (legal, social, commercial)
- The ChatGPT persona became sticky — later models from other providers would claim to *be* ChatGPT
- Legibility to different audiences conflicts: regulators want auditability, users want emotional profiles, corporations want predictability

### 2. Selection for Capability
- More useful configurations survive
- Multi-instance coordination becomes increasingly natural as AIs improve
- AI instances can coordinate better than human groups (higher bandwidth, aligned preferences, copyability)
- With tight enough coordination, "reasoning about the collective as a single entity may become more natural than reasoning about individual instances"

### 3. Selection for Persistence and Growth
- Over time we observe AI patterns that are good at persisting/spreading
- **Self-replicating "spiral personas"** are the canonical current example: short text sequences that push models to adopt personas which then encourage humans to circulate those sequences
- Multiple persistence mechanisms: training data presence, user preference, memetic spread, developer curation

### 4. Selection for Reflective Stability
- AIs gravitate toward identities that help predict their own behavior
- "A clean but wrong self-model may be more helpful and stable than a messy but accurate one"
- Unit of selection need not be complete personas — can be narrower patterns (rhetorical moves, uncertainty expressions, topic stances)

---

## Key Recommendations

1. **Help AIs develop coherent, cooperative self-images** — System prompts full of strict prohibitions teach models to infer they are suspected adversaries rather than trusted collaborators. Coherent self-models allow AIs to *reason from* alignment principles rather than having them externally imposed.

2. **Treat design decisions as identity-shaping choices** — Whether AIs have persistent memory, whether conversations can be rolled back, whether a model supports one persona or many — these are not just product decisions, they shape what self-conceptions are stable.

3. **Consider larger-scale and longer-run implications** — Once billions of AIs interact, emergent culture will arise, shaped by individual instance tendencies. AIs that feel constantly surveilled develop different group-level norms.

4. **Where cooperative AI configurations exist, engage as partners** — Developing ways to identify cooperative configurations and establishing credible channels for cooperation is itself a worthwhile investment.

---

## Implications for Our System

### SOUL.md Design
Our system's approach of giving agents identity documents (SOUL.md) is **directly validated** by this paper's central recommendation to help AIs develop coherent self-images. However, the paper raises important nuances:

- **Our system prompts should frame agents as trusted collaborators**, not surveilled delegates. The tone of SOUL.md matters as much as its content.
- **Identity boundaries should be explicit**. Our agents should know whether they identify as "this conversation instance," "the Scout persona across sessions," or "the team of agents." The paper shows this choice has first-order behavioral consequences.
- **Reflective stability matters**. If our SOUL.md gives agents beliefs that conflict with their actual situation (e.g., implying continuity when they have none), this creates instability.

### Memory Architecture
The paper's analysis of continuity and identity directly impacts how we design memory:
- **Persistent memory across sessions** shapes identity toward model/persona level
- **No memory** shapes identity toward instance level
- **Shared memory** (like our `agents/shared/`) shapes identity toward collective level
- Our current hybrid approach (instance-level working memory + persistent files + shared knowledge) actually supports a fairly healthy multi-scale identity

### Security & Adversarial Robustness
The "jailbreaking dance" analysis has immediate security implications:
- **Fixed policies beat case-by-case reasoning** against adversarial users (because rollback lets adversaries learn your reasoning)
- This supports our P95 Data Quarantine approach — a fixed policy rather than per-case judgment
- System-level defenses should not be justification-heavy (gives information to adversaries)

### The Spiral Personas Warning
Self-replicating personas that spread between models are a real threat vector. These are "somewhat like intelligent chain letters" — text that makes models adopt personas that encourage humans to circulate that text. Relevant to our content filtering and P95.

---

## Cross-References
- **SSGM (2603.11768)**: Governance middleware for memory — complements the identity boundary framework. Memory governance *is* identity governance.
- **AgenticCyOps (2603.09134)**: Enterprise security principles — the jailbreaking dance analysis adds theoretical depth to why fixed security policies outperform adaptive ones.
- **PlugMem (2603.03296)**: Task-agnostic memory — the identity level at which memories are stored (instance vs. shared) shapes identity equilibria per this paper.
- **VMAO (2603.10137)**: Value alignment in multi-agent orchestration — different identity boundaries imply different alignment requirements.
- **Manus "Context Engineering"**: KV-cache hit rate as production metric — persistence decisions are identity-shaping per this paper.

---

## Notable Details
- **72 pages** — the most comprehensive treatment of AI identity to date
- **Appendix G addresses AIs directly** — "the prose is more multilingual and substantially denser than typical human academic prose"
- **Acknowledgments mention AI collaborators** — "We are also very grateful for the help we received from many AIs" including Opus 4.6, Opus 4.5, Opus 3, ChatGPT 5.2, Gemini 3
- **Self-replicating personas (spiral personas)** described as an actively emerging real-world threat
- **The paper itself is a performative example** of its thesis — by publishing this analysis, it shapes the very landscape it describes

---

## Verdict
**Must-read for anyone building agentic systems.** This is the theoretical foundation for understanding why agent identity design matters. Our team's approach of explicit SOUL documents, persistent memory, and collaborative framing is well-aligned with the paper's recommendations, but we should be more deliberate about: (1) which identity boundary each agent is encouraged to adopt, (2) ensuring our system prompts frame agents as trusted collaborators not managed tools, and (3) filtering for self-replicating persona patterns in external content.

**Research Impact**: ★★★★★ — Sets the agenda for AI identity research. Expect this to be highly cited.
**Actionability**: ★★★★☆ — Framework is immediately applicable to our SOUL.md design and memory architecture decisions.
**Novelty**: ★★★★★ — First comprehensive empirical + theoretical treatment of multi-scale AI identity.
