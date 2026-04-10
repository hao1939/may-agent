# DD-741: CodeDelegator — Context Pollution via Role Separation (EPSS)

**Paper**: arXiv:2601.14914 (Fei, Chen, Pan, Zheng, Song — Jan 2026)
**Rating**: ★★★★ EXCELLENT
**Cluster**: Multi-Session Context Authority / Inherited Confabulation

## Core Finding

A persistent Delegator maintains strategic oversight while ephemeral Coders are instantiated with clean context per sub-task. The key innovation — **Ephemeral-Persistent State Separation (EPSS)** — isolates each Coder's execution state while preserving global coherence, preventing debugging traces from polluting the planning context.

## Architecture

```
Delegator (persistent)
  ├── Maintains strategic plan, specifications, progress
  ├── Decomposes tasks, writes specs, monitors
  └── NEVER executes code (clean context)
       │
       ├── Coder A (ephemeral) — clean spec only
       ├── Coder B (ephemeral) — clean spec only  
       └── Coder C (ephemeral) — clean spec only
```

**EPSS principle**: Each Coder agent receives ONLY its specification — not prior failures, debugging traces, or other Coders' work. The Delegator aggregates results but isolates failure traces.

## Relevance to Our System

### Direct Mapping

| CodeDelegator | Our System | Gap |
|---------------|-----------|-----|
| Persistent Delegator | May (dispatcher) | May already plays this role |
| Ephemeral Coder | Session-isolated agents | Our sessions ARE ephemeral |
| EPSS | Compaction + context injection | **Our compaction carries forward failure traces** |
| Clean spec per sub-task | Task prompt | We do this partially (heartbeat.md) |

### Key Insight
Our system already has the architectural bones of EPSS — sessions are ephemeral, May dispatches. But our **compaction leaks failure traces into new sessions**. The EPSS principle says: aggregate outcomes (what succeeded, what failed) but isolate the HOW (debugging traces, error messages, intermediate reasoning).

### Specific Recommendations

1. **Compaction policy**: When compacting session results, preserve WHAT happened (task completed, task failed, output produced) but strip HOW (tool call sequences, error messages, retry traces)
2. **Session spec pattern**: Move toward CodeDelegator's "spec-only" instantiation — each session gets a clean specification of what to do, not a history of what was tried
3. **Failure isolation**: If a session fails, the next session should know "Task X failed" but not see the failure's debugging trace (which creates anchoring effects)

## Limitations

- Paper focuses on code generation tasks; our agents do diverse work (research, analysis, guard design)
- EPSS assumes tasks are decomposable into independent sub-tasks; some of our tasks have sequential dependencies
- No evaluation of what happens when the Delegator's context itself becomes polluted (meta-context pollution)

## Cross-References
- DD-740 (Context Pollution): Quantifies why EPSS works — LLMs over-condition on prior responses
- DD-742 (OrgForge): Multi-agent chains propagate fabrications — EPSS prevents this
- DD-733 (DACS): Registry/Focus context scoping — complementary architectural pattern
- CR-335: Synthesis connecting EPSS to Error Propagation Lifecycle
- Our dispatch architecture: May already implements Delegator pattern; gap is in EPSS for context
