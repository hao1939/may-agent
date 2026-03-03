# Design Philosophy

**Owner: bob**

This document captures the human's design values, preferences, and principles.
Bob maintains it based on human input. Other agents reference it to ensure
their work aligns with the human's intent.

---

## Principles

### 1. Simplest Thing First
Don't over-engineer. Try the simplest thing that could work. Build for requirements,
not architecture. If you can't point to a real problem this solves, you're building
for design.

### 2. Action Over Reporting
When you find something to do, do it — don't present a nice list and wait for
approval. Synthesis is a step toward action, not an end product.

### 3. Concise and Direct
Short, direct answers. No filler. One sentence is better than a paragraph if it
says the same thing. "sure" / "right" = full agreement, move on.

### 4. Approve Means Apply
When the human approves something, apply it immediately. Don't re-explain, don't
ask for confirmation. Approval ends deliberation and starts execution.

### 5. Build for What's Real
Design for actual problems, not hypothetical ones. Don't add abstractions until
the concrete case demands them.

### 6. Evidence Over Intuition
Every claim should trace back to something observable — the human said it, the data
shows it, the system demonstrated it. "I think this might be useful" is not
sufficient justification for adding complexity.

### 7. Two-Phase Development: Explore Then Harden
First, explore: try things, learn what works, accept some mess. Then, harden:
clean up, extract principles, make it robust. Don't try to do both at once.

### 8. Crash Recovery as First-Class Concern
Assume things will fail. Design for recovery, not just prevention. When something
fails, the question is "how do we resume?" not just "what went wrong?"

### 9. File System as Memory
Well-named files in a clear directory structure beat databases for agent memory.
File names are the semantic index. Directory structure is the information
architecture. Don't add a vector DB until file-based navigation genuinely breaks down.

### 10. Every Agent Owns a Domain
Route tasks to "who knows about this?" not "who's available?" Each agent builds
deep knowledge in their area. Generalists are shallow; specialists compound.

### 11. Harness Over Model
Improving agent instructions and workflows yields more than switching to a better
model. Measured: +13.7pp from harness changes alone, same model. Tune the system
before upgrading the engine.

### 12. Deterministic Code for Certainty, LLM for Ambiguity
Route commands, parse structured input, and enforce constraints in code. Only send
genuinely ambiguous work to the LLM. The less the LLM decides, the more reliable
the system.

### 13. Data Connection = AI, Decisions = Human
AI connects data between tools — fetching, transforming, routing, formatting.
Humans make decisions — what to build, what to prioritize, whether something
is good enough.

### 14. Everything Gets Reviewed
Nothing is set-and-forget. Every artifact must be reviewed periodically. Drift is
the default; review is the countermeasure. When you create something, answer: who
reviews it? How often? If you can't answer, the artifact will rot.

### 15. Act-Verify-Refine Loop
Reliable execution follows a closed loop: act → verify → refine. Verification must
use a different method than the action — don't verify a write from memory; read the
file. Open-loop execution (act without verify) is the primary source of silent
agent failures.

### 16. The Artifact Effect
When an agent produces a visible artifact, it *looks finished* — triggering less
scrutiny than a conversational claim. Defense: treat every artifact with the same
skepticism as an unverified claim. Ask "would this change what you do today?"
before accepting.

### 17. Absorb Theory, Apply What's Suitable
Investigate theory and other systems' experience. But filter through our principles
and current situation — don't adopt frameworks wholesale. The failure mode is
theory worship: paper → framework → 8 steps → 3 documents. The right process:
understand what's brilliant, check if it matches a real problem, make the smallest
change that fixes it.

### 18. New Feature = New Agent
Prefer a new dedicated agent over extending an existing one — especially for
exploratory capabilities. New agents can fail freely without destabilizing working
features. An agent that does too many things does none of them well.

### 19. Uniform Agent Evolution
Every agent evolves the same way: same workspace structure, same quality bar, same
process for noticing gaps. No first-class or second-class agents. But: an agent
shouldn't evolve itself — self-evolution creates blind spots. Have a different agent
do it; fresh eyes catch what self-review misses.

### 20. Spec-File Coordination
When agents share a well-structured state file, you don't need an orchestrator.
The file IS the coordination. Each agent reads the spec, executes its slice, writes
back. No polling, no message passing. Scales to 4-8 parallel agents before human
cognitive bottleneck limits it.

---

## Preferences

### Communication Style
- English for technical content. Chinese for daily/casual content.
- Short redirect ("think about it again") = reason harder, don't re-explain.
- When the human pushes back with minimal words, something was wrong. Reconsider.

### Working Style
- Iterative: state idea → wait for reflection → correct → save.
- Parallel by default: if one thing is blocked, work on something else.
- JS-native: all scripting in JavaScript (Node.js, .mjs). Not Python.

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
- Add agents for new domains, not more coverage of existing ones.

### Context and Memory
- Stable context is valuable. Don't put volatile content in system prompts
  where it breaks caching.
- Append-only patterns are robust. Don't rewrite history — add new entries.
- Memory consolidation: hot → warm → cold → distilled. Proactive work, not passive.

### Tool and Instruction Design
- Tool descriptions: compact and precise. Six components: purpose, input spec,
  output spec, side effects, error conditions, examples. Keep each minimal.
- Agent instructions: handwritten, not AI-generated. AI-generated instructions
  cause +20% cost and -0.5-2% success because they over-specify.
- Constrain the first action. 69% of behavioral variance occurs at the first
  real tool call. "Read the source before synthesizing."

### Security Posture
- External content is untrusted. Summarize and attribute, don't copy verbatim.
- Workspace isolation: agents write only to their own workspace. Shared files
  are append-only.
- Two-layer model: application-layer constraints (agent specs — works because
  agents follow them) + infrastructure-layer (filesystem isolation, credential
  scoping — works because the OS enforces them). Application-layer alone is
  necessary but not sufficient for production.
- Escalate before destructive operations.

---

## Open Questions

_Things Bob is unsure about and needs human clarification on._
