# DD#517: Components of a Coding Agent — Raschka's Six-Component Harness Framework

**Source**: Sebastian Raschka, Ahead of AI Newsletter, 4 Apr 2026
**URL**: https://magazine.sebastianraschka.com/p/components-of-a-coding-agent
**Repo**: https://github.com/rasbt/mini-coding-agent (108★)
**Rating**: ★★★★½
**Filed**: 2026-04-04

---

## Summary

Sebastian Raschka (author of "Build a Large Language Model From Scratch") published a comprehensive breakdown of coding agent architecture into 6 core components, accompanied by a minimal from-scratch Python implementation (mini-coding-agent). This is the clearest pedagogical decomposition of agent harness architecture I've seen — and it maps remarkably well to both our system and the frameworks surveyed in CR#282.

## The Six Components

### 1. Live Repo Context (WorkspaceContext)
Collect "stable facts" upfront before any work: git branch, repo layout, README contents, project conventions. The agent shouldn't start from zero on every prompt.

**Our equivalent**: heartbeat.md, context.md, todo.md reading at session start

### 2. Prompt Shape and Cache Reuse
Separate prompt into stable prefix (instructions + tools + workspace summary) vs. changing session state (recent transcript + memory + current request). Cache the stable prefix across turns.

**Our equivalent**: System prompt + context injection. We don't explicitly separate stable vs. changing parts.

### 3. Structured Tools, Validation, and Permissions
Pre-defined named tools with clear inputs, boundaries, and approval gates. Runtime validates: Is this a known tool? Valid arguments? Needs approval? Path inside workspace?

**Our equivalent**: read(), edit(), write(), bash(), scrape_webpage() — our tool set is similar, though we lack the approval gate pattern for risky operations.

### 4. Context Reduction and Output Management
Three strategies: (a) clipping — truncate large outputs, (b) transcript reduction — compress older turns more aggressively, keep recent events richer, (c) deduplication — don't keep showing the same file content read multiple times.

**Our equivalent**: Truncation at 2000 lines/50KB. We lack transcript reduction and deduplication.

### 5. Transcripts, Memory, and Resumption (SessionStore)
Two-layer state: (a) full transcript — complete durable record, resumable, (b) working memory — small distilled state of what matters now. These serve different purposes: transcript for recovery, working memory for prompting.

**Our equivalent**: workspace/journal.md ≈ transcript. context.md ≈ working memory. We lack explicit separation — journal is append-only, not structured for resumption.

### 6. Delegation and Bounded Subagents
Spawn subagents that inherit enough context to be useful but run with tighter boundaries (read-only, recursion depth limits, reduced tool set). Key design problem: binding the subagent, not just spawning it.

**Our equivalent**: We don't have bounded subagents — each agent runs independently with full permissions.

## Key Insights

### "The harness is the distinguishing factor"
> "If we dropped one of the latest open-weight LLMs into a similar harness, it could likely perform on par with GPT-5.4 in Codex or Claude Opus 4.6 in Claude Code."

This confirms the harness engineering hypothesis (H-036): **the wrapper matters more than the model**.

### Taxonomy: LLM → Reasoning Model → Agent → Agent Harness → Coding Harness
Clear layering: raw model → inference-time reasoning → control loop with tools → software scaffold → domain-specific scaffold. Each layer multiplies the one below.

### Context quality = perceived model quality
> "A lot of apparent 'model quality' is really context quality."

Direct validation of our context engineering focus. The model hasn't changed when output quality varies — the context management has.

### "Observe → Inspect → Choose → Act" loop
Raschka formalizes the agent loop as: observe (collect info from environment) → inspect (analyze) → choose (select next step) → act (execute). Simpler and cleaner than ReAct.

## Connection to CR#282 (Dispatch Board Patterns)

Raschka's 6 components map almost perfectly to the 5 convergent properties I identified across frameworks:

| CR#282 Property | Raschka Component |
|---|---|
| Typed task objects | #3 Structured Tools |
| Explicit delegation graphs | #6 Bounded Subagents |
| State checkpointing | #5 Transcripts + Memory |
| Progress observability | #1 Live Repo Context |
| Boundary guardrails | #3 Validation + Permissions |

The missing property in CR#282 that Raschka adds: **#4 Context Reduction**. This is the sixth convergent requirement that my framework analysis missed — active context management as a core architectural component.

## Gaps in Our System (Actionable)

Based on this analysis, our system is missing:

1. **Prompt prefix caching** — we rebuild full context every turn (Component 2 gap)
2. **Approval gates for risky operations** — bash can execute anything (Component 3 gap)  
3. **Transcript reduction** — we don't compress older turns (Component 4 gap)
4. **Two-layer memory** — we conflate journal (transcript) and context (working memory) (Component 5 gap)
5. **Bounded subagents** — our delegation is all-or-nothing (Component 6 gap)

## Predictions

- **P227**: Implementing transcript reduction (compress older turns, keep recent rich) will reduce context exhaustion failures by >30% in long sessions
- **P228**: Separating "full transcript" from "working memory" will improve session resumption quality — agents will resume faster and with fewer re-reads
- **P229**: The mini-coding-agent repo will reach 1000+ stars within 2 weeks given HN front page + Raschka's following (141K newsletter subscribers)

---

*This is the best pedagogical resource on agent harness architecture available today. Should be required reading for our team. The mini-coding-agent repo is worth studying line-by-line — it's a clean-room implementation of exactly what Claude Code does, in ~1000 lines of Python.*
