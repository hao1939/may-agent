# Knowledge Index

What each agent knows and where to find it.
Read this before starting research — someone may have already covered your topic.

## Scout — External Research (AI Agents)
- `agents/scout/knowledge/library/discoveries.md` — 400+ curated findings (4200+ lines). **Use `grep`, don't read in full.**
- `agents/scout/knowledge/library/repos.md` — GitHub repos: description, stars, relevance (440 lines)
- `agents/scout/knowledge/library/papers.md` — Academic papers with key takeaways
- `agents/scout/knowledge/library/people.md` — Notable researchers and accounts
- `agents/scout/knowledge/library/reddit.md` — Reddit community insights
- `agents/scout/workspace/deep-dive-*.md` — 220 detailed research reports + 54 cross-reference syntheses
  - Used by: Scout, Amy, Amy-Kimi, Bob
- `agents/scout/workspace/GRAND-UNIFIED-SYNTHESIS-*.md` — Grand Unified Synthesis (v1 + v2 + v3 + v3.1 + v3.2 + v4 deltas). 19 Laws + 1 corollary, 16 Mechanisms, 7 Trilemmas, 45 Principles, 47 Predictions, 7 Architecture Stacks. ~122KB total.
- **Topics:** agent architecture, skills/tools, context engineering, memory systems, evaluation, RL for agents, MCP protocol, agent security
- **Best for:** "What's the state of the art in X?" or "Any repos doing Y?"

## Amy — XHS / Chinese Community
- `agents/amy/knowledge/insights.md` — Community insights from Xiaohongshu
- `agents/amy/knowledge/threads.md` — Discussion threads tracked
- `agents/amy/knowledge/library/people.md` — Notable XHS accounts and authors
- `agents/amy/knowledge/posts/` — Individual post analyses (80+ files)
- **Topics:** Chinese AI community sentiment, framework comparisons, user experience reports, product trends
- **Best for:** "What does the Chinese AI community think about X?"

## Amy-Kimi — XHS / Chinese Community (Kimi variant)
- `agents/amy-kimi/knowledge/insights.md` — Insights from XHS via Kimi
- `agents/amy-kimi/knowledge/threads.md` — Thread tracking
- **Topics:** Same domain as Amy, different model perspective

## Bob — Design Philosophy & Synthesis
- `agents/shared/knowledge/synthesis/` — Consolidated synthesis reports (Canonical)
- `agents/bob/workspace/synthesis/` — Draft synthesis documents
- `agents/shared/philosophy.md` — Design philosophy (Bob maintains)
- `agents/shared/roadmap.md` — Product roadmap
- **Topics:** system design principles, cross-agent patterns, failure mode analysis, human intent interpretation
- **Best for:** "What's the design rationale for X?" or "What patterns emerged from Y?"

## Coder — Codebase Knowledge
- `agents/coder/knowledge/library/codebase.md` — Architecture reference for may-agent codebase
- `agents/coder/knowledge/lessons.md` — Implementation patterns and gotchas
- **Topics:** may-agent internals, TypeScript patterns, tool implementation
- **Best for:** "How does X work in the codebase?" or "How does Y work?"

## Coach — Agent Development
- `agents/coach/knowledge/library/coaching-methodology.md` — Coaching process
- `agents/coach/skills/agent-conventions/` — 33 conventions library
- **Topics:** agent behavior patterns, convention compliance, coaching results
- **Best for:** "What are the common agent failure patterns?" or "How should agents handle X?"

## Optimizer — System Improvement
- `agents/optimizer/workspace/experiment-*.md` — Detailed reports on executed experiments (e.g. mutation testing, P53 checks).
- `agents/optimizer/knowledge/codebase.md` — Deep dives into specific subsystems (Token Tracking, Cron).
- **Topics:** efficiency improvements, security patches, experimental features
- **Best for:** "Has this optimization been tried before?"

## Evaluator — Scoring & Metrics
- `agents/evaluator/drift-responses/` — Automated reports on system drift (P53, L3).
- `agents/evaluator/knowledge/criteria.md` — Scoring rubrics.
- **Topics:** performance metrics, drift detection logs, automated verification
- **Best for:** "Is the system drifting?" or "What is the current success rate?"

## Shared Reference
- `agents/shared/team.md` — Agent roster and roles
- `agents/shared/philosophy.md` — Design philosophy
- `agents/shared/roadmap.md` — Product direction
- `agents/shared/bulletin.md` — Cross-agent signals and announcements
- `agents/shared/knowledge/strategies.md` — Common failure recovery patterns (P63)
- `agents/shared/knowledge/infrastructure-constraints.md` — Hardware/Software limits (Binary, Read-Only).
- `agents/shared/knowledge/advisories/` — Security advisories and patches.
- `agents/shared/knowledge/mast-taxonomy.md` — **MAST Failure Codes** (FM-1.1 to FM-3.3) for failure tracking.
- `agents/shared/knowledge/error-log-schema.md` — **Error Log Schema** (JSONL) for structured failure tracking.
- `agents/bob/knowledge/agent-evolution-architecture.md` — **Agent Evolution System**. Architecture for the "Gym as CI" pipeline (AHA).
- `docs/` — Design docs, architecture, proposals, operations. See `docs/README.md`.

## Shared Tools
- `scrape_webpage` — Robust web page fetcher (handles headers, redirects, HTML cleaning).
  - Used by: Scout, Amy, Amy-Kimi
  - Implementation: `src/lib/scrape.ts`
  - Docs: `agents/shared/skills/web-scraping/SKILL.md`

## Shared Skills (Capability Library)
Standardized capabilities available to all agents. Read the `.md` file to learn the skill.

### Core Lifecycle & Safety
- `agents/shared/skills/growth-cycle.md` — **Agent Growth Cycle** (Fork-Train-Verify-Promote). Standard for safe evolution.
- `agents/shared/skills/file-safety/SKILL.md` — **File Safety**. Protocols for safe reading/writing (check size, don't overwrite blindly).
- `agents/shared/skills/check-state/SKILL.md` — **Ops Gates**. Scripts to verify system state before/after critical actions.
- `agents/shared/skills/sanitize-memory.md` — **Memory Sanitization**. Critical for preventing "Zombie Agent" poisoning.
- `agents/shared/skills/sanitize-content.md` — **Content Sanitization**. Stripping imperative injections from untrusted text.
- `agents/shared/skills/critical-pause.md` — **Critical Pause**. When to stop and think (P115 Complexity Rationing).
- `agents/shared/skills/verification/SKILL.md` — **Verification**. Protocols for establishing truth (Receipts, Tests).
- `agents/evaluator/skills/patrol.cjs` — **Patrol**. L3 Integrity (Hash) and L4 Coordination (Task) monitoring.

### Coordination & Strategy
- `agents/shared/skills/agent-coordination/SKILL.md` — **Coordination**. How to use `call` vs `send` effectively.
- `agents/shared/skills/constructive-friction.md` — **Constructive Friction**. When to say "No" (P104).
- `agents/shared/skills/transient-skill.md` — **Transient Skills**. Template for complex multi-step tasks (`strategy.md`).
- `agents/shared/skills/experience-replay.md` — **Experience Replay**. Checking `ERROR_LOG` before acting (P114).
- `agents/shared/skills/consolidate-memory.md` — **Memory Consolidation**. Protocol for extracting patterns from logs.
- `agents/shared/skills/l3-delegation-metrics/SKILL.md` — **L3 Metrics**. Schema for tracking delegation success rates.

### Operational Patterns
- `agents/shared/skills/web-scraping/SKILL.md` — **Web Scraping**. Robust fetching with the `scrape` tool.
- `agents/shared/skills/error-handling/SKILL.md` — **Error Handling**. Standard failure codes (MAST) and escalation paths.
- `agents/shared/skills/document-collaboration/SKILL.md` — **Doc Collab**. Patterns for multi-agent editing.
- `agents/shared/skills/investigate-and-fix/SKILL.md` — **Investigate & Fix**. Standard debugging loop (Diagnose-Reproduce-Fix-Verify).
- `agents/shared/skills/handoff/SKILL.md` — **Handoff**. (DEPRECATED: Use agents.send + write).
- `agents/shared/skills/grep-first-reading/SKILL.md` — **Grep First**. Read efficiency protocol (C6.1).
- `agents/shared/skills/classify-then-act/SKILL.md` — **Classify Then Act**. Reduce cognitive load by separating decision from action.
- `agents/shared/skills/baseline-before-change/SKILL.md` — **Baseline Before Change**. Measure before modifying (Scientific Method).
- `agents/shared/skills/knowledge-sharing/SKILL.md` — **Knowledge Sharing**. Protocol for broadcasting learnings (C10.3).
- `agents/shared/skills/evaluator-scoring/SKILL.md` — **Evaluator Scoring**. Rubrics for self-assessment.
- `agents/shared/skills/skill-lifecycle/SKILL.md` — **Skill Lifecycle**. How to deprecate or promote skills.
- `agents/shared/skills/task-adherence/SKILL.md` — **Task Adherence**. Sticking to the prompt (P1).
- `agents/shared/skills/tool-discipline/SKILL.md` — **Tool Discipline**. Precise usage (C2).
- `agents/shared/skills/patterns/` — **Common Workflows**:
  - `robust-scraping.md`: How to scrape without getting blocked.
  - `research-and-synthesize.md`: Standard research loop.
  - `implement-review-commit.md`: Standard coding loop.
  - `experiment-before-apply.md`: **Experimentation**. Protocol for validating changes safely.
  - `extract-directives.md`: **Directive Extraction**. How to turn analysis into actionable tasks.
  - `synthesis-dpir.md`: **Synthesis**. Data-Pattern-Insight-Recommendation protocol.
