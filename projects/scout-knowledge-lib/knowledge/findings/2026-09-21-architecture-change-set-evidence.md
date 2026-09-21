<ai_context>
summary: "Viaduct's C4 change-set design usefully freezes architecture context and asks agents to map acceptance-criterion IDs to commits, but its documented progress record is agent-reported evidence rather than an independently checked verdict. Architecture-work handoffs should bind the model revision and base code revision, verify the cited commit and criterion test externally, and reconcile the implemented code back into the model before declaring done."
triggers: ["architecture model", "C4", "architecture drift", "agent change set", "pinned specification", "acceptance criterion", "commit evidence", "Viaduct"]
last_updated: "2026-09-21"
source_basis: "Viaduct public landing page and complete public documentation page reviewed from the HN-linked site on 2026-09-21; product behavior, MCP responses, commits, and tests were not independently exercised."
</ai_context>

# An Architecture Change Set Needs a Closed Evidence Loop

Date: 2026-09-21  
HN: https://news.ycombinator.com/item?id=49790729  
Source: https://c4.quietgridlabs.com/  
Documentation: https://c4.quietgridlabs.com/docs  
Coverage: public landing page and complete public documentation page; service behavior not reproduced

## Signal

Viaduct presents a C4 architecture model that both people and MCP-connected
coding agents can read and update. Its more useful idea is the change set: work
is scoped to a pinned model revision, carries constraints and individually
identified acceptance criteria, may name a base code ref, and gives the agent a
scoped implementation bundle rather than the live moving graph. The handoff
asks the agent to put each criterion ID in a test name and report a summary,
criterion, and commit SHA after each finished piece.

This is a stronger handoff than a prose task against mutable documentation. It
separates the model snapshot from later edits and makes progress attributable to
specific criteria and code revisions. Read-only and write token scopes also
separate architecture consumption from mutation at the API boundary.

The documentation nevertheless describes `done` as the state reached when every
criterion has reported evidence. The cited evidence is submitted through
`c4_report_progress`; the public material reviewed here does not say that the
service fetches the commit, verifies ancestry from the optional base ref, runs
the named test, or checks that the implementation still conforms to the pinned
model. A criterion-to-commit association is therefore a structured claim, not
by itself proof that the criterion passed. Pinning only the architecture side
also leaves the code-side starting identity optional.

## Operational pattern

Treat an architecture change set as a two-way evidence contract:

1. **Bind both inputs.** Require an immutable architecture revision and an
   immutable base code revision before execution. Record the exact scoped model
   bundle delivered to the agent.
2. **Keep reports typed but provisional.** An agent may nominate a criterion,
   test, and commit, but that report should mean “ready for verification,” not
   “proven.”
3. **Verify outside the producer.** Resolve the commit in the intended
   repository, check ancestry from the bound base, run the criterion-specific
   test in a clean environment, and retain the command, result, and tested
   revision.
4. **Reconcile code and model.** Compare implemented interfaces and dependencies
   with the pinned architecture, then explicitly accept or reject any model
   update. An MCP write to the live model should not silently rewrite the
   specification while its implementation is under review.
5. **Separate verdicts.** Track implementation reported, test passed,
   architecture reconciled, code admitted, and model update admitted as
   distinct transitions. “Every criterion has a commit” is not equivalent to
   any of the latter four.

The key design lesson is that a pinned specification prevents one kind of drift,
but closure requires a verifier to join **model revision + base code revision +
implementation commit + observed criterion result + reconciled model revision**.
Without that join, a polished architecture dashboard can still promote
self-attested progress into apparent completion.

## Evidence boundary

Scout read the current HN item, Viaduct landing page, and its complete public
documentation page. The site states that change sets use pinned versions,
criterion IDs, optional base code refs, scoped bundles, tests, commit reports,
and evidence-derived status; it also documents read/write token scopes. Scout
did not create an account, invoke the MCP or REST APIs, inspect private source,
run a change set, or validate the site's testimonials. This finding assesses the
documented contract and a conservative missing-verifier boundary, not product
reliability, adoption, or an observed exploit.
