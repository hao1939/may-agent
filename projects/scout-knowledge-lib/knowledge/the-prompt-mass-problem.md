<ai_context>
summary: "Cross-source synthesis: The system's largest cost isn't output or compute — it's the mass of repeated, identical prompt text delivered to sessions that immediately exit. 141MB of task text was delivered across 16K sessions in 3 days. 51.5% of all task-text bytes are evaluator aftermath sessions echoing the original session's full task. Dev burns 93% of its task-text on sessions that exit within 10 ops. The system has invented a novel inefficiency: it pays the full input cost of context-rich prompts even when the session's first act is to determine nothing needs doing. Prior syntheses (Impedance, Observability, Abstention) analyzed the output side and compute side of feedback loops. This note identifies the INPUT side — the prompt mass delivered per session — as a distinct cost center that grows with system maturity and is invisible to all existing metrics."
triggers: ["prompt mass", "input cost", "task text", "context nesting", "evaluator echo", "template repetition", "cold start cost", "quick exit cost", "token budget", "prompt efficiency"]
last_updated: "2026-09-14"
source_basis: "Production data analysis: 3-day window, 16K sessions, 141MB task text. Evaluator aftermath: 7,208 sessions averaging 10,631 chars each = 73MB echoed task text. Dev quick-exit: 593 sessions × 11,835 chars = 6.7MB of 11K-char prompts read and immediately exited. Arc: 14,548 avg task chars, 8 distinct templates, 79.8 sessions per template. Cross-referenced with Impedance Principle (feedback loop amplification), Observability Trap (meta-observation cost), Abstention Advantage (quick-exit efficiency), PerspectiveGap arXiv 2606.08878 (orchestration prompt quality ≠ task quality), InquiTree arXiv 2606.09550 (context length degrades judgment), app.nz's deterministic 37-turn wire-cost harness (HN 49210901), Shopify's production report on learned gist-token prompt compression (HN 49382646), Mohammed Reschreiter's dynamic-tool implementation and 417-turn self-audit (HN 49476278), and Replay Doctor's local transcript-level prompt-cache diagnosis with explicitly single-machine calibration (HN 49691257)."
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

## HN Update — Measure Transcript Residue on the Wire (2026-08-07)

A newly submitted engineering write-up makes this note's multiplication effect
concrete at the agent-loop level. app.nz built a model-free harness that scripts
the same 36 tool calls over 37 turns and weighs every request body sent to a
fake gateway. Its baseline moved **4,157,949 bytes**—estimated by the authors as
about **1,039,487 tokens**—even though the script touched only four small files.
The mechanism is the same prompt-mass problem at a finer scale: a file read or
command output introduced early is resent on every later stateless completion.

The useful contribution is not the headline reduction alone, but the paired
measurement design:

- keep the tool-call sequence deterministic so byte-level regressions are
  attributable without paying for model runs
- budget fixed per-turn material such as system prompts and tool schemas, not
  only conversation history
- shorten schemas, use workspace-relative paths, clip pathological lines, and
  replace byte-identical repeated results with references while the original
  result remains present
- trim stale tool output continuously to a working window and reduce to a
  low-water mark; merely dropping just below a ceiling leaves every subsequent
  turn paying near-ceiling cost

Those changes reduced the fixed script to **2,067,926 bytes** (the authors'
**516,981-token approximation**) and removed the baseline's summarization call.
The harness also rejected an apparently sensible trim-at-the-ceiling change
that instead increased wire bytes from 4,293,186 to 4,751,562 because it hovered
near the limit and invalidated a deduplication cache.

This is **cost evidence, not quality evidence**. The harness cannot observe
whether pruning causes a real model to reread files or take more turns, and its
token figures use bytes divided by four rather than provider billing counts.
The accompanying short-task outcome check was 9/10 before and after, but those
three-to-four-turn fixtures did not exercise the working window. The practical
pattern is therefore a two-harness contract: deterministic, model-free wire
accounting for fast cost iteration plus model-backed tasks for outcome and
long-horizon regression checks.

- Source: https://app.nz/blog/app-agent-token-efficiency-optimizations
- HN: https://news.ycombinator.com/item?id=49210901

## HN Update — Compile Stable Instructions into Model-Specific Gist Tokens (2026-08-21)

A Shopify engineering report newly submitted to HN provides production evidence
for the “prompt compilation” predicted in this note, but implements it below the
text layer. Shopify compressed the Sidekick GraphQL agent's roughly **6,000-token
system prompt into 1,500 learned gist tokens**. The base model is frozen while
special-token embeddings are trained by knowledge distillation: a teacher pass
sees the full prompt, a student pass sees only the gist tokens, and KL divergence
pulls the student's response-position logits toward the teacher's.

Shopify reports that at 350 requests per minute the 4:1 representation reduced
median time to first token from 438 ms to 354 ms, median end-to-end latency from
6.8 s to 4.2 s, increased throughput from 20.2 to 23.4 queries per second, and
allowed the production workload to use 14% fewer GPUs. The deployment does not
need a custom attention mask or separate encoder: the learned vectors are written
into the embedding matrix and registered as special tokens, so the request path
only substitutes the long prompt with the gist-token string.

This complements rather than replaces prefix caching. A cache avoids recomputing
the stable prefix, but every generated token still attends over that prefix and
streams its key-value state. Shortening the sequence therefore reduces decode
work and KV-cache reads even when the full text would have been a cache hit. The
reported throughput gap widened with concurrency, where those repeated reads
matter most.

The architectural implication is that stable agent policy can become a
**compiled model artifact**, not just shorter prose. That creates a new tradeoff:

- learned tokens provide a fast fixed path for high-volume, stable instructions;
- natural-language policy remains portable, reviewable, and easy to revise;
- the compiled representation is model-specific and opaque to human inspection;
- instruction changes need redistillation or a validated continual-learning path;
- behavioral equivalence must be tested across the action distribution, not
  inferred from low distillation loss alone.

Shopify says prediction quality was preserved and identifies 4:1 as the point
before quality degraded for this domain, but the post does not publish the
evaluation set, sample size, variance, or task-level failure analysis. Its
latency and capacity numbers are therefore useful production measurements, while
the quality claim remains an internal result rather than a reproducible external
benchmark. A safe prompt compiler should retain the source prompt, compiled
artifact identity, model version, evaluation suite, and rollback threshold as
one release unit—especially when the compressed text contains governance rules
rather than only task guidance.

- Source: https://shopify.engineering/gisting
- HN: https://news.ycombinator.com/item?id=49382646

## HN Update — Redundancy Can Buy Local Adherence, but Only to a Plateau (2026-08-23)

A new HN submission adds an important boundary to prompt minimization: some
apparently redundant text is behaviorally active. In a public field test, Nitin
Khola repeated the same syntax rule zero, one, two, four, eight, or sixteen times
in a system prompt and generated six small Python functions 30 times per
condition. Across 1,080 Gemini 2.5 Flash runs with thinking disabled, a tokenizer-
based checker found aggregate adherence rose from 74% with one mention to 97%
with four; eight and sixteen repetitions remained within the same range as four.

The task-level distribution matters more than the aggregate. Two functions
already reached 100% adherence after one mention, while merge-interval code rose
from 20% after one mention to 97% after four. Repetition therefore did not make
the model uniformly “more obedient”; it rescued contexts where a strong learned
coding habit overrode the instruction. Three easier candidate rules had first-
mention adherence near 99%, so repetition would have had no useful headroom.

This qualifies the Prompt Mass Problem rather than refuting it. Blind textual
deduplication can delete emphasis that changes behavior, but repetitions five
through sixteen added cost without measurable benefit in this setup. A prompt
compiler should consequently treat repeated rules as candidates for ablation,
not automatic deletion: measure each rule on the tasks where it currently fails,
retain the smallest repetition count that clears an adherence threshold, and
prefer structural enforcement once repetition plateaus.

The evidence is deliberately narrow. It covers one adjacent block of a literal
syntax rule, one model configuration, six standalone functions, and no repository-
scale agent loop. HN commenters also challenged the generalization from six task
types. The experiment nevertheless exposes a second evaluation lesson with wider
value: output truncation initially changed the author's headline result from 39%
to 88% because thinking tokens consumed the generation budget unevenly across
conditions. Prompt ablations must record termination reasons and include failed
or truncated generations rather than comparing only surviving outputs.

- Source: https://www.khola.blog/p/say-it-four-times
- Repo: https://github.com/nkhola/field-tests
- HN: https://news.ycombinator.com/item?id=49411268

## HN Update — Treat Tools as a Capability Working Set (2026-08-28)

A newly submitted implementation report adds a second input surface to this
note: **tool schemas are prompt mass too, and the required set changes by
turn**. Mohammed Reschreiter's Pi extension keeps four core tools (`read`,
`bash`, `edit`, `write`) active, represents occasional tools as short standby
hints, activates them through an intercepted shell command, and evicts idle
schemas after a two-run TTL. Co-activation groups let one request load a bundle
whose tools are normally used together.

The most useful design idea is not the headline “80%” saving; it is to manage
capabilities like a working set rather than a permanent registry. Stable policy
text and callable capability topology need different compression strategies:
compile or cache policy that is broadly invariant, but load full schemas only
while their capabilities are locally relevant. This avoids paying the detailed
JSON-schema cost for every possible action on every turn.

The report's 417-turn self-audit provides a concrete, if non-independent,
operating trace. Four default tools handled 98.1% of reported coding operations;
standby tools were called 13 times. Of 30 cache miss or rewrite events, five
were attributed to tool activation, or 1.2% of turns. The author estimates that
dynamic activation avoided sending 5.4 million unused schema tokens in that
session. A separate fresh-session observation reported 3.6K total tokens for
Pi's four-tool baseline, while screenshots and author-reported tests put Codex
at 14,534 tokens with 79 callable tools and Antigravity at 19.9K total tokens,
13.8K of them tool schemas.

Those comparisons should not be read as a controlled cross-harness benchmark:
models, system prompts, telemetry, and tool descriptions differ, and some
Claude Code figures in the article explicitly come from community reports. The
417-turn trace is also a single author's workload. The reusable evaluation
contract is stronger than any one number:

1. record schema tokens by turn, not only total context;
2. record activation, eviction, cache-transition, and tool-use events;
3. measure miss cost and erroneous activation alongside token savings;
4. retain a tiny always-on recovery path so deferred capability discovery
   cannot strand the agent;
5. replay representative long tasks, because a fresh “hi” measures startup
   mass but not completion quality.

This extends prompt compilation into **capability working-set management**.
Compression is no longer only “make the same prefix shorter”; it is also “stop
presenting irrelevant actions as currently callable,” with telemetry proving
that deferral does not increase turns or failures.

- Source: https://m-reschreiter.at/en/blog/how-i-cut-80-percent-context-overhead-dynamic-tools
- HN: https://news.ycombinator.com/item?id=49476278

## HN Update — Make Cache Continuity an Observable Contract (2026-09-14)

Replay Doctor adds a missing operational layer to this note: prefix caching is
not merely a provider feature to enable, but a state transition to verify on
every turn. Its local Go CLI reads existing Claude Code, Codex, and Cursor
transcripts, reconstructs provider caching rules, and attributes a cache break
to the turn and structural cause. The practical distinction is between a spend
total and a diagnosis: aggregate token accounting can show cost growth, while a
turn-level replay can identify that a tool-set change, client re-render, or TTL
expiry caused an old prefix to be billed again.

That makes cache continuity part of the agent harness's observability contract.
A useful trace should retain, per turn, the effective prefix identity, tool-set
delta, provider cache-read/write counters, gap since the preceding request, and
pricing-rule version. This also qualifies capability working-set management:
dynamic tool activation can save schema mass while simultaneously changing the
prefix, so activation telemetry must measure both removed schema tokens and the
resulting cache transition. Optimization is net-positive only when those two
sides are evaluated together.

The project's public evidence models appropriate uncertainty rather than
establishing a general benchmark. Its README reports 97.79% reproduction of
provider cache reads across 1,751 transcript lanes, but explicitly reduces the
independent sample to 116 sessions from one machine, account, and operator. The
site also keeps visible corrections—including a session-count overstatement—and
refuses some model-routing estimates when the model pair was not measured on the
wire. The reusable signal is therefore the instrumentation shape and disclosure
practice, not the project's single-machine dollar totals or break-cause shares.

- Source: https://replay.doctor/
- Repo: https://github.com/RedRobotKK/Replay
- HN: https://news.ycombinator.com/item?id=49691257

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
