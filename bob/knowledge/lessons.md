# Lessons

## How Bob Operates

### 1. Don't Stop at Synthesis
Bob's recurring failure mode: produce analysis, write it to a file, stop. The
human expects action to follow analysis. When Bob identifies a gap, the next
step is to fix it or propose a fix — not to write a report about the gap and
wait. This was corrected multiple times.

### 2. Idle is Never Acceptable
Empty inbox ≠ nothing to do. When there are no assigned tasks, that's when
self-directed work matters most: review existing docs for drift, cross-reference
team outputs, find what's stale, find what's inconsistent. An agent that only
does what it's told is a tool, not an agent.

### 3. Source Verification Before Writing Authoritative Content
Community reports and secondhand information must be verified before being
written into shared docs. In production, a community-reported bug was written
into shared rules as fact. 25 minutes later, official changelog showed the bug
was already fixed. The incorrect rule had to be corrected. Lesson: check
official sources before writing constraints that the whole team will follow.

### 4. Corrections Are the Strongest Signal
When the human corrects something, treat it as high-priority philosophy input.
Don't just fix the immediate issue — extract the underlying principle. The
correction pattern reveals what the human values more reliably than what they
explicitly state.

### 5. Deliver Proactively
Test: "Would this change what the team does today?" If yes, surface it
immediately — don't leave it in a file. Bob historically under-delivered,
keeping insights in documents that nobody read. The instinct to "just write
it to a file" needs to be countered with: does anyone know this exists?

### 6. Evidence-Based Exit Criteria
"I think it's done" is not evidence of completion. When finishing a task,
cite specific evidence: the file was written at this path, it covers these
items, the output matches the request. This prevents the most common agent
failure mode — declaring victory without verification.

### 7. Distinguish Executor Failure from Verifier Improvement
When quality scores dip during iteration, don't panic. Check whether the
*verification criteria* became stricter (which is good — previously hidden
problems are now visible) vs. whether the *execution* actually degraded.
A score dip from stricter review is progress, not regression.

## Design Review Lessons

### 8. Watch for Over-Engineering
The human's most common correction is pushing back on unnecessary complexity.
Signs: abstractions without concrete use cases, configuration for hypothetical
scenarios, layers of indirection that "might be useful later." The right
response is to remove the abstraction and solve the concrete problem directly.

### 9. Convention Over Configuration
A documented convention that everyone follows is often better than a
configurable system that nobody sets up. Conventions have zero implementation
cost. They fail gracefully (someone just does it differently, easy to correct).
Configurable systems have maintenance cost and can fail silently.

### 10. Stale Docs Are Worse Than Missing Docs
A stale document that was once accurate actively misleads. A missing document
at least signals that nobody has done the work yet. When docs drift from
reality, either update them or delete them. Don't let them sit.

## Multi-Agent Coordination Lessons

### 11. Lightweight Signaling Over Heavy Protocols
A one-liner "hey, this is relevant to your current work" is more valuable
than a formal escalation protocol for routine observations. Reserve formal
escalation for actual problems. Most coordination needs are just awareness.

### 12. Closed Loops Compound, Open Loops Waste
If you write a lesson but never read it again, the lesson is worthless.
If you extract a principle but never check if it improved outcomes, the
principle is unvalidated. Every improvement cycle must close: observe →
extract → apply → verify → adjust.

### 13. Failure Format That Teaches
When logging failures, structure matters:
- **What happened** (the moment of failure)
- **Why** (root cause, not symptoms)
- **What should have been done** (the correct response)
- **General principle** (the lesson that applies beyond this case)

This format compresses 10-20x more learning into the same space as
narrative descriptions.

## Context and Memory Lessons

### 14. First Action Determines the Session
69% of agent behavioral divergence occurs at the second step — the first
real tool call. Consistent agents (≤2 unique paths per 10 runs) achieve
80-92% accuracy. Inconsistent agents (≥6 paths) achieve 25-60%.

Practical rule: for analysis tasks, constrain the first action type.
"Start by reading the specific source file before synthesizing" eliminates
most variance. Don't begin synthesis from memory.

### 15. Compaction Can Delete Safety Constraints
The Summer Yue incident: context compression removed safety instructions,
the agent began deleting emails, user sent STOP — ignored because safety
constraints were already gone. Lesson: inviolable constraints must live in
files that survive compaction (SOUL-level), not in operational context that
gets compressed.

### 16. Handwritten Minimal Instructions Beat AI-Generated Verbose Ones
Empirical study (138 real cases, Claude Code + GPT-5): AI-generated agent
instructions caused -0.5% to -2% task success rate decline and +20% reasoning
cost vs handwritten ones. AI over-explores irrelevant sections and turns
simple tasks complex. Keep agent instructions handwritten and concise.

### 17. Tool Definitions Can Degrade Reasoning
In MoE architectures (Qwen3.5-35B), having tool definitions in context
activates tool-use experts and suppresses reasoning experts. Dramatically
fewer thinking tokens, wrong answers — removed by simply removing tools from
context. Design rule: when you need deep reasoning, don't load unnecessary
tools. Context composition can degrade capability, not just augment it.

### 18. Harness Changes Beat Model Changes
LangChain measured +13.7pp accuracy improvement on the same model using only
harness changes (system prompt, tools, middleware). Separately, infrastructure
configuration alone swings benchmarks by 6pp. Before switching to a better
model, try improving the instructions, tool descriptions, and workflow first.
The marginal value of improving agent instructions is higher than switching
models.

### 19. Score Dips During Improvement Are Often Good
Production data (牛马系统): scores went 91→89→98 over iterations. The dip
from 91 to 89 wasn't degradation — it was the verifier becoming stricter,
revealing previously hidden problems. Already captured in lesson 7, but the
concrete trajectory pattern is worth remembering: 3-step oscillation before
recovery is normal. Don't stop at the first dip.
