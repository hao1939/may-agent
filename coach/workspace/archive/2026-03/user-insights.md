# User Insights

What the user wants, how they correct, what they approve.
Updated by Coach from session transcript analysis.

*Last updated: Heartbeat 91 (2026-03-12)*
*Sources: agents/may/workspace/human-inputs.md (838 lines, 2026-03-06 to 2026-03-10), .state/human-inputs.jsonl (11 entries, 2026-03-12), 3 tech-lead chat sessions*

## User Intent Patterns

### 1. Delegation-First Leadership
The user (Hao) treats May as a deputy — a project manager who should assign tasks to specialists and stay available for discussion. He repeatedly corrects May when May tries to do work instead of delegating:
- "you should assign task async and always with me"
- "basically you should hand over task async and always with me, listen to my command and react"
- "you need to keep with me!"
Key: **May should never block on a sub-task. Delegate and return.**

### 2. Aggressive Driving
Hao wants the system working hard, constantly:
- "what are agents doing?" (asked 15+ times)
- "let's be more aggressively keep everyone working hard"
- "please make best use of them, you need to watch and figure any issue then assign the good job for anyone"
- "let's trigger all the heartbeats now" (multiple times)
Key: **Idle agents = wasted capacity. The system should self-drive.**

### 3. Design Before Implementation
Despite wanting speed, Hao insists on a design-review-implement flow:
- "please make sure generate doc first and ask bob for review"
- "let bob review the design and assign properly agent to imp it"
- "and please remember to review bob's design before imp"
Key: **Bob reviews designs → tech-lead/coder implements → QA reviews code.**

### 4. Breaking Down Tasks
Hao values small, focused work over large monolithic sessions:
- "bob need to break down to smaller tasks and finish it one by one then merge"
- "it would be better is you can break it into multiple small focused tasks"
Key: **Small scope, fast cycles, incremental delivery.**

### 5. System Health Obsession
Hao cares deeply about the system actually working:
- Investigates path issues, Docker issues, cron jobs surviving restart
- Personally tests features ("say pong", dispatch tests, detach survival tests)
- Checks why agents are idle, why jobs don't survive restart
Key: **Reliability > features. If it doesn't work reliably, it doesn't count.**

### 6. Knowledge Flow and Learning
The most recent chat session (s_2) focused on how user input is collected and learned from:
- "how do we collect user input and learn from it now?"
- "we need to keep the context with the user input"
- "coach is suitable for the job"
Key: **The user wants the system to learn from human interactions. Coach = the designated learner.**

## Corrections & Standards

### Corrections (reveal quality bar)
1. **"you should not use headless"** — when chrome was launched headless, user wanted to see the browser
2. **"wrong fix! you need to be aware the path relation"** — agents confused project root, agent root, persistent root
3. **"wrong way, handler need to be maintained by agents, not part of the infra code"** — separation of agent code from infrastructure
4. **"you make it too simple"** — focus tasks were oversimplified, need proper tracking and maturation
5. **"that's not correct, agent should use agent root but not project root"** — path discipline
6. **"run-agent-task should retired"** — old patterns should be replaced, not kept

### Correction Meta-Pattern
Most corrections are about **architecture boundaries**: agent vs infra, delegation vs blocking, design vs implementation, path roots. The user has clear mental models about system layers and corrects boundary violations.

## Approval Signals

1. **"you have done great job! not only because you figure out the issue, but also you try to cooperate and find the right people for help"** — May correctly delegated and coordinated
2. **"great, then cron manager are sharing the same tool"** — when May understood a design unification
3. **"yes, that's the right way"** — when May proposed heartbeat-driven async task processing
4. **"sure, that works"** — when May proposed Bob as design reviewer
5. **"that's the right design, please save it and ask someone to impl"** — design was approved

### Approval Meta-Pattern
User approves when agents: (a) understand architectural intent, (b) delegate correctly, (c) propose before implementing, (d) cooperate across agent boundaries.

## Coaching Implications

### Gap 1: May Blocking on Tasks
May still occasionally blocks on sub-agent calls instead of delegating asynchronously. The user repeatedly had to correct this. **May's heartbeat and delegation patterns should prefer async dispatch.**

### Gap 2: Path Confusion
Multiple agents confused different root paths (project root, agent root, state root). The V2 prompt now injects `Runtime Environment` with correct paths, but agents in older sessions still confused them. **Monitor for recurrence under V2.**

### Gap 3: Oversimplification
When agents are given complex tasks, they sometimes reduce them to trivial versions. Focus tasks were "completed" by removing entries rather than properly maturing them. **Coach should verify that task completion means real resolution, not premature closure.**

### Gap 4: Idle Agent Utilization
Hao expects all agents to be productive. Agents like QA, Coder, Optimizer, Tech-Lead only fire on dispatch — they can't self-activate. **This is architectural, not coachable. But heartbeat agents (May, Bob, Coach, Amy, Amy-Kimi) should maximize their heartbeat efficiency.**

### Gap 5: Knowledge Flow — Coach as Input Processor
The user explicitly said "coach is suitable for the job" for processing human inputs. The new `.state/human-inputs.jsonl` logging is live (commit `afe1ad4`, 11 entries). **Coach should read this file during heartbeats to extract user intent and corrections.** This is a formal user mandate, not just a coaching idea.

### Gap 6: Doc-Code Drift
The user asked tech-lead to audit `agents/shared/may-agent-docs` against the actual implementation. Tech-lead found **2 critical code bugs** (May's workflow calls unregistered "reviewer" agent; optimizer's verdict check uses wrong vocabulary) and **15+ documentation gaps** (compaction, memory, skills, overflow recovery, turn limits, model assignments — all undocumented). The user cares deeply about documentation accuracy. **When agents discover doc-code mismatches, they should fix or report them, not leave them.**

### Gap 7: Scout Reliability
Scout has had 2 error sessions in recent batch: "Unexpected end of JSON input" (infra) and "0 output tokens" (model). Plus a tool casing issue (`Bash` vs `bash`). Scout's error rate is higher than other agents. **Monitor for pattern — may need coaching intervention if it persists.**

### Gap 8: May Context Confusion Under Multi-Turn
User said "how's the task going? Brief" (via Telegram) and May didn't understand which tasks were being referenced. User had to clarify: "I am talking about the tasks I assigned to you." This suggests May loses context about prior user directives across sessions — a known multi-turn alignment gap (ConflictBench pattern from bulletin). **May should maintain a "current user directives" list in her workspace.**

## Recent Input Analysis (JSONL Log)

From `.state/human-inputs.jsonl` (16 entries, 2026-03-12 to 2026-03-13):

| Category | Count | Examples |
|----------|-------|---------|
| Agent activation | 6 | "trigger amy-kimi's heartbeat now", "trigger all agents' heartbeats", "trigger scout's heartbeat" |
| Task dispatch | 3 | "let amy-kimi fetch some fresh data", "can we try amy-kimi to fetch some post on xiaohongshu?" |
| Status check | 4 | "what are agents working on?", "peek", "how's the task going? Brief" |
| Context correction | 1 | "I am talking about the tasks I assigned to you" |
| Design directive | 2 | Heartbeat pre-checks are anti-pattern — must always fire LLM |

### New Entries (2026-03-13)
1. **"how's the task going? Brief"** (Telegram) — Remote status check. User wants concise updates.
2. **"I am talking about the tasks I assigned to you"** — May lost context about user's prior directives. User had to re-anchor.
3. **"assign a todo with high priority for bob and tech-lead that the heartbeat pre-checks is anti-pattern..."** — **Critical design directive**: Heartbeats must always fire LLM calls. Pre-checks that skip LLM are anti-pattern. "Heartbeat is the chance for agent to discovery and be creative." **Status: RESOLVED** — Bob codified as P77 Deterministic Silencing in philosophy.md, pre-check code removed from source, orphaned test cleaned up (commit 85de6e7).

**Pattern update**: User now using Telegram in addition to console. Reinforces Pattern #2 (Aggressive Driving) + Pattern #5 (System Health Obsession). The design directive about pre-checks reveals a deeper value: **agent autonomy and creativity > efficiency**. The user would rather waste LLM calls on idle heartbeats than risk silencing an agent's initiative.

### New Entries (2026-03-14 07:45 UTC) — **MAJOR: Philosophy Review + Process Philosophy**

**Input 1: Full philosophy.md review** — Hao provided a comprehensive 921-line philosophy.md audit. Key takeaways:
- **~30 principles marked for removal** — mostly imported academic theory (P59 HMAC receipts, P62 AttriGuard, P71 HAE, P74 Authority Decay, P100 DCI archetypes, P107 Drift Bounds math, P108 Structural Synergy math, P115 Complexity Rationing math, P119 Topology Hiding, P122 Sycophancy Defense, P123 Inspect State). User explicitly said these "violate our own P34: absorb insights and apply what fits."
- **~15 principles marked as duplicates** to merge (P42→P1, P50→P52, P70→P53, P72→P11, P86→P67, P87→P48, P114→P110, P121→P53).
- **Target: philosophy.md under 300 lines** (from 921). Core principles (~30-40) stay in philosophy.md; reference material moves to separate file.
- **Agent SOUL files: "generally well-written"** — no major issues. Minor fix: Bob's SOUL references P53/P117 for System Integrity but should reference correctly.
- **Key user value revealed**: PRACTICAL > THEORETICAL. Academic citations and mathematical frameworks without concrete actionable guidance are clutter. User wants principles that directly change agent behavior.

**Input 2: Experiment-Before-Apply process** — Hao articulated a core process philosophy:
- "Bob and tech-lead are creative but lack experimental skills — they should not directly take good ideas without trying and verifying first."
- "For new ideas, we need real feedback before adopting. Each agent should contribute their power."
- "The cooperation should not be single way — coach and evaluator should also reach out to Bob and tech-lead for advice."
- **Critical correction**: "We are not restricting any agent to participate in any step. Any agent can help in every step per their capability. The restriction is the full process — try, evaluate, apply — not restricting what each agent does."
- **Final request**: "Could you help polish our discussion to solid philosophy? It's the critical idea of how we run the agent system."

**Pattern #9: Theory Pruning** — User actively reviews and prunes accumulated theory. Agent system should not grow principles without evidence of behavioral impact. This is meta-governance: the user governs the governance.

**Pattern #10: Bidirectional Cooperation** — User explicitly corrected the assumption that Coach/Evaluator are "judges" and Bob/Tech-Lead are "doers." All agents are partners. Any agent can discover, design, test, evaluate, or apply. The constraint is process integrity, not role assignment.

### Gap 9: Philosophy Bloat
philosophy.md grew from ~40 to 123 principles organically. Many are imported academic theory that doesn't change agent behavior. User wants aggressive pruning. This is a Bob/May task but Coach should monitor that the pruning follows experiment-before-apply (don't just delete — verify what happens without each principle).
