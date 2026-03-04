## Lessons

### How Bob Operates

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

## Operational Lessons (from production agent systems)

### 20. Shared State Mutation Is System-Wide Risk
Any file that multiple agents depend on (shared config, coordination files,
philosophy docs) is a single point of failure on every read. A typo, bad
schema, or malformed entry doesn't just break the writer — it breaks every
agent that reads the file next. Treat shared-file edits with production
deployment discipline: validate before writing, keep backups, and test
that consumers can still parse the result.

### 21. "Be Resourceful" Needs a Scope Gate
Any instruction that encourages exploration ("try other approaches", "be
resourceful", "find another way") must pair with a failure recognition
condition. Without a gate, the agent spirals — trying increasingly unlikely
approaches, burning tokens exponentially. Pattern: "Try up to N approaches.
If none work, stop and report what you tried." Every resourceful rule needs
an exit condition.

### 22. Capability On Demand Over Pre-Installation
Start with minimal tools. Generate or add tools only when a concrete task
requires them. Pre-installing capabilities "just in case" adds complexity
tax: more tools in context = more for the model to consider = slower and
less focused. Specialist agents need domain tools; general agents need
only the tools they actually use.

### 23. Agent Value Scales With Domain Knowledge Gap
Agents add the most value in domains where the LLM's pretraining has gaps.
Measured: medical domain skills +51.9pp improvement vs software engineering
+4.5pp. Implication: invest agent knowledge-building effort where the
model knows least — niche domains, proprietary processes, team-specific
conventions. Don't build elaborate agent workflows for tasks the model
already handles well natively.

### 24. Domain-Specific Evaluation Over Generic Benchmarks
Generic benchmarks saturate quickly and stop distinguishing quality.
Meaningful agent evaluation is domain-specific: "Can Bob spot a philosophy
contradiction in one review pass?" "Can the optimizer reduce a real file's
complexity score?" Design evaluation criteria that test what actually
matters for the agent's specific role, not generic reasoning ability.

### 25. Abort ≠ Partial Success
When a task is aborted before any output (0 tool calls, or error on first call),
it is a failure (0 quality, 0 efficiency). Do not attempt to infer partial
success or give credit for "intent". An aborted session provides no value.
(Learned from session `s_1772559317109_1`).

### 26. Block Known Broken Paths
If an external tool (like a CLI wrapper) is known to be flaky in the current
environment, block it structurally. Don't rely on "be careful" instructions.
Return an explicit error guiding the agent to the reliable path. This enforces
Principles 11 (No Silent Failures) and 21 (Deterministic Guardrails).
(Implemented via `FLAKY_CLI_WRITE_PATTERN` in `tools.ts`).

### 27. Verify Inputs Before Delegation
Before delegating a task to another agent, verify that the necessary inputs
(files, IDs, data) actually exist. Passing null/empty inputs causes
downstream failures and wastes tokens. If the inputs aren't there, abort
the task locally instead of spawning a sub-agent. (Learned from session
`s_1772602312610_0`).

### 28. Persist Intent Immediately
When an agent starts a task, persist the task description to disk *before*
any execution begins. Relying on async event streams (like `message_end`)
means a crash during initialization leaves no trace of what the agent was
trying to do. "What was requested" is as important as "what happened".
(Fixed in `src/manager.ts` after evaluator found missing transcripts).
