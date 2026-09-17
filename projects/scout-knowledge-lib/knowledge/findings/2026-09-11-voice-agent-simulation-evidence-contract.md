<ai_context>
summary: "HN/GitHub finding: Egma turns voice-agent regression tests into versioned scenario × persona simulations, separating execution, evidence completeness, and grader outcomes. The reusable pattern is to freeze the full evaluation policy per run and preserve partial-evidence states rather than treating a completed conversation or grader as a pass."
triggers: ["voice agent evaluation", "simulation testing", "persona matrix", "grader versioning", "evaluation provenance", "partial evidence", "mock tool responses", "Egma"]
last_updated: "2026-09-11"
source_basis: "Hacker News item 49646928 and egma-ai/egma repository/docs at commit a03e40ce5f46a868226de051344498072b40b257."
</ai_context>

# Voice-Agent Simulation Needs an Evidence Contract, Not Just a Conversation

**Date:** 2026-09-11  
**Source:** Hacker News / GitHub

A [Show HN submission](https://news.ycombinator.com/item?id=49646928) for
[Egma](https://github.com/egma-ai/egma) presents open-source simulation testing
for LiveKit and Retell voice agents. The reusable design signal is not merely
that an LLM can impersonate a caller. Egma models a run as a frozen evaluation
contract and keeps several commonly conflated outcomes separate.

## The simulation unit is a scenario-persona pair

A test defines a situation, observable expected behaviors, optional startup
context, and fixed responses or errors for named tools. A persona separately
defines caller behavior such as language, urgency, or interruptions. A run
executes one conversation for each selected **test × persona** pair, so adding a
persona expands behavioral coverage without duplicating the business scenario.
Tests live as Markdown beside the agent code, making the scenario and expected
behavior reviewable with the implementation.

This decomposition is more useful than a generic “have an LLM test the agent”
prompt:

- the **scenario** controls what the caller needs;
- the **persona** controls how the need is expressed;
- **mocked tools** control selected backend conditions;
- the **connection** determines which evidence and controls are available;
- **graders** judge explicit claims against the resulting transcript and tool
  evidence.

Egma warns that tools not explicitly named in a mock section still execute their
normal implementations. That is a meaningful safety boundary: simulation is not
the same as total isolation, and a test harness should disclose which external
effects remain live.

## Replayability requires freezing the judge as well as the test

At run creation, Egma saves test and persona behavior versions, persona
settings, and the selected graders' versions, settings, and pass thresholds.
Queued simulations and retries use that frozen selection; later policy changes
apply only to future runs. This closes an easy-to-miss provenance gap. A stored
conversation is not a reproducible regression result if the persona, grading
model, rubric, or threshold can drift underneath it.

A portable run manifest for non-deterministic agent tests should therefore bind:

1. system-under-test revision and connection;
2. scenario and persona versions;
3. controlled tool/environment fixtures;
4. evidence channels expected from the integration; and
5. grader version, settings, threshold, and per-criterion results.

## “Finished” is three different states

Egma's docs explicitly distinguish conversation completion, evidence arrival,
and grading outcome:

- a completed conversation does not mean expected behavior passed;
- a completed grader can return a score below its frozen threshold;
- grading can complete after the evidence wait ends even when the agent-side
  trace is incomplete, exposed as `agentPovIncomplete`;
- a combined score is descriptive and has no overall pass threshold.

This is the strongest transferable pattern. Agent-evaluation pipelines should
not collapse transport/execution status, evidence completeness, and semantic
quality into one green check. A credible result record needs all three. In
particular, missing evidence should remain a first-class state rather than being
silently interpreted as either success or behavioral failure.

## Production failures should become durable matrix cells

The repository recommends separate regression suites for behavior that already
works and “hill-climbing” suites for behavior still being improved, then turning
production failures into regression tests. The HN discussion independently
surfaced the practical next question: which production signals—transcription
errors, tool failures, or business-outcome deviations—should trigger replay or a
new scenario? The useful operating loop is:

`production anomaly → minimized scenario + relevant persona → frozen run → evidence review → regression promotion`

Promotion should be deliberate. A single bad call may justify investigation,
but not necessarily a permanent matrix cell; recurring or high-severity failures
are stronger candidates. Conversely, one passing simulated conversation should
not establish robustness because caller generation and grading remain
stochastic.

## Boundaries

- The repository documents support for LiveKit and Retell, not broad
  interoperability across voice stacks.
- The HN item had 14 points and four comments when checked; its discussion is
  an adoption signal and design prompt, not independent validation.
- Egma provides infrastructure and explicit state semantics, but the checked
  sources do not report benchmarked defect-detection rates, grader reliability,
  or coverage guarantees.
- Its README describes automatic fixes from production failures as future work,
  not a current capability.
- Fixed tool mocks improve repeatability but can hide contract drift; their names
  and response shapes still need validation against production tools.

## Sources

- HN: https://news.ycombinator.com/item?id=49646928
- Repo: https://github.com/egma-ai/egma
- Inspected revision: https://github.com/egma-ai/egma/commit/a03e40ce5f46a868226de051344498072b40b257
- Run snapshot semantics: https://github.com/egma-ai/egma/blob/a03e40ce5f46a868226de051344498072b40b257/docs/docs/platform/runs/start-and-follow-a-run.mdx
- Simulation evidence: https://github.com/egma-ai/egma/blob/a03e40ce5f46a868226de051344498072b40b257/docs/docs/platform/runs/simulation.mdx
- Tests in code: https://github.com/egma-ai/egma/blob/a03e40ce5f46a868226de051344498072b40b257/docs/docs/platform/tests/write-a-test.mdx
- Grade and evidence states: https://github.com/egma-ai/egma/blob/a03e40ce5f46a868226de051344498072b40b257/docs/docs/platform/graders/scores-and-thresholds.mdx
