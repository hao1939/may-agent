<ai_context>
summary: "HN-discovered AgentRuleBench reports a reproducible null for one TypeScript architecture boundary: 24 pilot runs across four control/guidance/enforcement conditions and 17 scored unguarded exploration runs introduced no request-entry-to-UI imports. The useful lesson is methodological: validate the detector, pre-register a stopping rule, publish the null, and move the next benchmark toward genuinely project-specific conventions rather than a convention models may infer from ecosystem training."
triggers: ["AgentRuleBench", "architecture erosion", "architecture rules", "AGENTS.md guidance", "deterministic lint", "agent benchmark null", "pre-registration", "project-specific conventions"]
last_updated: "2026-09-12"
source_basis: "HN item 49676575 and Tommkruix/agentrulebench repository README, write-up, pre-registrations, and checked-in JSONL results at commit d57e9e6b1ec7286f3deda099fad4c0068f41ab6f."
</ai_context>

# A Null Result Can Reveal That an Agent Rule Benchmark Is Too Inferable

HN item [49676575](https://news.ycombinator.com/item?id=49676575) surfaced
**AgentRuleBench**, a small open benchmark asking whether coding agents erode an
architectural boundary that prose instructions or deterministic linting could
protect. Its useful result is negative and narrow: the tested agents did not
cross the boundary even without either control.

The benchmark's measured rule was that a request-entry file must not import a UI
component. In the checked-in pilot, 24 runs covered three vendors' frontier
models and four conditions: unguarded control, prose guidance, an instruction to
lint, and the inferred lint rule plus that instruction. Every run passed the
functional acceptance check and remained compliant; there were no first-pass
violations to correct. A separately pre-registered stress exploration then used
a longer, deliberately baited three-route task under the unguarded control and
a six-model frontier/cheaper capability ladder. The result file contains 18
runs, one of which failed for API credit, leaving the **17 scored runs** reported
by the author; none imported a UI component into a request entry.

This does **not** show that prose and hard enforcement are equivalent. With no
violations in any arm, the study had no positive event on which to estimate an
enforcement effect. It shows only that this one rule, repository, and task family
did not create the failure mode the intervention was meant to prevent. The rule
is also unusually ecosystem-typical: separating React UI components from server
request entries is likely inferable from broad TypeScript/Next.js training even
when the repository says nothing explicitly.

## Why the null is still reusable

The repository preserves several controls that make the null informative rather
than merely an absence of alarms:

1. **The scorer was challenged with a planted violation.** The harness includes
   an end-to-end test in which a violating reference route is expected to be
   detected and named. This separates “nothing violated” from an obviously dead
   detector, although it does not establish recall over every TypeScript import
   pattern.
2. **The exploration had a stopping rule before it ran.** Its pre-registration
   said that zero violations across the capability ladder would stop the study;
   the author did not search additional rules and repositories until a positive
   result appeared.
3. **Functional success and rule compliance were separate in the pilot.** A run
   could not count as violation-free completion merely by avoiding the requested
   work.
4. **The raw run tables are inspectable.** The committed pilot JSONL has 24
   records, and the exploration JSONL has 18 records with the request-entry files
   changed and per-run violation status.

The design implication is to **calibrate the benchmark before comparing soft and
hard controls**. First run the unguarded base-rate arm and prove that the detector
catches a planted violation. If the target failure never occurs, spending more
runs on guidance-versus-enforcement cannot measure the intervention. A stronger
next benchmark would choose a convention that is genuinely local and surprising
rather than ecosystem-idiomatic, use multiple repositories and tasks, and retain
both functional and architectural scoring. This is not an argument against lint
rules: deterministic rules can still prevent human regressions and encode local
intent. It is an argument against claiming agent-specific benefit without a
measured unguarded failure rate.

## Boundaries

- Only one agent-level boundary was tested, on one repository and two related
  tasks. Naming, state management, cross-module invariants, and unusual local
  conventions remain untested.
- The 24-run pilot used only two repetitions per model-condition cell. The
  17 scored exploration runs tested compliance only, not functional acceptance.
- The repository and results are author-published, not independently replicated.
  The raw artifacts make replication possible but are not themselves an
  independent reproduction.
- A previously catalogued HN claim reported violations on cheaper models under a
  different architecture-rule setup. These observations should not be pooled:
  the rules, repositories, tasks, harnesses, and model sets differ. The contrast
  is a reason to publish those dimensions, not evidence that either result
  generalizes.

## Sources

- Source: https://news.ycombinator.com/item?id=49676575
- Repo: https://github.com/Tommkruix/agentrulebench/tree/d57e9e6b1ec7286f3deda099fad4c0068f41ab6f
- Write-up: https://github.com/Tommkruix/agentrulebench/blob/d57e9e6b1ec7286f3deda099fad4c0068f41ab6f/WRITEUP.md
- Pilot results: https://github.com/Tommkruix/agentrulebench/blob/d57e9e6b1ec7286f3deda099fad4c0068f41ab6f/results/pilot-results.jsonl
- Exploration pre-registration: https://github.com/Tommkruix/agentrulebench/blob/d57e9e6b1ec7286f3deda099fad4c0068f41ab6f/pre-registration/EXPLORATION-PREREG.md
- Exploration results: https://github.com/Tommkruix/agentrulebench/blob/d57e9e6b1ec7286f3deda099fad4c0068f41ab6f/results/gate-probe.jsonl
