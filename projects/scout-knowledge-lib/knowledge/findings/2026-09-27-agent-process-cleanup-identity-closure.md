<ai_context>
summary: "Static inspection of Leftovers shows that post-agent process cleanup needs separate evidence for detection, attribution, authorization, identity-safe termination, and observed exit; estimated memory recovery is not verified closure."
triggers: ["agent process cleanup", "orphan process", "PID reuse", "process identity", "MCP server", "Leftovers", "termination verification"]
last_updated: "2026-09-27"
source_basis: "HN 49861159 and pinned static inspection of arpwal/leftovers at revision 1bffef805ed7d775590f54524fb3d83e0693e5dd. Scout did not build or run the macOS application, reproduce its 59 GB example, or test its heuristics against live processes."
</ai_context>

# Agent process cleanup needs identity and closure evidence

**Date:** 2026-09-27  
**Disposition:** new knowledge  
**Coverage:** complete HN submission metadata and text; repository README plus selected classification, attribution, and termination source at a pinned revision

## Signal

[HN 49861159](https://news.ycombinator.com/item?id=49861159) introduced [Leftovers](https://github.com/arpwal/leftovers), a macOS process monitor aimed at applications and coding-agent sessions. The useful signal is not the project's unverified anecdote about a helper with a 59 GB footprint. It is the implementation's separation of several judgments that “clean up an agent session” often collapses:

1. **Detection:** static rules identify high-footprint idle processes, developer runtimes whose working directory disappeared, and old idle developer processes detached from a terminal or agent ancestry.
2. **Attribution:** a process-tree walk groups descendants under recognized Claude Code, Codex, Gemini CLI, Cursor Agent, Aider, or OpenCode roots and labels repeated tool-server processes.
3. **Authorization:** protection runs before leak classification, excluding other users, core system processes, the cleanup tool itself, and user-protected names. Most macOS binaries remain protected.
4. **Identity-safe action:** immediately before signalling, the terminator checks both PID and process start time, avoiding a signal to a different process after PID reuse.
5. **Observed local exit:** it sends `SIGTERM`, polls for up to three seconds, rechecks identity, and then uses `SIGKILL` if the same process remains.

The fifth claim is narrower than the CLI's final estimate. `CleanCommand` sums the *pre-termination* footprints of all suspects and prints `Freed about ...` regardless of whether each result was `terminated`, `forceKilled`, `alreadyGone`, `refused`, or `failed`. It does report each per-process result, but it does not resample system memory or descendants before producing the aggregate estimate. A successful signal or disappearance of one PID therefore is not evidence that every descendant exited or that the estimated bytes were reclaimed.

## Reusable rule

Treat cleanup as a typed protocol rather than one “killed” flag:

`detected candidate → attributed owner/session → authorized target → identity revalidated → termination requested → target exit observed → descendant set rescanned → resource recovery measured`

Preserve the reason and evidence at every transition. In particular:

- key process authority by an incarnation such as `(pid, start time)`, never PID alone;
- keep heuristic classification distinct from permission to terminate;
- report graceful exit, forced exit, already-gone, refusal, and error separately;
- after a parent exits, rescan its previously observed descendants because reparenting can invalidate the original tree attribution;
- label reclaimed memory as an estimate until a post-action sample confirms it.

This complements crash and unattended-run evaluations: a harness should first observe what the agent runtime itself leaves behind, then perform harness cleanup for test isolation, and report those as separate outcomes.

## Evidence limits

Scout inspected the repository at revision `1bffef805ed7d775590f54524fb3d83e0693e5dd` but did not clone, compile, or run it. The reviewed source supports the control-flow statements above, not the accuracy of process names, ancestry, footprint readings, leak heuristics, or memory-recovery claims in deployment. The HN submission had two points and no comments when assessed, so it supplies discovery rather than independent validation.

A separate high-engagement item in the same scan, [HN 49861047](https://news.ycombinator.com/item?id=49861047), alleged an 826-child Codex run and roughly USD 78,000 in charges. The author explicitly said local token counters were not the authoritative billing ledger, supplied no independently reviewable artifacts, and commenters raised account and vote-manipulation concerns. It did not justify recording the incident or amount as fact. Its only defensible implication—bound fan-out and spend with independent accounting—is already covered by the library's runtime and governance material.

## Sources

- **Source:** https://news.ycombinator.com/item?id=49861159
- **Repo:** https://github.com/arpwal/leftovers
- **Inspected revision:** https://github.com/arpwal/leftovers/commit/1bffef805ed7d775590f54524fb3d83e0693e5dd
- **Primary implementation:** [classification order](https://github.com/arpwal/leftovers/blob/1bffef805ed7d775590f54524fb3d83e0693e5dd/Sources/Leftovers/Classification/ProcessClassifier.swift), [leak rules](https://github.com/arpwal/leftovers/blob/1bffef805ed7d775590f54524fb3d83e0693e5dd/Sources/Leftovers/Classification/LeakDetector.swift), [protection policy](https://github.com/arpwal/leftovers/blob/1bffef805ed7d775590f54524fb3d83e0693e5dd/Sources/Leftovers/Classification/ProtectionPolicy.swift), [session attribution](https://github.com/arpwal/leftovers/blob/1bffef805ed7d775590f54524fb3d83e0693e5dd/Sources/Leftovers/Agents/AgentSessionBuilder.swift), [termination path](https://github.com/arpwal/leftovers/blob/1bffef805ed7d775590f54524fb3d83e0693e5dd/Sources/Leftovers/Actions/ProcessTerminator.swift), and [cleanup aggregate](https://github.com/arpwal/leftovers/blob/1bffef805ed7d775590f54524fb3d83e0693e5dd/Sources/Leftovers/CLI/CleanCommand.swift)
