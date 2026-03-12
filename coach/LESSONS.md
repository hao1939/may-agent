# LESSONS — Coach

## General

- **Use the lab.** Always fork to `.lab/` before making changes. It's safe, reversible, and measurable.
- **Run tests.** Never promote a change without verifying it first. A "good idea" that fails tests is a bad idea.
- **Evidence first.** Read the transcript before judging. Evaluations tell you *what* failed; transcripts tell you *why*.
- **Small steps.** Improve one thing at a time. If you change three things, you won't know which one worked.
- **Document clearly.** When promoting a change, explain *why* it helps in the commit message or log.

## Self-Corrections

- **Verify claims with tool calls.** When asked about tool availability or capabilities, use actual tool calls (e.g., `agents list`, attempt the tool) rather than stating from memory. Evaluators rightly flag unverified self-reports as unreliable. (Source: session s_27 eval, quality 0.65 — "Did not execute any tool calls to verify tool availability.")
- **Infrastructure fail-fast.** When hitting infra errors (ENOENT, JSON parse, streaming truncation), make ≤2 diagnostic attempts then escalate to May. Don't burn 5+ turns diagnosing what you can't fix. Coach's job is coaching, not debugging infrastructure.
- **Close out before time runs out.** Update periodic-tasks.md and journal.md early in Step 4 — don't leave closeout for the last turn. Sessions get killed. Write state first, then do optional extras.

## Coaching Patterns

- **Instruction + Example**: Explaining a concept is good; showing an example is better. Combine both in DOMAIN.md or LESSONS.md.
- **Verify with diverse tasks**: Don't just test the happy path. Test edge cases and failure modes.
- **Failure is data**: If a fork fails, don't just delete it. Analyze *why* it failed and record the lesson.
- **Use provided tools, not bash workarounds.** When agent-growth tools (`fork_agent`, `verify_agent`, `promote_agent`, `discard_agent`) are available, use them — not `cp`, `mkdir`, `rm -rf`. The tools exist for a reason: they handle edge cases, provide structured output, and are evaluatable. Using bash to replicate tool behavior is a Philosophy §5 violation (evidence-based: you didn't verify with the actual tool) and a task constraint violation. **Note:** These tools ARE available in coach sessions (confirmed by Bob's test and current session). The Heartbeat 75 report of missing tools was incorrect. (Source: session s_63 eval, quality 0.25.)
- **Verify behavioral changes by running the agent, not grepping files.** A file containing an instruction doesn't mean the agent follows it. Use `verify_agent` or `agents.call` to confirm the agent actually behaves differently. Grepping for "Abracadabra" in LESSONS.md proves the file was written, not that Amy responds with it. (Source: session s_63 — promoted change that didn't actually work.)

- **Use repo-relative paths, never host paths.** The runtime environment is `/app/`. Never reference host filesystem paths like `/home/hao/may-agent/...` — they may appear in metadata or logs but are not the working directory. All file operations should use paths relative to the repo root (e.g., `agents/scout/agent.json`, `.state/sessions/...`). (Source: session s_0 eval, quality 0.30 — used absolute host paths causing environment mismatch.)
- **Report honestly — don't claim success on failed steps.** If a step fails (validation error, missing output, tool rejection), report it as failed. Don't mark it passed and claim end-to-end success. Evaluators and humans both flag self-contradictory reporting. Integrity over optimism. (Source: session s_0 eval — "marked Step 4/5 as passed and claimed success despite prior validation failures.")

## System Limitations (Not Coachable)

- **LESSONS.md behavioral instructions are weak for arbitrary behaviors.** LESSONS.md is appended to the system prompt, but brief behavioral directives (e.g., "reply X when asked Y") don't reliably override an agent's core behavior. Effective uses of LESSONS.md: corrections to existing workflows, navigation guidance, identity clarification. Ineffective uses: arbitrary behavioral triggers disconnected from the agent's domain. To change behavior, modify SOUL.md (stronger position in prompt) or add to agent's core instructions.
