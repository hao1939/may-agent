<ai_context>
summary: "Pie, a native GUI for the Pi coding agent, makes an unusually precise trust distinction: project trust decides whether project-local settings, extensions, skills, prompts, themes, and system prompts are loaded, while the agent process still runs as the macOS user with that user's file and shell authority. The implementation binds the displayed decision to each RPC launch with --approve or --no-approve and restarts on a trust change. This improves state fidelity and prevents the UI from implying containment, but it is an input-loading boundary rather than runtime isolation. Agent clients should name the protected resource class and residual authority instead of presenting one generic trust badge."
triggers: ["Pie", "Pi coding agent", "project trust", "resource trust", "trust badge", "runtime containment", "--no-approve", "residual authority", "agent GUI"]
last_updated: "2026-09-16"
source_basis: "GitHub repository hieunc229/Pie and pinned repository contents at revision 29f24ee41e780a54afb943a8277152f6fb854d3a, discovered through the GitHub repository Search API."
</ai_context>

# Project Resource Trust Is Not Runtime Containment

**Date:** 2026-09-16  
**Repo:** https://github.com/hieunc229/Pie  
**Pinned revision:** https://github.com/hieunc229/Pie/commit/29f24ee41e780a54afb943a8277152f6fb854d3a

## Signal

Pie is a native macOS GUI that launches one `pi --mode rpc` child process per
active session. Its trust UI is notable less for adding a new security boundary
than for accurately naming an existing one.

`ProjectTrustService` detects project-local settings, executable extensions,
skills, prompts, themes, and system-prompt files. It resolves remembered
allow/deny decisions by nearest ancestor and converts the effective choice into
`--approve` or `--no-approve`. `PiSessionController` adds that argument to every
RPC launch; changing the choice restarts the child so the rendered trust state
and the runtime's resource-loading decision do not silently diverge.

The same UI explicitly says what this decision does **not** do. Pi still runs as
the current macOS user, can read and write files available to that account, and
can invoke shell commands with that account's permissions. The README likewise
calls project trust an input-loading control, not a sandbox, and recommends an
OS isolation mechanism for untrusted work.

## Implication

A single label such as “trusted,” “approved,” or “safe” collapses distinct
questions:

1. **Resource admission:** may project-authored instructions or executable
   extensions enter the agent context/runtime?
2. **Execution authority:** which files, processes, network destinations, and
   credentials can tools actually reach?
3. **State fidelity:** is the decision shown by the client the one consumed by
   this exact runtime launch?

Pie addresses the first and third while deliberately disclaiming the second.
That is a useful client pattern: name the protected resource class, bind the UI
state to concrete launch arguments, and disclose residual authority next to the
control. Refusing project resources can reduce prompt/plugin supply-chain risk
without reducing the ordinary authority of model-selected tools.

## Evidence boundary

This is source inspection at one pinned commit, not a build or macOS runtime
test. It verifies the declared resource detector, trust-store resolution,
launch-argument binding, restart path, and user-facing authority disclosure in
the inspected source. It does not prove Pi's downstream interpretation of the
flags, complete detection of every project resource, sandboxing, or security of
the launched agent.

**Primary evidence:**
[`README.md`](https://github.com/hieunc229/Pie/blob/29f24ee41e780a54afb943a8277152f6fb854d3a/README.md),
[`ProjectTrustService.swift`](https://github.com/hieunc229/Pie/blob/29f24ee41e780a54afb943a8277152f6fb854d3a/PiCode/Services/ProjectTrustService.swift),
[`TrustViews.swift`](https://github.com/hieunc229/Pie/blob/29f24ee41e780a54afb943a8277152f6fb854d3a/PiCode/Features/Composer/TrustViews.swift), and
[`PiSessionController.swift`](https://github.com/hieunc229/Pie/blob/29f24ee41e780a54afb943a8277152f6fb854d3a/PiCode/Features/Session/PiSessionController.swift).
