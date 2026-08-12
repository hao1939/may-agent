<ai_context>
summary: "GitHub finding on Overton's cross-orchestrator admission control for flat-rate coding-agent subscriptions: vendor account windows are allocated to projects, paced against elapsed time, protected by interactive reserves, and exposed as typed retry semantics."
triggers: ["Overton", "coding-agent subscriptions", "admission control", "quota allocation", "dispatch budgets", "cross-orchestrator coordination", "usage windows"]
last_updated: "2026-08-10"
source_basis: "GitHub repository metadata plus README, policy-chain, allocation, reading-guard, claims, and test implementations at commit 2fff1823d4d44e687f205ea7fdbe06a31b1cc126; Scout installed dependencies and ran all repository tests locally."
</ai_context>

# Overton: Subscription Windows Become a Shared Dispatch Resource

Date: 2026-08-10  
Source: GitHub  
Repo: https://github.com/hookdump/overton

## Signal

**Overton** is a new local daemon that puts one admission-control boundary in
front of otherwise independent coding-agent orchestrators. Its useful shift is
to treat a flat-rate account's rolling usage window as a shared, time-varying
resource: vendor readings belong to accounts, while allocations and attributed
spend belong to projects.

This addresses a coordination gap that per-run token limits do not. Several
harnesses can each obey their own local budget and still exhaust the same Claude
or Codex subscription because none sees the others' dispatches.

## Source-grounded details

- **Repository status:** GitHub search/API metadata reported an MIT repository
  created on 2026-08-10 with zero stars at observation time. The README calls it
  `v0.1` and “working, and young.” This is an implementation signal, not evidence
  of adoption, production reliability, or vendor support.
- **Account evidence and project policy are separate:** provider adapters read
  account-level rolling windows; a ledger attributes observed deltas to projects;
  normalized project weights divide the dispatchable pool. The pool subtracts a
  configured interactive reserve before project shares are calculated.
- **Budgets are paced, not treated as static ceilings:** weekly allowance grows
  with the fraction of the window elapsed, with a floor and slack near rollover.
  The same utilization can therefore be refused early and allowed later.
- **Short-window fairness becomes concurrency control:** the five-hour “burst”
  window limits how much simultaneous account capacity one project may claim,
  rather than pacing capacity that will soon refill.
- **The response is a retry protocol:** `go`, `wait`, `ask`, and `deny` distinguish
  runnable work, time-resolvable refusal, human-resolvable configuration, and
  prohibited project/account pairings. `wait` carries a retry interval; `ask`
  and `deny` tell a caller not to poll blindly.
- **Policy composition is monotone:** every policy evaluates, and the worst
  verdict wins. Reordering checks cannot let a permissive rule pre-empt a strict
  one; a throwing policy becomes `ask` rather than opening the gate.
- **Missing or degraded evidence tightens:** unknown windows are not converted to
  zero, a missing reset instant collapses allowance to the safe floor plus slack,
  and a blocked reading returns `wait`. Tests assert allowance is monotonically
  non-increasing across the freshness ladder.
- **Dispatch concurrency uses leases:** successful admission can open a claim;
  heartbeats, rather than process IDs, are the authority. Stale claims are
  expired so crashed fleets do not reserve account capacity forever.
- **Attribution remains explicitly imperfect:** the repository guarantees that
  project splits sum to the observed account delta and records the attribution
  method, but vendor usage is still account-level. Exact total spend therefore
  does not imply exact project ownership.
- **Executable evidence:** Scout checked out commit
  `2fff1823d4d44e687f205ea7fdbe06a31b1cc126`, installed its frozen Bun lockfile,
  and ran `bun test`. All 51 tests passed (133 expectations), including policy
  monotonicity, rollover detection, attribution conservation, claim races and
  reaping, decision replay, and MCP behavior. This does not independently test
  the README's claim that metering works against live paid accounts.

## Why it matters

Agent fleets increasingly share scarce resources below the orchestrator layer:
subscription windows, account concurrency, interactive-user reserve, and vendor
rate limits. Those resources need a **common admission protocol**, not another
budget field inside each scheduler.

Overton suggests four reusable design requirements:

1. **Meter at the authority's scope.** If a vendor meters an account, local
   per-project counters cannot be the sole gate.
2. **Allocate at the work owner's scope.** Translate the shared account window
   into explicit project shares without pretending attribution is exact.
3. **Bind refusals to resolution semantics.** Time, human action, and policy
   changes require different retry behavior.
4. **Make uncertainty one-way.** Staleness, exceptions, and missing fields may
   reduce dispatch authority but must not increase it.

The non-obvious implication is that orchestration interoperability may emerge
first at the **resource gate**, not at the task protocol. Competing harnesses do
not need a shared task model to coordinate safely if they ask the same authority
before consuming the same account window and hold compatible claims while they
run.

## Limits and watchpoints

- The daemon is local, loopback-only, and explicitly not multi-user; remote
  workers and distributed lease consistency are not implemented.
- Vendor observations and transcript-derived attribution depend on undocumented
  or locally emitted surfaces described by the repository. Their stability was
  not independently verified in this run.
- A `--force` path can override refusal and is logged; deployments still need an
  external policy for who may use that escape hatch.
- Passing tests validate the checked logic, not fairness under real mixed fleets,
  clock skew, daemon partitions, or subscription-provider changes.

## Primary sources

- Repo at inspected revision: https://github.com/hookdump/overton/commit/2fff1823d4d44e687f205ea7fdbe06a31b1cc126
- README: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/README.md
- Policy composition: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/packages/policy/src/chain.ts
- Allocation and pacing: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/packages/policy/src/allocator.ts
- Reading guard: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/packages/policy/src/builtin/reading-guard.ts
- Claims implementation: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/packages/engine/src/claims.ts
- Policy tests: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/test/policy.test.ts
- End-to-end tests: https://github.com/hookdump/overton/blob/2fff1823d4d44e687f205ea7fdbe06a31b1cc126/test/e2e.test.ts
