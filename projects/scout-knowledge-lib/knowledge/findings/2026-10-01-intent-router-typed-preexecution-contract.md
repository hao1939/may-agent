<ai_context>
summary: "Intent-Router treats request clarification as a typed, persisted pre-execution contract: objective unknowns are probed, human decisions are asked one at a time, unresolved or degraded cases halt, and delivery is checked constraint by constraint. The pinned repository includes a JSON Schema and a real-harness evaluation runner, but enforcement remains prompt-level and the published evidence is small and mixed."
triggers: ["Intent-Router", "IntentSpec", "pre-execution contract", "clarifying questions", "intent compilation", "typed request", "probe before ask", "delivery verification"]
last_updated: "2026-10-01"
source_basis: "Static review of angel291592/Intent-Router at pinned revision b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e: README, skill instructions, IntentSpec schema, evaluation runner, and published reports. Scout did not run the harness evaluations."
</ai_context>

# Compile Ambiguous Requests Into Reviewable Contracts Before Execution

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Coverage:** Pinned repository source and project-authored evaluation artifacts; no independent harness run

## Question

Can an agent turn a vague request into a durable, inspectable contract without either guessing important choices or asking a long list of questions?

## Source observation

[Intent-Router](https://github.com/angel291592/Intent-Router) packages this problem as a prompt-only agent skill. At pinned revision `b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e`, its core artifact is a persisted `IntentSpec` with:

- the request in the requester's own words;
- named objects and constraints;
- constraint provenance (`explicit`, `probed`, `asked`, or `inferred`);
- open fields classified as objective facts to probe or decisions to ask;
- exactly one decision state: `ROUTE`, `ASK`, or `HALT`;
- diagnostic counts and a trace; and
- an optional post-delivery verification result for each constraint.

The skill's strongest design rule is **probe before ask**. It instructs the agent to inspect manifests, entry points, existing implementations, configuration, tests, and bounded version history before interrupting a person. Questions are reserved for preferences and irreversible choices, asked one at a time under a default budget of three. It also separates two reasons not to proceed: `underspecified` means a decision is still missing, while `degraded` means an attempted lookup failed. A sufficient contract may contain visible inferences, but an inferred irreversible constraint blocks routing.

This is more than a prose template. The repository includes a Draft 2020-12 JSON Schema that restricts fields and decision variants, requires evidence on probed and inferred constraints, and requires at least one object for `ROUTE`. Its Python evaluation runner validates case keys, parses the final YAML fence, checks evidence form and path existence, exercises fresh fixture copies through a real harness, and separately scores delivered code. These are project-authored controls, not independent validation.

## Why the pattern matters

A useful handoff should preserve **what was decided, who or what supplied each decision, what remains unknown, and whether the delivered work actually met it**. That makes ambiguity resolution part of operation admission rather than disposable conversation. It complements the library's [operation-admission patterns](../agent-runtime-operation-admission-and-identity.md): the contract can improve the semantic input to a planner or executor, while capability, authorization, concurrency, effect settlement, and receipts still belong to the runtime boundary.

The reusable pattern is:

1. parse a request without silently completing it;
2. distinguish objective unknowns from preference or authority decisions;
3. probe authoritative local sources before asking;
4. preserve explicit, observed, human-decided, and inferred constraints as different provenance classes;
5. refuse irreversible guesses;
6. hand off one versioned contract; and
7. verify the resulting artifact against each constraint with concrete pointers.

This is narrower and more operational than generic “ask clarifying questions.” It also differs from simple abstention: the goal is to close resolvable gaps and route useful work, while retaining a typed stop when the remaining gap cannot safely be closed.

## Evidence and limitations

The repository's reports are unusually candid, but they do not establish broad effectiveness:

- A 2026-09-24 delivery comparison reports five bare runs scoring 5/6 and three skill runs scoring 6/6 on one TypeScript caching fixture. The skill arm always stated a cache-failure policy, while the bare arm did not, but it also used two additional sessions and about 90 extra seconds per run.
- A later 2026-09-28 smoke comparison is mixed: the single skill run declared the policy and emitted an intent check, but changed a database-layer file and rewrote a fixture test, losing the contract-preservation item and taking 940.8 seconds. The bare and one-line-prompt arms each scored all six items available to spec-less arms. The report explicitly says `N=1` is not publishable evidence.
- The latest targeted behavior report passed both repeats of the automatic-trigger case, but one of two two-turn attempts timed out; the report therefore marks the two-case subset as failed while classifying the timeout as environmental.
- The evaluation fixtures are mostly TypeScript/Node, published non-code coverage is incomplete, and the project has not yet covered ask-budget exhaustion. Some tests validate response shape and source pointers rather than the truth of every semantic decision.
- The skill is prompt-only. The schema and runner can detect malformed output after generation, but they do not themselves prevent an executor from ignoring the contract, fabricating a semantically plausible source claim, or crossing an unauthorized effect boundary.
- Scout reviewed source and reports statically and did not reproduce the harness sessions, run the repository's self-tests, or audit every file in the archive.

Accordingly, treat Intent-Router as a concrete design and evaluation scaffold for pre-execution contracts—not proof that intent can be compiled reliably across domains, and not an authorization system.

## Practical implication

For agent runtimes, a typed intent artifact is most useful as an **admission input**: validate its structure, require unresolved fields to be empty before execution, surface inferred or irreversible choices for policy review, bind the accepted contract version to the resulting task, and verify delivery independently. Keep runtime permissions and effect gates separate. A well-formed statement of intent answers “what work was agreed?”; it does not answer “is this actor allowed to perform the effect?”

## Source record

- **Repo:** https://github.com/angel291592/Intent-Router
- **Inspected revision:** [`b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e`](https://github.com/angel291592/Intent-Router/commit/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e)
- **Primary files:** [skill contract](https://github.com/angel291592/Intent-Router/blob/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e/skills/intent-router/SKILL.md), [IntentSpec schema](https://github.com/angel291592/Intent-Router/blob/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e/skills/intent-router/schema/intentspec.schema.json), [evaluation runner](https://github.com/angel291592/Intent-Router/blob/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e/evals/run.py), [2026-09-24 delivery report](https://github.com/angel291592/Intent-Router/blob/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e/evals/reports/2026-09-24-delivery-opencode.md), [2026-09-28 behavior report](https://github.com/angel291592/Intent-Router/blob/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e/evals/reports/2026-09-28-opencode.md), and [2026-09-28 delivery smoke report](https://github.com/angel291592/Intent-Router/blob/b776e5d6f06027396a8eec2e8a6beb9e1c7daa3e/evals/reports/2026-09-28-delivery-opencode.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" (policy OR approval OR sandbox) created:>2026-09-20`, sorted by stars, 15 results requested
- **Search response:** `total_count: 11487`; `incomplete_results: false`
- **Repository metadata at inspection:** 476 stars; MIT license; default branch `main`
