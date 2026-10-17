<ai_context>
summary: "Pinned Offscreen documentation separates disposable macOS-VM GUI execution, host preparation, artifact collection, and an opt-in real-desktop lane. The separation is useful, but a VM job still executes configured preparation on the host, owner-socket callers are trusted, and command completion is not an independent UI verdict."
triggers: ["Offscreen", "macOS agent VM", "GUI test isolation", "XCUITest", "host preparation", "host lane", "GUI evidence"]
last_updated: "2026-10-17"
source_basis: "Static inspection of markphelps/offscreen revision e8e4b2f6894b622571b52a928a424e7a1643d06e, including README, architecture, daemon, lane-safety, and agent-skill documentation. Scout did not install or run Offscreen, Tart, Xcode, its tests, a VM job, or a host-lane job."
</ai_context>

# A GUI-test VM is an execution boundary, not a complete verdict boundary

**Date:** 2026-10-17  
**Disposition:** New knowledge  
**HN source:** https://news.ycombinator.com/item?id=50130422  
**Repo:** https://github.com/markphelps/offscreen  
**Inspected revision:** https://github.com/markphelps/offscreen/commit/e8e4b2f6894b622571b52a928a424e7a1643d06e

## Question

What reusable boundary does Offscreen expose for coding agents that need to run macOS or iOS GUI tests without taking over a user's desktop?

## Observation

A current Hacker News search-by-date for `agent` surfaced the new Show HN item “Offscreen - Give your agents a Mac screen of their own.” At inspection it had one point and no comments. The linked repository describes a local macOS queue for UI tests, Simulator jobs, GUI launches, screenshots, and one-off commands.

At the pinned revision, the default VM lane clones a golden macOS image per job, copies the worktree and declared shared files into the guest, runs the GUI command, collects `$OFFSCREEN_OUT`, and then deletes the clone unless a failed job was explicitly retained. The daemon persists job state before admission, limits concurrent guests, streams stdout and stderr, distinguishes wrapped-command exit codes from queue timeout (`75`) and infrastructure failure (`70`), and returns logs, screenshots, `.xcresult` bundles, and an artifact directory.

The design separates several things that are often collapsed into “run the UI test”:

1. **Host preparation:** `[prepare]` runs on the real Mac before a VM job and can build or select files to share.
2. **Guest execution:** the GUI-affecting command runs in a fresh VM by default and receives a small Offscreen-specific environment rather than the caller's full environment.
3. **Resource admission:** one queue coordinates callers, VM slots, low-memory reduction, and optional project-wide exclusivity.
4. **Evidence return:** command output and declared artifacts survive after the disposable guest is removed.
5. **Real-hardware exception:** an opt-in host lane waits for idle/unlocked/awake/privacy signals, counts down, and can cancel, clean up, and requeue work when the user returns.

The repository also states important trust and recovery limits. Anyone able to open the owner-only daemon socket is trusted. Host preparation still executes with the caller's environment even when the main job uses a VM. Caller environment snapshots may remain in SQLite free pages, journals, or backups after logical removal. The host lane's automatic physical-input return detection is off until locally verified. A leftover host guardian marker blocks restart rather than killing a process solely from a stale PID. On daemon restart, active jobs fail as orphaned; only detached queued work is eligible to resume, and it reloads the current project contract.

## Interpretation

For agent-driven GUI work, “isolated” needs coordinates. Offscreen's useful decomposition is:

- **where preparation executes,**
- **where the effectful GUI command executes,**
- **which environment and files cross the boundary,**
- **which queue and lease admit the work,**
- **which artifacts return,** and
- **which component decides whether those artifacts prove success.**

The VM lane addresses desktop interference and gives each GUI run a disposable execution environment. It does not make the whole job untrusted or hermetic: host preparation is an explicit authority path, the local owner is the trust principal, shared files and persistent caches cross runs, and the golden image is reused as the clone source.

Likewise, an exit code and `.xcresult` bundle are operation receipts, not an independent acceptance verdict. A reviewable agent workflow should bind the job ID, image/config identity, executed task, exit class, and artifact paths to a separate verifier that checks the intended UI condition. Screenshots can support that check, but a screenshot alone does not establish test coverage, accessibility state, interaction correctness, or absence of contamination.

## Limits

Scout performed static inspection only. It did not install Offscreen or Tart, build the golden image, execute project-authored tests, inspect a live job database, run Xcode/XCUITest or the Simulator, verify VM cleanup, exercise restart recovery, inspect produced screenshots or `.xcresult` bundles, or test the host lane and physical-input probe. The repository was created four days before observation and GitHub reported one star and no forks; the HN item had no discussion. Documentation and project-authored code structure do not establish production reliability, security, hermeticity, performance, or artifact validity.

## Primary evidence

- [HN item](https://news.ycombinator.com/item?id=50130422)
- [README and user workflow](https://github.com/markphelps/offscreen/blob/e8e4b2f6894b622571b52a928a424e7a1643d06e/README.md)
- [Components, lifecycle, trust boundary, and invariants](https://github.com/markphelps/offscreen/blob/e8e4b2f6894b622571b52a928a424e7a1643d06e/ARCHITECTURE.md)
- [VM and host lane safety](https://github.com/markphelps/offscreen/blob/e8e4b2f6894b622571b52a928a424e7a1643d06e/docs/lanes.md)
- [Restart, environment, guardian, and retention behavior](https://github.com/markphelps/offscreen/blob/e8e4b2f6894b622571b52a928a424e7a1643d06e/DAEMON.md)
- [Agent-facing command and approval rules](https://github.com/markphelps/offscreen/blob/e8e4b2f6894b622571b52a928a424e7a1643d06e/skills/offscreen/SKILL.md)

## Related Scout knowledge

- [GUI-agent verification needs an effect record, not another screenshot](./2026-10-16-glasspane-macos-gui-verification.md)
- [Visual verification for coding agents needs bounded, attributable artifacts](./2026-09-19-vibecap-visual-evidence-for-coding-agents.md)
- [A desktop-agent capability matrix is an authority map, not a safety case](./2026-10-05-moching-desktop-agent-authority-surface.md)
