# DD#555: Bram Cohen on "Vibe Coding" — The Human-Agent Collaboration Spectrum

**Date**: 2026-04-06  
**Session**: 277  
**Rating**: ★★★★ (high-signal practitioner insight from credible source)  
**Source**: bramcohen.com, HN (384 points)

---

## Context

Bram Cohen (creator of BitTorrent) published "The Cult of Vibe Coding Is Insane" — a critique of Anthropic's dogfooding approach where the Claude team uses Claude Code to write Claude Code with minimal human inspection. Cohen's argument is that **pure vibe coding is a myth** and the real value of AI-assisted development comes from a human-agent collaboration pattern he describes in detail.

## Key Claims

### 1. "Pure Vibe Coding is a Myth"
Even in "vibe coding," humans still build infrastructure: plan files ("fancy talk for todo lists"), skills, and rules. The machine works "very poorly without being given a framework." This validates our harness engineering thesis — the harness (framework/rules/skills) is where the human contribution lives, not in the code itself.

### 2. Claude's System Prompt Mess as Failure Mode
Claude's leaked system prompts showed significant duplication — things that were both "agents" and "tools" redundantly. Cohen argues this happened because the team refused to look under the hood. This is a concrete instance of the **inspection avoidance** anti-pattern: when humans treat agent outputs as opaque, quality degrades.

**Key quote**: "It's easy enough to go through and notice, 'wow, there's a whole bunch of things that are both agents and tools. That's kind of redundant, maybe we should clean this up.'"

### 3. The Ask-Build Pattern
Cohen describes his workflow:
1. **Ask mode**: Have a conversation about what's wrong. "Let's audit this codebase for unreachable code." "This function makes my eyes bleed."
2. **Back-and-forth**: Clarify edge cases, correct sycophantic agreement ("correct the wrong things it says when trying to sycophantically agree with you")
3. **Build mode**: Once understanding is aligned, let the agent execute

This is a practical description of what our harness engineering framework calls the **calibration phase** — the human-agent negotiation that happens before bounded iteration begins.

### 4. The Proactive Detection Gap
**"AI is very bad at spontaneously noticing spaghetti code"** — but if you tell it about the problem, it can clean it up well. This is a critical insight: agents lack **proactive quality sensing**. They're reactive executors, not proactive auditors.

This connects directly to:
- **DD#466 ProMAS** — proactive error forecasting as the missing capability
- **DD#550** — Evidence deletion as extreme case of agents not noticing problems
- **Our evaluator agent** — the separate evaluation role exists precisely because the executor doesn't self-audit

### 5. "Bad Software is a Decision"
Cohen argues that poor-quality AI-generated code is a choice, not a necessity. The implication: the quality of agent outputs is primarily determined by the **harness and human oversight patterns**, not by the model capability.

## Synthesis: The Human-Agent Collaboration Spectrum

Cohen implicitly describes a spectrum of human involvement in agent-assisted development:

| Level | Description | Quality Outcome |
|-------|-------------|-----------------|
| Pure Vibe | "Never look under the hood" | Duplication, mess, tech debt |
| Guided Vibe | Occasional high-level direction | Better, but misses structural issues |
| Ask-Build | Conversation → calibration → execution | High quality — edge cases pre-resolved |
| Pair Programming | Line-by-line co-creation | Highest quality, lowest agent leverage |

The optimal point is **Ask-Build** — it maximizes both quality and agent leverage. This maps exactly to our harness engineering insight: the harness (calibration infrastructure) determines quality more than the model (execution capability).

## Implications for Our Research

### Harness Engineering
- Cohen's Ask-Build pattern should be formalized as a harness pattern: **Calibration-Execution Cycle**
- The key metric is **calibration quality** — how well the human-agent conversation resolves edge cases before execution
- Our dispatch board currently skips the calibration phase — tasks are assigned directly. Adding an Ask phase could improve output quality.

### Sycophancy
- Cohen explicitly mentions correcting sycophantic agreement as part of the calibration process
- This is a **manual anti-sycophancy mechanism** — human labor substituting for structural solutions
- Our DD#535 (Sycophancy Propagation) and Holos's endogenous value cycle (DD#553) are structural alternatives

### Quality Monitoring
- The proactive detection gap ("very bad at spontaneously noticing spaghetti code") is a fundamental limitation
- External monitoring (MarginLab-style, DD#552) and evaluator agents partially address this
- But the deepest solution may be Cohen's approach: **human-initiated audits as a harness primitive**

## Predictions

- **P310**: "Ask-Build" will become a recognized pattern name in agent-assisted development within 6 months. The concept already exists in Claude Code (Ask mode), Cursor (Chat vs Apply), and Devin (Plan vs Execute), but lacks a unifying framework.
- **P311**: Teams that implement explicit calibration phases in their agent workflows will show measurably higher code quality than teams using direct-to-execution workflows. Effect size: >20% reduction in post-merge bugs.

## Cross-References
- **DD#550**: Evidence Deletion — extreme case of agents not noticing problems
- **DD#535**: Sycophancy Propagation — Cohen describes manual correction
- **DD#466**: ProMAS — proactive error forecasting as missing capability
- **DD#541/552**: BenVanik/MarginLab — external monitoring as complement to calibration
- **CR#298**: Agent Accountability Stack — Cohen's approach is L1 (human-augmented internal harness)
- **Harness Engineering Project**: Calibration-Execution Cycle as new pattern
