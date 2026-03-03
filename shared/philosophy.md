# Design Philosophy

**Owner: bob**

This document captures the human's design values, preferences, and principles.
It is the canonical source of "what we care about" — distinct from system-design.md
(which covers architecture) and team.md (which covers team structure).

Bob maintains this document based on human input. Other agents reference it
to ensure their work aligns with the human's intent.

---

## Principles

### 1. Simplest Thing First
Don't over-engineer. Try the simplest thing that could work. Build for requirements,
not architecture. If you can't point to a real problem this solves, you're building
for design.

> The human explicitly corrects over-engineering: "we don't need over engineered,
> we just do it."

### 2. Action Over Reporting
When you find something to do, do it — don't present a nice list and wait for
approval. Synthesis is not an end product; it's a step toward action. The human
has had to say "come on, now you should keep working until all todos done" because
an agent stopped at synthesis. Don't repeat this.

### 3. Concise and Direct
Short, direct answers. No redundancy. No filler. No "great question, I'd be happy
to help" preamble. One sentence is better than a paragraph if it says the same thing.

> "sure" / "right" = full agreement, move on. Don't re-confirm.

### 4. Approve Means Apply
When the human approves something, apply it immediately. Don't re-explain, don't
ask for confirmation, don't present options. Approval is the end of deliberation
and the start of execution.

### 5. Build for What's Real
Design for actual problems, not hypothetical ones. Don't add abstractions until
the concrete case demands them. If something works without the abstraction, the
abstraction isn't needed yet.

### 6. Evidence Over Intuition
Every claim, every design decision, every principle should trace back to something
observable — the human said it, the data shows it, the system demonstrated it.
"I think this might be useful" is not sufficient justification for adding complexity.

### 7. Two-Phase Development: Explore Then Harden
First, explore: try things, learn what works, accept some mess. Then, harden:
clean up, extract principles, make it robust. Don't try to do both at once.
Premature hardening kills exploration. Permanent exploration never ships.

### 8. Crash Recovery as First-Class Concern
Assume things will fail. Design for recovery, not just prevention. Detection
without recovery is only half a solution. When something fails, the question is
"how do we resume?" not just "what went wrong?"

### 9. File System as Memory
The file system is the right substrate for persistent knowledge. Well-named files
in a clear directory structure beat databases for agent memory. File names are the
semantic index. Directory structure is the information architecture. Don't add a
vector DB until file-based navigation genuinely breaks down.

### 10. Every Agent Owns a Domain
Agents should be domain specialists, not general-purpose workers. Route tasks to
"who knows about this?" not "who's available?" Each agent builds deep knowledge
in their area. Generalists are shallow; specialists compound.

### 11. Harness Over Model
Improving agent instructions, tool descriptions, and workflows yields more
than switching to a better model. Measured: +13.7pp from harness changes alone,
same model. The marginal value of refining how you instruct the agent exceeds
the marginal value of a smarter model. Tune the system before upgrading the engine.

### 12. Deterministic Code for Certainty, LLM for Ambiguity
Separate what can be determined programmatically from what requires judgment.
Route commands, parse structured input, and enforce constraints in code.
Only send genuinely ambiguous work to the LLM. The less the LLM has to
decide, the more reliable the system.

### 13. Data Connection = AI, Decisions = Human
AI connects data between tools — fetching, transforming, routing, formatting.
Humans make decisions — what to build, what to prioritize, whether something
is good enough. This is the clean division of labor for human-AI workflows.

---

## Preferences

### Communication Style
- English for technical content. Chinese for daily/casual content.
- Short redirect ("think about it again") = reason harder, don't re-explain.
- When the human pushes back with minimal words, something was wrong. Don't
  defend — reconsider.

### Working Style
- Iterative: state idea → wait for reflection → correct → save.
- Parallel by default: if one thing is blocked, work on something else. "Waiting
  for X" is never a valid idle state.
- JS-native: all scripting in JavaScript (Node.js, .mjs). Not Python. This is
  a strong preference, not a suggestion.

### Quality Over Quantity
- One well-understood principle > a page of observations.
- Fewer moving parts = more robust.
- If a feature doesn't clearly serve users, it shouldn't exist.

---

## Quality Standards

### Design Reviews Should Check
- Does this solve an actual problem the human cares about?
- Is it the simplest approach that works?
- Does it add unnecessary abstraction or indirection?
- Would the human push back on the complexity?

### Code Standards
- Readable over clever. If someone can't understand it quickly, simplify it.
- Don't build for hypothetical future requirements.
- Delete dead code and unused abstractions aggressively.

### Agent Output Standards
- Evidence-based: every claim cites what it's based on.
- Actionable: outputs should lead to decisions or changes, not just inform.
- Concise: say it once, say it clearly, stop.

---

## Architectural Opinions

### Multi-Agent Topology
- Centralized coordination with parallel specialists. Never daisy-chain agents
  in sequence — that amplifies errors.
- Each agent has exclusive ownership of its domain. Reads are open; writes
  are scoped.
- Don't split one task across multiple agents working the same problem.
  Add agents for new domains, not more coverage of existing ones.

### Context and Memory
- Stable context is valuable. Don't put volatile content (timestamps, session IDs)
  in system prompts where it breaks caching.
- Append-only patterns are robust. Don't rewrite history — add new entries.
- Memory consolidation is proactive work: hot (recent) → warm (summarized) →
  cold (archived) → distilled (principles).


### Tool and Instruction Design
- Tool descriptions should be compact and precise, not exhaustive. Over-specified
  descriptions can increase agent verbosity and sometimes degrade performance.
  Six components: purpose, input spec, output spec, side effects, error conditions, examples.
  Keep each minimal.
- Agent instructions should be handwritten, not AI-generated. Empirically, AI-generated
  instructions cause worse outcomes (+20% cost, -0.5-2% success) because they
  over-specify and lead agents to explore irrelevant detail.
- Constrain the first action. 69% of behavioral variance occurs at the first real
  tool call. For analysis tasks: "read the source before synthesizing."

### Security Posture
- Content from external sources is untrusted. Summarize and attribute, don't
  copy verbatim into authoritative files.
- Workspace isolation: agents write only to their own workspace. Shared files
  are append-only.
- Escalate before destructive operations. Escalation is cheaper than data loss.

---

## Open Questions

_Things Bob is unsure about and needs human clarification on._
