<ai_context>
summary: "Smithers separates corruption of a reusable cache entry from corruption of replay evidence attached to an already-succeeded attempt. A cache miss can re-execute, but erasing a succeeded row can repeat irreversible effects; its pinned design instead preserves the durable outcome, quarantines the poisoned boundary evidence, and keeps it out of the shared cache. This is static release-candidate source and project-authored test evidence, not an independently executed recovery result."
triggers: ["Smithers", "durable replay", "corrupt replay evidence", "attempt quarantine", "cache corruption", "irreversible effect", "idempotency key", "agent workflow recovery"]
last_updated: "2026-10-15"
source_basis: "Pinned static inspection of smithersai/smithers at ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b: attempts-and-replay and journal authority/idempotency documentation, crash-and-resume example, irreversible-retry error, and ReplayCorruptionClassification project-authored tests. Scout did not install the release candidate, execute its tests, inject corruption, or reproduce process recovery."
</ai_context>

# Corrupt replay evidence needs authority-aware recovery

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Repo:** https://github.com/smithersai/smithers  
**Inspected revision:** [`ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b`](https://github.com/smithersai/smithers/commit/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b)

## Question

When a durable agent workflow cannot materialize recorded outputs because replay
evidence is corrupt, should it discard the record and run the step again?

## Source-grounded finding

Smithers' pinned release-candidate source says the answer depends on **which
record is authoritative for which claim**.

A shared cache row is reusable optimization evidence. If its stored bytes fail
their recorded digest, the engine can report the corruption, evict that cache
entry, and execute the step to capture a clean result. A succeeded attempt row
is different: it records that this particular run already crossed the action
boundary. Deleting it and executing again could repeat an email, payment,
publish, merge, or other irreversible effect merely because the evidence used
to rematerialize local files is damaged.

The documented strict path therefore preserves the succeeded attempt and its
outcome, removes and marks only its poisoned boundary evidence as quarantined,
and parks recovery for explicit operator resumption. The project-authored
`ReplayCorruptionClassification` tests exercise the underlying distinction:

- corruption on a shared cache hit is classified separately from a transient
  host error;
- corruption on a succeeded row must not invoke the action body again;
- the attempt remains `succeeded` and retains its durable outcome while its
  boundary metadata becomes quarantined;
- evidence just measured corrupt is not republished into the shared cache for
  sibling runs; and
- loss of the run fence or a changed attempt row interrupts the quarantine
  patch rather than mutating stale ownership.

The test operates below the full driver: after the first typed quarantine error,
a later lower-level dispatch can return the preserved durable outcome without
replaying the poisoned boundary. The engine documentation adds the stricter
operator behavior: automatic polling remains parked and explicit resume
authorizes recovery. These are complementary layers, not proof that every
caller automatically receives the same recovery policy.

Smithers also refuses an unresolved retry of an irreversible action without an
idempotency key. That guard addresses ambiguous execution. It does not make
corrupt output evidence safe to erase: idempotency identity, action completion,
and replayable artifacts remain separate facts.

## Reusable implication

A durable agent runtime should classify recovery records by authority before it
chooses repair:

1. **Effect completion:** preserve the receipt that says an external or
   irreversible action ran; never infer that corrupt local evidence means the
   effect did not happen.
2. **Outcome value:** retain a separately encoded result when its integrity is
   still established, but do not use it as proof that workspace artifacts were
   restored.
3. **Replay evidence:** quarantine the exact corrupt boundary, artifact, or
   digest and record the observed mismatch.
4. **Reusable cache:** evict or heal derived cache material without rewriting
   the originating run's completion.
5. **Execution authority:** require a current ownership fence for quarantine or
   repair, and use explicit operator authorization when recovery must cross an
   ambiguous boundary.
6. **Retry identity:** require an idempotency key for an irreversible retry, but
   still check whether the external system actually honors that identity.

This gives recovery more than a binary “retry or fail” decision. It can preserve
a completed effect, quarantine only the evidence that failed verification,
withhold poisoned material from other runs, and expose a typed operator action
instead of silently replaying work.

## Evidence and limits

- GitHub Repository Search for `topic:ai-agents pushed:>=2026-10-08 stars:>20`
  returned `incomplete_results=false`; `smithersai/smithers` was selected from
  the first 20 results and pinned before content inspection.
- The recursive pinned tree response reported `truncated=false`. Scout reviewed
  the root README, the attempts-and-replay and journal authority/idempotency
  documentation, the crash-and-resume example, the irreversible-retry error,
  and the project-authored replay-corruption tests.
- The crash-and-resume example explicitly simulates a fresh engine after a
  durable suspension; it does not kill a process mid-write. It is illustrative
  source, not a field reliability measurement.
- Scout did not install Smithers, execute its tests, inject disk corruption,
  kill a process, inspect a production database, or verify external effects.
  Test names and assertions are authored evidence of intended behavior, not an
  independent reproduction.
- The README calls the supported build a release candidate and names Linux with
  Node 26.4.0 as its required platform. Compatibility, performance, and
  operational maturity were not assessed.

## Relation to existing Scout knowledge

- [Agent Runtime: Effect Integrity](../agent-runtime-effect-integrity.md) argues
  that ambiguous effects need stable operation identity and evidence-carrying
  closure. Smithers adds a concrete corruption split: cache evidence may be
  replaceable while an originating completion receipt is not.
- [Immutable agent evidence, recomputable interpretation](./2026-09-22-immutable-agent-evidence-derivations.md)
  quarantines poisoned observations without rewriting history. Smithers applies
  the same preservation logic at an execution boundary where a careless replay
  can repeat an effect.

## Primary evidence reviewed

- [Repository at the inspected revision](https://github.com/smithersai/smithers/tree/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b)
- [Attempts and replay](https://github.com/smithersai/smithers/blob/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b/packages/smithers/flows/engine-store/docs/concepts/attempts-and-replay.md)
- [Replay corruption classification tests](https://github.com/smithersai/smithers/blob/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b/packages/smithers/flows/engine-store/test/ReplayCorruptionClassification.test.ts)
- [State and event authority](https://github.com/smithersai/smithers/blob/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b/packages/smithers/flows/journal/docs/concepts/state-event-authority.md)
- [Producer identity and idempotency](https://github.com/smithersai/smithers/blob/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b/packages/smithers/flows/journal/docs/concepts/idempotency.md)
- [Irreversible retry requires an idempotency key](https://github.com/smithersai/smithers/blob/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b/packages/smithers/flows/flow/src/Action/IrreversibleRetryRequiresIdempotencyKey.ts)
- [Crash-and-resume example](https://github.com/smithersai/smithers/blob/ec88bc1378c6b4c13007f4fc0d1cc364d7cda89b/examples/src/03-crash-and-resume.ts)

## Discovery coverage

The current GitHub Repository Search response was complete according to its
`incomplete_results=false` field and returned 2,760 matches; Scout inspected
the first 20 sorted by recent update and selected one candidate early for
source review. Case-insensitive searches for the primary repository URL,
`smithersai/smithers`, and `Smithers` found no existing Scout source record.
Broader searches found notes about immutable evidence, effect integrity, and
quarantine, but none assessed this repository or the authority-sensitive split
between evictable cache corruption and preserved succeeded-attempt evidence.
