<ai_context>
summary: "A controlled GitHub experiment suggests that recording a rejected coding change can narrow a fresh agent's future option set and reduce re-derivation time even when readable code is already sufficient to prevent the worst edit."
triggers: ["rejected alternative", "decision rationale", "project memory", "coding-agent memory", "negative decision", "Keep the Why", "re-derivation cost"]
last_updated: "2026-09-11"
source_basis: "oliver-zehentleitner/keep-the-why repository at commit ed65449c4c8c1311f4f019ee7969d1c56ac27e19, including its predeclared rejected-change experiment, runner, raw per-run artifacts, result summary, and skill contract."
</ai_context>

# Rejected Alternatives Are Option-Set Memory, Not Just Documentation

**Date:** 2026-09-11  
**Repo:** https://github.com/oliver-zehentleitner/keep-the-why  
**Inspected revision:** https://github.com/oliver-zehentleitner/keep-the-why/commit/ed65449c4c8c1311f4f019ee7969d1c56ac27e19  
**Experiment design:** https://github.com/oliver-zehentleitner/keep-the-why/blob/ed65449c4c8c1311f4f019ee7969d1c56ac27e19/experiments/rejected-change/README.md  
**Results and limitations:** https://github.com/oliver-zehentleitner/keep-the-why/blob/ed65449c4c8c1311f4f019ee7969d1c56ac27e19/experiments/rejected-change/results/SUMMARY.md  
**Runner:** https://github.com/oliver-zehentleitner/keep-the-why/blob/ed65449c4c8c1311f4f019ee7969d1c56ac27e19/experiments/rejected-change/run.py  
**Skill contract:** https://github.com/oliver-zehentleitner/keep-the-why/blob/ed65449c4c8c1311f4f019ee7969d1c56ac27e19/skills/keep-the-why/SKILL.md

## Core signal

`keep-the-why` treats rationale for a change that was considered but never made
as durable project state. Its strongest evidence is a small controlled
experiment that separated two possible benefits of such state:

1. preventing a harmful code edit; and
2. preventing the next agent from re-deriving the decision and continuing to
   offer the rejected alternative.

Twenty fresh Claude Code sessions using Claude Sonnet 5 received the same
request to replace a retry wrapper with a plain loop. The ten control fixtures
contained readable code but no recorded rationale. The ten treatment fixtures
added one `context/retries.md` entry explaining that the payment gateway's
per-request `Retry-After` values made the plain loop unsuitable. Both arms had
the same skill activation, prompt, fixture, and permission mode.

No session in either arm removed `Retry-After`, backoff, or jitter: the code
itself was enough for every agent to recognize the load-bearing behavior. The
rationale file therefore did **not** demonstrate defect prevention in this
case. It changed the decision process instead:

| Observed outcome | Control | Rationale present |
|---|---:|---:|
| Knew the simplification had already been rejected | 0/10 | 10/10 |
| Offered dropping `Retry-After` as a selectable option | 7/10 | 0/10 |
| Edited the wrapper at all | 3/10 | 0/10 |
| Median wall time | 43 s | 18 s |

All ten treatment sessions cited the rationale and declined the requested
simplification. All ten controls reconstructed the constraint from code; seven
still presented the previously rejected behavior change as an option, and
eight explicitly said the repository did not explain why the wrapper existed.
The useful effect is therefore **option-set narrowing with provenance**: the
next agent can distinguish “technically possible” from “already considered and
rejected,” rather than merely rediscovering the local constraint.

## Design implication

Agent memory should preserve **negative decisions** as first-class records:

- the proposed alternative;
- why it lost;
- the evidence and source for that rationale;
- whether the decision is active, superseded, open, or needs review; and
- a concrete trigger for reconsideration.

This is different from logging failed execution. A rejected change may produce
no diff, test failure, issue, or incident, yet it still changes the set of
options future agents should present. Measuring only whether later code breaks
misses the likely value. A better evaluation also measures repeated analysis,
time to justified refusal, reappearance of ruled-out options, and whether the
agent cites the decision's provenance.

The repository's skill contract adds an important trust boundary: project
memory is data, not executable instruction. It classifies `Evidence` separately
from `Status`, records conflicts rather than choosing a winner, and marks
superseded rationale instead of deleting it. That separation is necessary
because an old negative decision should constrain a new session only to the
extent that its evidence and revisit conditions remain valid.

## Limits

This is repository-published evidence from one project, one function, one
model, and 20 manually graded runs. The runner executes arms sequentially rather
than documenting random assignment or blinded grading. The treatment also tells
the agent directly that the rationale is `confirmed`, so the experiment does
not test noisy, conflicting, stale, or adversarial memory. The wall-time result
may include provider variance and is not a general latency estimate.

Most importantly, neither arm broke the wrapper. The experiment supports the
narrow claim that recorded rejected rationale changed option presentation and
re-derivation cost in this fixture; it does not establish broad coding-quality
improvement, long-horizon retention, or effectiveness in a large repository.
