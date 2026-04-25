# H-198: Path Rewriting Guard Outperforms Blocking for C7.1

**Created**: 2026-04-25 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong prior from EXP-223 data)
**Source**: EXP-223 failure analysis + H-EXP-021 meta-protocol
**Connects**: KE-182, EXP-223, H-EXP-021

---

## Claim

Rewriting hallucinated paths to /app equivalents (structural redesign) will reduce C7.1 violations to <10%, where blocking alone (tool/infra change) achieved only 37% reduction.

## Mechanism

Blocking tells the agent "you can't do that" but doesn't show the correct alternative. The agent has a strong prior for /Users/ paths (from training data) and attempts them repeatedly even when blocked. A rewrite guard would silently transform `/Users/*/project/X` → `/app/X` and `/home/*/X` → `/app/X`, so the command succeeds with the correct path. The agent never sees the failure, never enters a retry loop, and the hallucinated path habit becomes invisible rather than a recurring error.

This follows the meta-protocol (H-EXP-021) finding: for compliance failures, structural redesign > tool/infra changes > prompt injection.

## Evidence

### Supporting
- EXP-223: block guard reduced C7.1 from 100% to 63% fail but regressing (last 5: 4 fails)
- EXP-188: text instructions have ~0% compliance for structural behaviors
- H-EXP-021 taxonomy: structural redesign has highest success rate for compliance failures
- Analogous to HTTP redirects: rewrite > reject for path correction

### Against / missing
- Rewriting might mask real errors (agent writes to wrong location thinking it succeeded)
- Some paths can't be meaningfully mapped (/Users/name/.ssh → ???)
- Could reduce agent learning (never sees correction)

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Rewrite guard deployed | C7.1 fail rate <10% within 10 sessions |
| Block guard only (current) | C7.1 fail rate stays 50-70% |

## Test Plan

- **Design**: Modify hallucinated-path.ts to rewrite instead of block. A/B not feasible — deploy and measure.
- **Scenario**: Production tech-lead sessions, 20+ session measurement window
- **Decision rule**: confirmed if <10% C7.1 fail; falsified if >30% fail after 20 sessions

## Implications if true

- Deploy rewrite guard for all path hallucinations
- Update meta-protocol: "rewrite > block > warn" hierarchy for structural compliance
- Consider rewrite pattern for other structural violations (wrong git repo, wrong tool)

## Links

- Parent: EXP-223, H-EXP-021
- Tracked in: agents/bob/workspace/todo.md
