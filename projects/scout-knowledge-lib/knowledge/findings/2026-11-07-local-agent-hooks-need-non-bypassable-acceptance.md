<ai_context>
summary: "A pinned TypeScript template turns several coding-agent failure modes into executable checks—test-quality lint, mutation testing, rule/config drift tests, dependency policy, secret scanning, and full-tree pre-commit checks—but deliberately places the entire acceptance gate in locally installed Git hooks. The project explicitly documents that a missing installation or `--no-verify` bypass leaves no downstream detector, illustrating that check quality and enforcement-path coverage are separate properties."
triggers: ["coding agent guardrails", "git hooks", "mutation testing", "acceptance boundary", "complete mediation", "Straitjacket"]
last_updated: "2026-11-07"
source_basis: "Live HN item 50406402 and balajeerc/straitjacket at commit c419170286da95e6817578bbf49d0f81d18d7c3a, inspected 2026-11-07. Scout read the complete README plus prek.toml, stryker.conf.mjs, and src/driftGuard.test.ts; it did not install dependencies, run checks, inspect every file, exercise bypasses, or validate use in another project."
</ai_context>

# Local agent checks still need a non-bypassable acceptance boundary

**Date:** 2026-11-07  
**HN:** [item 50406402](https://news.ycombinator.com/item?id=50406402)  
**Repo:** [balajeerc/straitjacket](https://github.com/balajeerc/straitjacket)  
**Reviewed revision:** [`c419170286da95e6817578bbf49d0f81d18d7c3a`](https://github.com/balajeerc/straitjacket/tree/c419170286da95e6817578bbf49d0f81d18d7c3a)  
**Coverage:** complete README; `prek.toml`; `stryker.conf.mjs`; `src/driftGuard.test.ts`

## Question

What does this new coding-agent template add beyond prose instructions, and where does its enforcement boundary stop?

## Source findings

Straitjacket is a TypeScript project template rather than an agent runtime. Its README identifies recurrent ways coding output can look complete without satisfying the intended constraint, then assigns many of them to deterministic tools:

- oxlint rules reject assertion-free or focused tests and banned lint-disable directives;
- Stryker mutation testing asks whether tests fail when covered code is changed, with a configured break threshold of 90;
- drift tests compare `src/env.ts` with `sample.env`, source modules with the walkthrough, shared rule mirrors with `agent_rules/`, quoted rule numbers with configuration, and vulnerability-waiver lists with each other;
- package-install policy, vulnerability scans, secret scanning, complexity limits, type checks, coverage, build, and dependency checks cover other declared failure modes.

The repository also separates checks by cost. A pre-commit hook runs the ordinary project gate, while pre-push runs secret scanning, two dependency-security checks, a build, and mutation tests. The Stryker configuration explicitly explains that mutation testing is excluded from every commit because its cost scales with the suite.

The most important evidence is the project's own boundary statement. `prek.toml` says there is no CI, the hooks must be installed once per clone, and both `git commit --no-verify` and `git push --no-verify` bypass the entire gate with nothing downstream noticing. The README repeats this limitation. Thus the repository supplies unusually explicit executable checks while declining to claim that they are mandatory acceptance controls.

## Scout interpretation

This source makes two assurance dimensions concrete:

1. **Check quality:** does a check test the intended property rather than merely produce a green run? Mutation testing, test-file lint, and drift assertions improve this dimension.
2. **Enforcement-path coverage:** must every accepted change traverse those checks? Locally installed, bypassable hooks do not establish this dimension by themselves.

A useful coding-agent harness should preserve the template's executable checks but bind acceptance to an external path that the editing agent cannot silently skip—for example, protected CI or an independently verified merge gate. The acceptance receipt should identify the revision tested, each required check, and its result. Local hooks still provide fast feedback; they should not be the sole evidence that an unobserved branch or commit is acceptable.

This complements the library's broader finding that [agent instructions are maps while checks provide enforcement](./2026-10-15-agent-instructions-map-vs-enforcement.md): naming and implementing a check is necessary, but the route by which work becomes accepted must also require it.

## Evidence limits

The repository was two stars old at inspection and presents a project-author's design, not field evidence. Scout inspected static files only. It did not install the pinned toolchain, run the gate or tests, verify the advertised current score and coverage, attempt `--no-verify`, inspect every configuration, or evaluate false positives, maintenance cost, runtime, supply-chain safety, or use in a real agent-authored codebase. The repository's checks also cannot prove that every meaningful requirement has been encoded.

HN supplied discovery only: the item had no substantive discussion at inspection. No adoption, comparative productivity, defect-rate, or independent validation evidence was available.

## Disposition

**New knowledge.** Existing Scout notes distinguish instruction prose from executable checks and external from bypassable controls, but none covers this source's concrete combination of test-quality checks, drift guards, cost-tiered local gates, and explicit admission that the sole acceptance route can be skipped.
