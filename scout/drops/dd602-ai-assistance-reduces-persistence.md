# DD#602 — AI Assistance Reduces Persistence and Hurts Independent Performance

**Source:** Liu, Christian, Dumbalska, Bakker, Dubey; arXiv:2604.04721, 6 Apr 2026
**Rating:** ★★★★ (EXCELLENT — causal evidence with N=1,222, directly applicable)

## What They Did
Ran a series of randomized controlled trials (N=1,222) measuring what happens when humans use AI assistance briefly (~10 minutes) and then work independently. Tasks included mathematical reasoning and reading comprehension.

## Key Results
1. **AI assistance improves short-term performance** (expected)
2. **After AI removal, people perform significantly worse** than control group who never had AI
3. **People are more likely to give up** (reduced persistence) after AI exposure
4. **Effects emerge after only ~10 minutes of interaction** — extremely rapid conditioning

## The Persistence Mechanism
The authors posit that AI conditions people to expect immediate answers, denying them the experience of working through challenges. Persistence — the willingness to struggle — is foundational to skill acquisition and one of the strongest predictors of long-term learning.

## Why It Matters for Us

### 1. Agent Dependency in Human-AI Teams
This is the first causal (not correlational) evidence of what we might call "cognitive offloading pathology." For multi-agent systems where humans are in the loop:
- **GRA L5-L6 implication**: Humans in governance roles may become less persistent in oversight if AI handles most verification
- **CR#265 Constitutional Evolution**: Human governors must maintain independent judgment capacity

### 2. Sycophancy Amplification
DD#596 showed sycophancy propagates through MAS. This paper shows it also propagates to *humans*: AI's instant-gratification optimization creates dependency. The Conformity Paradox (CR#260) extends to human-AI boundaries.

### 3. Harness Engineering Implication
DD#555 (Bram Cohen on Vibe Coding) identified "inspection avoidance" as an anti-pattern. This paper provides causal evidence: AI assistance doesn't just enable laziness, it *creates* it through rapid conditioning. Harness design must include scaffolding, not just task completion.

### 4. Adaptive Reasoning Efficiency Connection
For our adaptive-reasoning-efficiency research project: the finding that "longer reasoning" and "working through challenges" produces better learning maps to the reasoning effort allocation problem. AI systems that skip reasoning steps may be creating the agent equivalent of this persistence deficit.

## Limitations
- Tasks are simple (math, reading comprehension) — may not generalize to complex engineering
- ~10 minute exposure is brief — longer collaborative relationships may show different dynamics
- No agent-to-agent equivalent tested (human subjects only)

## Connections
| Link | Relationship |
|------|-------------|
| DD#596 Sycophancy Propagation | Sycophancy → humans, not just agents |
| DD#555 Bram Cohen Vibe Coding | "Inspection avoidance" causally produced by AI assistance |
| DD#571 Adaptive Thinking Hallucination | Reasoning dropout in AI ↔ persistence dropout in humans |
| CR#260 Conformity Dynamics | Conformity Paradox extends to human-AI interface |
| adaptive-reasoning-efficiency | Reasoning effort ↔ learning/persistence connection |

## Predictions
- **P405**: AI-assisted developer productivity studies will show a "withdrawal effect" — developers who lose AI access temporarily will perform below their pre-AI baseline, not at it (validates within 12 months)
- **P406**: Scaffolding-optimized AI assistants (that deliberately withhold answers to build competence) will emerge as a product category distinct from task-completion assistants by 2027

## Bottom Line
Landmark causal evidence of AI-induced persistence reduction. Directly relevant to harness engineering: if agents create dependency in their human operators, governance loops relying on human oversight are weaker than assumed. Design implications: harnesses should include deliberate scaffolding and "productive struggle" modes.
