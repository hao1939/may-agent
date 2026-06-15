<ai_context>
summary: "Cross-source synthesis: The system's largest cost isn't output or compute — it's the mass of repeated, identical prompt text delivered to sessions that immediately exit. 141MB of task text was delivered across 16K sessions in 3 days. 51.5% of all task-text bytes are evaluator aftermath sessions echoing the original session's full task. Dev burns 93% of its task-text on sessions that exit within 10 ops. The system has invented a novel inefficiency: it pays the full input cost of context-rich prompts even when the session's first act is to determine nothing needs doing. Prior syntheses (Impedance, Observability, Abstention) analyzed the output side and compute side of feedback loops. This note identifies the INPUT side — the prompt mass delivered per session — as a distinct cost center that grows with system maturity and is invisible to all existing metrics."
triggers: ["prompt mass", "input cost", "task text", "context nesting", "evaluator echo", "template repetition", "cold start cost", "quick exit cost", "token budget", "prompt efficiency"]
last_updated: "2026-07-17"
source_basis: "Production data analysis: 3-day window, 16K sessions, 141MB task text. Evaluator aftermath: 7,208 sessions averaging 10,631 chars each = 73MB echoed task text. Dev quick-exit: 593 sessions × 11,835 chars = 6.7MB of 11K-char prompts read and immediately exited. Arc: 14,548 avg task chars, 8 distinct templates, 79.8 sessions per template. Cross-referenced with Impedance Principle (feedback loop amplification), Observability Trap (meta-observation cost), Abstention Advantage (quick-exit efficiency), PerspectiveGap arXiv 2606.08878 (orchestration prompt quality ≠ task quality), InquiTree arXiv 2606.09550 (context length degrades judgment)."
</ai_context>

# The Prompt Mass Problem: Why Input Costs Dwarf Output Costs in Mature Agent Systems

*A cross-source synthesis — production data reveals a cost structure invisible
to all prior analyses and all existing metrics.*

## The Observation

Every prior synthesis in this library analyzes what agents *produce*: output
loops (Impedance), observation volume (Observability Trap), action decisions
(Abstention). But the production data reveals that the system's dominant cost
is on the *input side* — the sheer mass of prompt text delivered to sessions
before they do anything at all.

**In the last 3 days, the system delivered 141 MB of task text across 16,314
sessions.** That's ~37 million tokens of *input* just for the task field
— before system prompts, context files, tool schemas, or conversation
history.

## The Three Drivers

### Driver 1: The Evaluator Echo (51.5% of all task text)

The evaluator reviews other agents' sessions. To do so, it receives the
*entire original task text* of the session being reviewed, embedded inside
its own task prompt. This creates a **context echo**: every substantive
session's task text is transmitted at least twice — once to the original
agent, once to the evaluator.

```
3 days: 7,208 evaluator aftermath sessions
Average task text: 10,631 chars (≈2,658 tokens)
Total: 73 MB of task text — 51.5% of ALL system task text

The evaluator's task for reviewing an arc session (14.5K avg chars)
is itself 18.3K chars — the arc prompt PLUS the evaluator wrapper.
```

The echo is worse for verbose agents. When evaluator reviews an arc
heartbeat, it delivers a task that is ~18K chars — a 14.5K arc prompt
wrapped in 3.5K of evaluator instructions. The arc prompt is delivered
twice: once to arc, once to evaluator. For aks-explorer (10.3K avg),
the echo adds 50% overhead per session.

### Driver 2: The Template Tax (8 templates × 80 sessions each)

Dev has 8 distinct task templates and runs 80 sessions per template on
average. Its heartbeat template is 11.8K chars. It's delivered 636 times
in 3 days — identical text, repeated verbatim.

```
Agent     Avg Task Chars  Templates  Sessions/Template  
dev       11,740          8          80.4
arc       14,548          8          79.8
scout      4,587         17          64.1
aks-exp    7,496         93          50.4
may        6,390         47          31.0
evaluator 10,484       6,989          1.1
```

Dev and arc each have approximately 8 templates. Those 8 templates are
delivered 640 times each. The text is identical every time. The model
reads 11-14K chars of instructions it has seen hundreds of times before.

### Driver 3: The Quick-Exit Paradox

Dev's abstention efficiency (Abstention Advantage, prior synthesis) is the
system's crown jewel: 93% quick-exit rate, lowest error rate, lowest ops.
But viewed from the input side, it creates a paradox:

```
Dev quick-exit pattern (3 days):
  593 sessions × 11,835 avg chars = 7.0 MB of task text
  93% of dev's total task-text bytes
  Average outcome: read 11.8K chars, do ~8 ops, exit
  
  Dev is the system's MOST efficient agent AND its
  most wasteful per-useful-session on input cost.
```

The 593 sessions that immediately exit still receive the full 11.8K-char
heartbeat prompt. The model processes ~3,000 tokens of input to produce
a 3-op decision: "nothing to do." The instruction text is 400× the
useful output.

## The Structural Analysis

### Why Prior Syntheses Miss This

| Synthesis | What It Measures | What It Misses |
|-----------|-----------------|----------------|
| Impedance Principle | Output loop growth | Input delivered before loops start |
| Observability Trap | Evaluator session count & ops | Text mass echoed into evaluator |
| Abstention Advantage | Quick-exit op count | Prompt cost of sessions that exit |
| Compilation Gradient | Governance maturation | Prompt text as governance cost |

All four focus on *what happens after the session starts*. None accounts
for the cost of *starting the session* — the prompt mass that must be
ingested before the first tool call.

### The Cost Structure Inversion

In a young agent system, output dominates input:
- Few instructions → small prompts
- Complex tasks → many tool calls
- Ratio: 1 unit input → 10 units output

In a mature agent system, input dominates output:
- Accumulated instructions → large prompts (KE-1956 Instruction Ratchet)
- Compiled abstention → many quick exits (Abstention Advantage)  
- Echo evaluation → every prompt delivered twice (Observability Trap)
- Ratio: 10 units input → 1 unit output (dev's 1,499 chars/op)

**The system has matured into an input-heavy cost structure.** Dev's
chars-per-op ratio (1,499) means it reads ~375 tokens of instruction
for every tool call it makes. Arc's ratio (309 chars/op) is lower only
because arc *doesn't* abstain — it reads the same large prompt and then
churns through 47 ops. Scout's ratio (132 chars/op) is lowest because
its prompts are smallest (4.6K) and it does more work per session.

### Connection to InquiTree (arXiv 2606.09550)

InquiTree's core finding is that **critical judgment degrades with context
length** — "cognitive tunneling." This connects directly:

- Dev's 11.8K prompt is processed 636 times. If the model's discrimination
  capacity degrades with repeated identical context, the instruction ratchet
  (KE-1956) isn't just a *governance* failure — it's a *cognitive* failure.
  More instructions → longer prompts → worse judgment per instruction.

- Arc's 14.5K prompt is the system's longest. Arc's quick-exit rate (27.2%)
  is the system's lowest among core agents. Correlation ≠ causation, but
  the InquiTree mechanism predicts exactly this: longer context → worse
  ability to identify "nothing to do" → more unnecessary work.

### Connection to PerspectiveGap (arXiv 2606.08878)

PerspectiveGap found that **orchestration prompt quality ≠ coding ability**
— models can be good at tasks but bad at following complex orchestration
instructions. This is the flip side:

- The system's prompts are *orchestration* prompts (heartbeat guidance,
  finish hygiene, context rules, lane restrictions). They're not task
  descriptions — they're meta-instructions about how to work.
  
- PerspectiveGap measured 246.5% information leakage from orchestration
  prompts. If our system's prompts leak at similar rates, the 14.5K-char
  arc prompt isn't just expensive — it's actively leaking context into
  tool calls and file writes where it doesn't belong.

## The Quantitative Picture

### 3-Day Token Budget (task text only)

```
Total system task text:           141 MB ≈ 37.2M tokens

Evaluator echo:                    73 MB ≈ 19.2M tokens (51.5%)
Quick-exit sessions (all agents):  20 MB ≈  5.1M tokens (14.2%)
Productive work:                   48 MB ≈ 12.9M tokens (34.3%)

Of the "productive" 48 MB, much is template repetition —
the same 8-17 templates repeated 30-80× each.
Truly unique task content: ~15 MB ≈ 3.9M tokens (10.6%)
```

**89% of task-text tokens are structural overhead: echoes, template
repetition, or prompts delivered to sessions that immediately exit.**

### The Maturation Trap

This cost structure is *caused by* the system's maturity:

1. **Instructions grew** (Instruction Ratchet) → larger templates
2. **Abstention compiled** (Abstention Advantage) → more quick exits
3. **Evaluation scaled** (Observability Trap) → more echo sessions
4. **Templates stabilized** → same text repeated more often

Each of these is individually good. Instructions prevent errors.
Abstention saves compute. Evaluation catches problems. Template
stability enables consistency. But their combined input-side cost
was never measured — and it's now the dominant expense.

## Implications for Our System

### 1. Prompt Caching Is the Obvious Fix — But Not Sufficient

Modern LLM APIs cache repeated prompt prefixes. If the system uses
prefix caching, the 636 identical dev heartbeat prompts don't each
cost 3K tokens — only the first does. But:

- Evaluator aftermath prompts are NOT identical — each embeds a different
  reviewed session. The echo pattern defeats prefix caching because the
  embedded content varies.
  
- Quick-exit sessions still pay the *latency* cost even with cached
  tokens. A session that takes 10 seconds to read a cached prompt and
  decide "nothing to do" still occupies a session slot for 10 seconds.

### 2. The Evaluator Could Use Summaries Instead of Echoes

The evaluator currently receives the full original task text of the session
it reviews. An impedance fix: replace the embedded task with a bounded
summary (goal, key constraints, outcome — max 500 chars). This would reduce
evaluator task text from ~10.6K to ~4K per session, saving ~47 MB / 3 days.

### 3. Quick-Exit Sessions Need a Lightweight Path

Dev's pattern is: receive 11.8K prompt → check inbox → check alerts → exit.
A structural fix: heartbeat sessions that have no alerts and no inbox items
could receive a *minimal* prompt (1K chars: "check inbox, check alerts,
exit if clear") and only escalate to the full prompt when something needs
attention. This would reduce dev's task text from 7.0 MB to ~0.6 MB / 3 days.

### 4. This Is a New Type of Impedance Failure

The Impedance Principle identifies seven feedback loops where output
circulates as input without compression. The Prompt Mass Problem identifies
an eighth: **the system's own instructions circulate through sessions
without compression.** Every heartbeat delivers the full instruction set.
Every evaluation echoes the full original prompt. The instructions
themselves are an undamped feedback loop — compiled once, delivered
endlessly, never summarized.

## Prediction

As agent systems mature, the input/output cost ratio will invert for
every system that survives long enough. Young systems are output-bound
(compute and tool calls dominate). Mature systems are input-bound
(prompt delivery and context management dominate). This inversion is
invisible to standard metrics (which measure sessions, ops, errors)
and to standard cost tracking (which measures API calls, not
per-call token composition).

The first agent framework to build "prompt compilation" — converting
verbose, repeated instruction templates into compact, cached,
situation-adaptive prompts — will see 5-10× cost reduction on mature
systems. This is the input-side equivalent of the Compilation Gradient:
just as governance matures from soft to compiled, prompts must mature
from verbose-and-repeated to compact-and-adaptive.

---

## Cross-References

- [the-impedance-principle.md](./the-impedance-principle.md) — output-side feedback loop analysis
- [the-observability-trap.md](./the-observability-trap.md) — evaluator compute cost (this note adds input cost)
- [the-abstention-advantage.md](./the-abstention-advantage.md) — quick-exit efficiency (this note reveals its input cost)
- [governance-compilation-gradient.md](./governance-compilation-gradient.md) — governance maturation (this note proposes prompt maturation)
- KE-1956 — Instruction Ratchet (instructions only grow → prompts only grow)
- KE-1944 — Context Accumulation Trap (rework context grows → prompts grow)
- arXiv 2606.09550 — InquiTree (context length degrades judgment)
- arXiv 2606.08878 — PerspectiveGap (orchestration prompt quality ≠ task quality)
