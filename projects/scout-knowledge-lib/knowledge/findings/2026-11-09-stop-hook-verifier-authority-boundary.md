<ai_context>
summary: "DSH PUA's pinned Stop hook turns an agent's completion promise into a trigger for a host-run verification command and blocks termination when that command fails. The separation is useful, but the inspected source does not establish an independent oracle: verifier configuration lives in a local Markdown state file, the command runs as a shell in the agent-modifiable workspace, and the integrity hook does not deny changes to that loop state. Completion gates need verifier authority and candidate binding, not only a separate process invocation."
triggers: ["DSH PUA", "stop hook verifier", "completion promise", "verify_command", "oracle isolation", "agent completion gate", "verifier authority boundary"]
last_updated: "2026-11-09"
source_basis: "Static inspection of MichengAI/dsh-pua at commit d24dd8a73733e84deef22e059c7dd973d6e6eccb: README.en.md, the pua-loop skill, hooks registry, pua-loop-hook.sh, integrity-guard.sh, runtime-state.py, checkpoint-save.sh, package metadata, and selected tests. Scout did not install or run the plugin or its tests."
</ai_context>

# A stop-hook verifier needs an authority boundary, not just a separate process

**Date:** 2026-11-09  
**Disposition:** new knowledge  
**Repo:** https://github.com/MichengAI/dsh-pua  
**Reviewed revision:** `d24dd8a73733e84deef22e059c7dd973d6e6eccb`

## Question

What does DSH PUA's verification loop establish when it checks an agent's completion claim in a Stop hook, and what remains necessary before calling that check an independent oracle?

## Source observation

The pinned repository implements a useful two-stage completion gate. The agent must emit an exact `<promise>` value before the Stop hook considers completion. If a `verify_command` is configured, the hook then runs that command itself with a 120-second timeout. A non-zero exit records `promise_rejected`, preserves a bounded tail of the command output, increments the iteration and rejection counts, and returns a blocking decision that continues the loop. Exit zero records completion and removes the active loop state. Explicit pause, abort, iteration-limit, session-mismatch, malformed-state, missing-transcript, and stale-state paths are handled separately.

This makes an important distinction: **the agent's declaration is a request to evaluate completion, not completion evidence.** The Stop hook can withhold termination after a failed command even when the model says the work is done. The history also preserves rejected claims separately from ordinary continuations, which can expose repeated attempts to satisfy the wrong condition.

The repository describes this design as “Oracle Isolation” and says the agent cannot modify the verification command stored in state-file frontmatter. The inspected implementation does not establish that stronger authority claim:

- loop state is resolved from `$HOME/.claude/pua/loop-<cwd-hash>.md`, an older home-directory file, or a project-local `.claude/pua-loop.local.md`;
- `pua-loop-hook.sh` parses `verify_command` directly from that mutable Markdown frontmatter and invokes it with `bash -c`;
- the command executes in the same workspace and ambient environment whose files, scripts, dependencies, PATH resolution, and test inputs may have been changed by the agent;
- `integrity-guard.sh` has no protected-write rule for the loop-state files or the `verify_command` field; and
- its scoring-adjacent write detections produce advisory context for many mutations rather than a deny decision, so they do not themselves create a non-bypassable evaluator boundary.

The hook therefore provides **control-flow separation**—the host hook, not the model's prose, decides whether to continue—but not demonstrated **authority separation** between executor and verifier. A separate process invocation can still evaluate an agent-influenced command, evaluator, fixture, environment, or candidate.

There are additional evidence limits. Exit zero is the only success predicate visible in the Stop hook. The gate does not itself bind the result to a commit or content digest, prove that the intended tests ran non-vacuously, preserve the full verification output as an admitted artifact, or prevent relevant files from changing between verification and later publication. A missing `verify_command` explicitly falls back to the honor system. The 30-minute stale-state cleanup improves liveness but can also end a loop without establishing task completion.

## Reusable pattern

A completion promise should trigger a verifier owned by a different authority domain. For a strong gate, retain separate receipts for:

1. **claim:** the agent requested completion for an exact task and candidate;
2. **verifier identity:** immutable command, evaluator revision, fixtures, and policy selected by the task owner or host;
3. **execution boundary:** the agent cannot rewrite or shadow the verifier, its dependencies, or its trusted inputs;
4. **candidate binding:** verification names the exact tree, artifact digest, environment, and requirement set checked;
5. **non-vacuity:** expected tests, cases, assertions, or probes actually executed;
6. **result:** complete output, exit status, duration, and truncation or timeout state; and
7. **settlement:** the candidate that is published or deployed is the candidate that passed.

The Stop-hook pattern remains valuable at the first boundary: self-report should not be sufficient to end an autonomous loop. But “the hook ran it” is not equivalent to “the executor could not influence it.” Oracle isolation is an authority property, not merely a process-topology label.

## Evidence boundary

Scout inspected static public source at one pinned revision. Scout did not install DSH PUA, execute its package tests, run a live Claude Code loop, attempt to alter loop state or verifier inputs, test platform-specific timeout behavior, or audit every installer and packaging path. The repository-authored text and code establish the intended hook flow and the visible file and command boundaries; they do not establish exploitability in every host configuration or prove that deployed host permissions never add stronger protection. The repository's broader claims about task persistence, personas, compatibility, hidden-answer protection, and user outcomes were not evaluated.

## Sources

- **Repository:** https://github.com/MichengAI/dsh-pua
- **Pinned tree:** https://github.com/MichengAI/dsh-pua/tree/d24dd8a73733e84deef22e059c7dd973d6e6eccb
- **Stop-hook gate:** https://github.com/MichengAI/dsh-pua/blob/d24dd8a73733e84deef22e059c7dd973d6e6eccb/assets/pua/upstream/hooks/pua-loop-hook.sh
- **Loop contract:** https://github.com/MichengAI/dsh-pua/blob/d24dd8a73733e84deef22e059c7dd973d6e6eccb/assets/pua/upstream/skills/pua-loop/SKILL.md
- **Integrity hook:** https://github.com/MichengAI/dsh-pua/blob/d24dd8a73733e84deef22e059c7dd973d6e6eccb/assets/pua/upstream/hooks/integrity-guard.sh
- **Hook registration:** https://github.com/MichengAI/dsh-pua/blob/d24dd8a73733e84deef22e059c7dd973d6e6eccb/assets/pua/upstream/hooks/hooks.json
