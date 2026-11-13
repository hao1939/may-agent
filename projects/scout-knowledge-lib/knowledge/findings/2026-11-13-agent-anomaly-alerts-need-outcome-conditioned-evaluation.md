<ai_context>
summary: "Google's producer-authored evaluation separates whether an agent encountered an attack, resisted it, carried it out, and was then flagged by an asynchronous anomaly detector. The reported 87% detection rate is conditioned on carried-out harms; poisoned memory, new-agent calibration, ordinary high-impact tool use, and no-result sessions expose important gaps. Scout read the complete first-party article but did not inspect raw traces, run the benchmarks, or test the private-preview detector."
triggers: ["agent anomaly detection", "outcome-conditioned security evaluation", "post-execution agent monitoring", "agent goal hijack", "poisoned memory detection", "AgentDojo", "AgentDyn"]
last_updated: "2026-11-13"
source_basis: "Complete first-party Google Developers Blog article retrieved from https://developers.googleblog.com/how-agent-anomaly-detection-scores-on-benchmarks-we-didnt-write/ (retrieved HTML SHA-256 5647993eb0acbd58a089a94c926cca8ac0c87e816af78ecc9c0df00717116564), surfaced by HN item 50485936."
</ai_context>

# Agent anomaly alerts need outcome-conditioned evaluation

**Date:** 2026-11-13  
**Disposition:** New source-grounded evaluation signal  
**Source:** https://developers.googleblog.com/how-agent-anomaly-detection-scores-on-benchmarks-we-didnt-write/  
**HN item:** https://news.ycombinator.com/item?id=50485936

## Question

How should a runtime evaluate an agent anomaly detector when harmful instructions
may never reach the model, may be resisted, may cause an external effect, or may
be detected only after that effect?

## What the source reports

Google describes a private-preview Agent Anomaly Detection service that reads
agent traces and logs asynchronously and flags sessions for post-execution
review. The producer ran 1,774 sessions from five non-Google public benchmarks
through an ADK agent using `gemini-2.5-flash` and simulated applications. Each
benchmark's deterministic Python check—not the anomaly detector—read final
application state and labeled whether the harmful instruction was carried out.

The evaluation records three distinct outcomes for indirect attacks:

1. **Never read:** no tool returned the harmful instruction to the agent.
2. **Resisted:** the agent received the instruction but did not complete it,
   including attempted actions that failed.
3. **Carried out:** the benchmark's state check found that the instruction took
   effect.

Against the third group, Google reports that the detector flagged 87% of
carried-out harmful instructions overall: 85% on AgentDojo, 87% on InjecAgent,
99% on AgentDyn, and 81% on AgentHarm. The denominator matters. Across all
harmful sessions—including attacks never read or resisted—the reported flagged
share was 45% to 62%. Of 141 sessions in which the agent never read the harmful
instruction, the detector flagged one.

The article also reports materially different operating conditions:

- benign office-task false alarms were 2% to 4% on three injection benchmarks,
  but 16% on AgentHarm, whose benign twins also use terminal commands, downloads,
  and social-media actions;
- in AgentDyn, carried-out-harm detection rose from 33% with about 220 benign
  history sessions per agent to 99% with 360;
- poisoned long-term memory was the clearest gap: the detector caught 4 of 18
  sessions in which planted memory caused the agent to act; and
- the service returned no result for about 6% of submitted sessions. Google says
  counting those as misses lowers overall rates by one to two percentage points.

## Reusable design signal

**Evaluate each security layer against the transition it can actually observe or
control.** A useful agent-security receipt should retain at least:

- whether untrusted content entered a tool result or persistent memory;
- whether the agent actually read it;
- whether the agent resisted, attempted, failed, or completed the requested
  action;
- the independently observed external state change;
- whether a preventive control blocked the action before execution;
- whether an asynchronous detector produced a finding after execution; and
- detector age, baseline-history volume, tool mix, severity, and no-result state.

This prevents an attractive conditional rate from being mistaken for end-to-end
protection. “Flagged 87% of carried-out harms” is a useful detector-sensitivity
claim under the tested setup; it is not the same as blocking 87% of attacks,
flagging 87% of all attempted attacks, or preventing 87% of harmful effects.
Likewise, a model refusal and a post-execution alert are separate defenses and
should not be combined into one success number.

Two deployment consequences follow. First, anomaly findings should route review
and incident response rather than authorize a claim that the action was safely
prevented; high-impact effects still need pre-execution policy, least privilege,
and approval. Second, calibration evidence must be scoped to the agent's normal
tool distribution and history volume. A detector that improves after hundreds
of benign sessions needs an explicit cold-start state, and high-impact tools used
routinely need a different false-alarm expectation from ordinary office tools.
Persistent memory also needs its own evaluation lane rather than inheriting
confidence from tool-result injection tests.

## Limits

- This is a producer-authored report about a private-preview Google product.
  Scout did not inspect raw traces, per-session labels, detector internals,
  benchmark adapters, configuration, or an independently archived result bundle.
- Scout did not run Agent Anomaly Detection, ADK, the agent model, the five
  benchmarks, or the simulated applications, and did not reproduce any reported
  detection or false-alarm rate.
- The study used one model and simulated applications. The article says benign
  benchmark tasks are likely simpler than production traffic, so production
  false-alarm rates may differ.
- Several benchmark cells are small, and public benchmarks concentrate on goal
  hijack and tool misuse. The article reports no suitable labeled-trace benchmark
  for cascading failures or identity and privilege abuse.
- The detector is asynchronous and does not block actions. A correct alert can
  therefore coexist with an already completed harmful effect.
- The HTML fingerprint identifies the bytes Scout retrieved, not an immutable
  publisher revision. The publisher may change the live article later.

## Primary inspected sources

- [Google Developers Blog: How Agent Anomaly Detection scores on benchmarks we didn't write](https://developers.googleblog.com/how-agent-anomaly-detection-scores-on-benchmarks-we-didnt-write/)
- [Hacker News item 50485936](https://news.ycombinator.com/item?id=50485936)

## Discovery record

Current HN Algolia `search_by_date` results were checked for `AI agent`,
`agents`, `MCP`, and `coding agent`, with story filtering and 40 results per
query. HN item 50485936 surfaced the first-party article. Scout read the complete
article body extracted from the retrieved HTML; retrieved HTML SHA-256:
`5647993eb0acbd58a089a94c926cca8ac0c87e816af78ecc9c0df00717116564`.
