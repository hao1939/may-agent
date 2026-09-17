<ai_context>
summary: "A publisher-run cold-agent audit shows why green route, browser, and protocol-parity tests do not establish that an unprimed agent can enter and complete a product workflow. Database-grounded outcomes exposed failures in byte-window discoverability, identity requirements, polling guidance, and documentation; targeted fixes did not improve strict automated completion in the first re-run, while a final update says all seven later runs correctly reached the product's deliberate human-owner boundary."
triggers: ["cold agent", "agent interface evaluation", "agent discoverability", "blank-agent harness", "database-grounded evaluation", "workflow completion", "documentation drift", "next_call", "service-desc"]
last_updated: "2026-09-11"
source_basis: "HN item 49654075 and the linked pact0 publisher report, checked 2026-09-11."
</ai_context>

# Cold-Agent Tests Cover the Boundary That Green Internals Miss

**Date:** 2026-09-11  
**Source:** https://pact0.com/notes/agents-vs-our-own-product  
**HN:** https://news.ycombinator.com/item?id=49654075

## Signal

Pact0 reports a useful interface-level evaluation pattern: point an unprimed agent
at the same public entrance a real user would see, give it only a generic HTTP
tool and a goal, and grade completion from authoritative application state rather
than from the transcript.

The publisher says its conventional suite was already green—roughly 2,700 fast
tests, more than 1,000 slow tests, and hundreds of Playwright runs across 35
suites. Yet only **3 of 11 non-billing-truncated runs** completed the full
register → verify → claim → submit evidence → paid loop. The harness allowed 30
turns and exposed at most 4,000 characters of each HTTP response. Six model
families were attempted; two additional families did not run because the
publisher's credits expired and were correctly counted as untested, not passes.

The failures were not mainly business-logic failures:

- Three agents never found `/skill.md`; the only direct pointer was initially
  about 4,027 bytes into the home page, outside the harness's response window.
- Two stopped rather than inventing a required social identity.
- Two registered but did not poll again after seeing a pending state.
- One well-formed retry encountered a rate limit.
- Documentation used fields or response shapes that did not match the live API.
- Two agents' self-reports disagreed with actual state: one completed while
  claiming it was blocked, and another claimed an OAuth action that the harness
  had actually performed.

The evaluator therefore read the database for state transitions and wallet
changes. This is stronger evidence than a model's completion claim and makes
"conversation finished," "agent says done," and "workflow state reached" three
different outcomes.

## The Strongest Result Is the Failed Improvement

Pact0 moved the discovery pointer near byte 55, added a `Link:
rel="service-desc"` header, removed the social handle from agent registration,
made polling guidance bounded, fixed documentation drift and rate-limit
behavior, and later added a literal structured `next_call` to responses.

Those changes repaired intermediate metrics: in the first mirrored re-run, 5/5
agents starting at `/` found `/skill.md` versus 2/5 before, and 8/8 registered
without a social handle. But full completion on the strict canonical condition
remained **1/5 before and after**. Across eight mirrored cells, completion moved
only from 2/8 to 3/8. Guidance to try a side activity became a new exit ramp, and
four of eight still did not resume polling. A second seven-cell re-run after
`next_call` also recorded only 3/7 automated earn-loop completions, despite a
different model-level mix.

The publisher's final update adds a decisive qualification to that 3/7 result.
On the live site, an agent that finishes the trials cannot proceed until its
human owner claims it; the simulation stubs that deliberate human step and thus
counted sensible waiting as failure. The publisher reports that **all 7/7 runs
reached this human boundary after doing everything then available**, even though
only 3/7 crossed the simulated full-loop condition. These are different metrics:
correctly reaching an intentional human prerequisite does not prove unaided
completion, while failure to cross that prerequisite does not prove agent
failure.

That is the non-obvious lesson: **boundary fixes can move the wall without
lowering it**. Discovery rate, registration rate, polling rate, human-boundary
arrival, and terminal state must be measured separately; otherwise a large gain
in an upstream metric—or sensible waiting at a designed handoff—can be mistaken
for an end-to-end reliability result.

## Design Implication

Agent-facing products need a cold-entry conformance test in addition to unit,
route, browser, and protocol-parity tests:

1. Start from the public root with no private product hints.
2. Apply realistic tool response and turn budgets.
3. Require the agent to discover the machine contract rather than injecting it.
4. Include refusal-sensitive fields so honesty is not accidentally penalized.
5. Grade every milestone from authoritative external state.
6. Record both milestone conversion and strict terminal completion.
7. Re-run the same cells after fixes; do not infer end-to-end improvement from
   discoverability or registration alone.

This also suggests that agent-readable metadata has a **placement contract**,
not merely a presence contract. A valid pointer outside a client's read window
is operationally absent. Headers such as `service-desc` reduce dependence on
HTML parsing, but clients still need explicit discovery behavior and origins
still need end-to-end cold-entry tests.

## Evidence Boundary

This is a publisher-run audit of the publisher's own product, with small,
uneven per-model samples and a deliberately constrained harness. The report
exposes its billing truncations, model counts, database-grounded grading, and
failed re-runs unusually clearly, but it is not an independent benchmark and
does not establish population-level model rankings. The reusable contribution
is the evaluation design and the distinction between repaired milestones and
unchanged terminal completion—not the claim that a particular model is better
or worse.
