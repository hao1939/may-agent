<ai_context>
summary: "Mercury's pinned source records a concrete cross-agent permission leak caused by mutable authority on a shared manager, then replaces it with frozen request-local contexts carried through AsyncLocalStorage. Child contexts intersect requested tools with parent tools, retain only parent-covered path scopes, drop skill elevation, and refuse to inherit one-turn background auto-approval. This is static repository evidence and project-authored regression coverage, not an independent security evaluation or proof that every effect path uses the context correctly."
triggers: ["Mercury Agent", "immutable permission context", "AsyncLocalStorage permissions", "sub-agent authority", "background grant inheritance", "permission cross-talk", "child subset parent"]
last_updated: "2026-11-09"
source_basis: "Static inspection of cosmicstack-labs/mercury-agent at commit 5c818ab5994b1a973b8e7351442e8f19424426cf: README, src/capabilities/permission-context.ts, src/capabilities/permission-context.test.ts, selected permission-manager, bot-tier, SSRF, and background-shell approval files. Tests were read but not executed."
</ai_context>

# Concurrent agents need request-local authority, not mutable manager state

**Date:** 2026-11-09  
**Disposition:** new knowledge  
**Repo:** https://github.com/cosmicstack-labs/mercury-agent  
**Reviewed revision:** `5c818ab5994b1a973b8e7351442e8f19424426cf`

## Question

What implementation evidence does Mercury provide for preventing permission changes in one concurrent agent turn from silently widening another agent or sub-agent?

## Source observation

Mercury's `permission-context.ts` documents a prior failure mode in which the main agent and its sub-agents shared mutable permission fields on one `PermissionManager`. A scheduled internal turn could temporarily switch on auto-approval, and a delegated worker whose tool call landed during that interval could inherit the wider authority.

The inspected revision replaces that ambient mutable view with a frozen `PermissionContext` carried through Node's `AsyncLocalStorage`. Tool checks resolve the context attached to the current asynchronous execution tree rather than whichever values happen to be present on the shared manager when the check runs. Context replacement is local to the current cell; the context object and its scope entries are frozen.

Child derivation is deliberately attenuating across several axes:

- requested tools are intersected with the parent's allow-list when the parent is restricted;
- requested filesystem scopes survive only when a parent scope covers the path and every requested read, write, and execute bit;
- skill elevation is cleared rather than inherited;
- a user-selected session auto-approval may be inherited, but a temporary internal-turn auto-approval is not; and
- sender role cannot be promoted from member to admin by child derivation.

The permission manager also separates a scheduled turn grant from the persistent session setting. Starting the turn grant changes only the root context; already-running children do not see it, newly spawned children do not inherit its auto-approval, and ending it leaves a user's independent session choice untouched. In fail-closed bot mode, skill declarations are explicitly prevented from widening granted scopes.

Project-authored tests encode these boundaries. They check frozen contexts, tool intersection, covered-scope filtering, non-inheritance of turn grants and skill elevation, isolation between concurrent asynchronous agents across awaits, and the rule that a grant made inside one agent remains with that agent. A separate regression test requires the `/bg` shell entry point to call the normal shell permission check before spawning a command, reflecting the distinct problem of alternate effect paths bypassing an otherwise sound context model.

## Reusable pattern

Treat effective authority as an immutable, request-local value that travels with the execution tree. A shared policy object may own configuration and evaluators, but it should not hold the current caller's mutable authority as ambient global state.

For every child or delegated execution, derive a context with an explicit monotonic rule:

1. intersect tool capabilities;
2. retain only resource scopes covered by the parent;
3. distinguish durable user grants from one-turn operational grants;
4. clear non-delegable elevation;
5. assert that the result is a subset of the parent; and
6. ensure every effect entry point consults the same context before acting.

This separates two failure classes that need different receipts. **Context isolation** proves concurrent work cannot borrow another turn's authority. **Effect-path coverage** proves background commands, plugins, schedulers, and other alternate routes actually consult that isolated authority before producing an effect.

## Evidence boundary

This is static inspection of one repository revision. Scout did not install or run Mercury, execute its tests, reproduce the historical permission leak, inspect every call site, exercise concurrent tool effects, audit package dependencies, or verify deployed channel and bot configurations. The tests are project-authored regression evidence, not independent validation. Source comments identify historical issues and intended guarantees, but they do not prove all current or future effect paths honor those guarantees. The repository's broader claims about token budgets, memory, daemon recovery, channel security, and verified coding completion were not evaluated here.

## Implication

A permission gate can be locally correct and still become unsafe when caller identity and grants live in mutable shared state. Long-running and multi-agent runtimes should test not only allow/deny decisions, but adversarial timing: one turn temporarily widens authority while another awaits, spawns a child, resumes, or enters a background path. The required receipt is both a subset-derived request context and demonstrated mediation at each effect boundary.
