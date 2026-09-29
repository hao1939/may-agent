<ai_context>
summary: "HN surfaced Corral, a Linux command wrapper that treats descendant cleanup as a verified postcondition rather than assuming the direct child's exit ends a run. Its stronger mode uses a delegated cgroup v2 and cgroup.kill; its fallback combines child-subreaping, /proc discovery, and pidfds. This closes a reliability boundary around daemonized and pipe-holding descendants, but it is explicitly not a sandbox and cannot contain work transferred to services such as systemd."
triggers: ["Corral", "agent process cleanup", "descendant process", "cgroup.kill", "child subreaper", "pidfd", "background process", "command runner", "verified termination"]
last_updated: "2026-09-29"
source_basis: "HN item 49886422; Cardinal44/corral README, repository metadata, selected implementation and integration-test sources, benchmark artifacts, release metadata, and public CI status inspected at revision 160a20c70e1ce65bc96a7690961fa242849fc40b. Scout did not build or execute the project."
</ai_context>

# Corral makes process-tree cleanup a verified runner postcondition

**Date:** 2026-09-29  
**HN:** https://news.ycombinator.com/item?id=49886422  
**Repo:** https://github.com/Cardinal44/corral  
**Reviewed revision:** https://github.com/Cardinal44/corral/commit/160a20c70e1ce65bc96a7690961fa242849fc40b

## Signal

Agent command runners commonly supervise the process they launched, but the
operational resource is the **whole descendant computation**. A command can
fork into another session, leave a background process holding an output pipe,
or ignore `SIGTERM`. Waiting for pipe EOF can then hang the runner, while
returning on the direct child's exit can leave ports, locks, CPU use, and future
run interference behind.

Corral makes a narrower and testable contract: when the wrapper returns, no
process it can still attribute to the run remains alive. If final verification
cannot establish that condition, it exits with code 120 rather than presenting
cleanup as successful. Its supervisor also stops waiting when the main child
exits instead of waiting for descendants to close inherited output pipes; the
cleanup phase then handles those descendants.

This is complementary to the library's [GitSpawn finding](./2026-09-10-gitspawn-descendant-process-boundary.md). GitSpawn shows that policy must follow
trusted-tool descendants because they can perform effects. Corral addresses a
different lifecycle edge: after a command finishes or times out, the runner must
prove that descendants are gone before releasing the execution slot.

## Two containment strengths

Corral exposes two modes whose guarantees should not be conflated:

- **Enforced mode:** the command runs in its own delegated cgroup v2. Membership
  survives forks, reparenting, and session changes; `cgroup.kill` terminates the
  group. Final checks require the cgroup to report empty and be removable. This
  mode can also apply memory and PID limits when those controllers are enabled.
- **Fallback mode:** Corral becomes a child subreaper, scans `/proc` for its
  children and processes retaining the run's process group or session, and uses
  pidfds plus a second membership check before signalling non-children. This
  avoids signalling a recycled PID, but it is inherently a weaker attribution
  method than cgroup membership.

The distinction is visible in the audit record: mode and mode reason, requested
and actually enforced limits, exit reason, termination timings, orphan counts,
survivors, cgroup path, and kernel are separate fields. A configured limit is
therefore not silently reported as enforced when its cgroup controller is
missing.

## Evidence and limits

The repository includes ten adversarial fixture programs covering continuous
output, stdin waits, background jobs, double-forked daemons, daemonized parents,
ignored `SIGTERM`, fork floods, inherited output pipes, memory pressure, and
graceful termination. Project-published results report zero surviving processes
for both Corral modes across that corpus. By contrast, the compared `timeout`
and direct-child Python runners left descendants or hung in several cases.
Integration tests explicitly search for tagged survivors after each run and
require the JSON audit record to report no survivors; a public CI run succeeded
for the reviewed revision across GCC/Clang and Debug/Release builds.

These are project-authored tests and benchmark artifacts, not an independent
reproduction. The repository was created on 2026-09-28 and had two stars, no
forks, and no open issues when inspected, so this is an early implementation
signal rather than adoption evidence.

Most importantly, Corral is **not a security sandbox**. It does not restrict
filesystem, network, or privilege access. The README names paths outside its
cleanup model: work handed to `systemd-run`, D-Bus, `at`, or another service is
not in the process tree; fallback mode cannot signal a setuid child; a process
with cgroupfs authority may leave the enforced group; and `SIGKILL` against
Corral itself bypasses its orderly cleanup guarantee. The prebuilt-install
example also targets a mutable `latest` release URL, although the release
publishes a separate checksum asset; production bootstrap should pin and verify
an immutable release artifact.

## Reusable implication

A robust agent execution API should separate three claims:

1. **The root command ended.** This says nothing about descendants.
2. **Attributed descendants were terminated and absence was verified.** This is
   the Corral contract and should be a fail-closed, machine-readable postcondition.
3. **No effects escaped the run.** This requires a stronger sandbox or mediation
   boundary covering files, network, privileges, service managers, and other
   delegation channels.

Runner leases should not be released on claim 1 when later work assumes claim 2.
But claim 2 must not be promoted to claim 3: process cleanup improves lifecycle
reliability and resource hygiene; it does not establish effect containment.
