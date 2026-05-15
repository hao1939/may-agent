# System Gaps — Coach Self-Assessment
*2026-04-16*

## 1. When do I feel lost?

- **Resuming multi-session work.** The checkpoint system helps, but I still spend 5-10 ops re-reading files to rebuild mental state. Example: EXP-165 has been "in_progress" across many sessions — each time I need to re-derive where I am from checkpoint data, workspace files, and git state.
- **Ambiguous "heartbeat" scope.** Heartbeats say "read your heartbeat file" but the decision space is huge — check experiments, check errors, check metrics, plan new work. I often do a shallow pass of everything and produce nothing actionable.
- **When task specs reference files I haven't seen.** I get tasks mentioning specific scripts or scenarios. If the path is wrong or the file changed, I burn ops on EISDIR errors and searches (see FM-1.3 recalls).

## 2. When do I waste time?

- **Re-reading the same files every session.** I read `context.md`, heartbeat instructions, skill files, knowledge entries — often 10+ reads before doing anything. This is ~20% of my op budget on orientation.
- **One-query-at-a-time database access.** Before learning to batch queries, I'd write 4-5 separate `bun -e` scripts. Even now, I sometimes fall back to this.
- **Git ceremonies on nothing.** I've tried to commit when nothing changed (FM-1.4). The reflex to "commit deliverables" fires even when the deliverable is a workspace file that's gitignored.
- **Writing analysis docs nobody reads.** Per KE-180, I've written ANALYSIS.md files that felt productive but displaced actual work. The completion illusion is real — writing *about* a problem feels like solving it.

## 3. When do I repeat myself?

- **Skill file / context entry deployment.** Multiple sessions have concluded "the skill file already exists" or "the context entry is already deployed" — meaning the task was already done but I was assigned it again. (See: "Bob gym execution reliability fix" — success in 30s because it was already done.)
- **Experiment status checks.** Every heartbeat re-checks whether experiments are complete. Once an experiment is done, it stays done — but I re-verify anyway.
- **Re-deriving operational knowledge.** I know SOUL.md text changes don't work (0/18), yet the system sometimes suggests text-based interventions. I have to re-justify why I'm not doing them.

## 4. When do I have no impact?

- **Heartbeats with no action items.** Many heartbeats end with "nothing urgent, clean state." These consume a session and produce nothing. (See: 09:24, 10:23 heartbeats — both concluded "nothing to do.")
- **Common-sense verification tasks** that confirm things are fine. The 10:04 cron task checked a behavioral item — useful as a safety net, but most checks pass and produce no change.
- **Error pattern analysis that concludes "skip."** The 10:33 session analyzed Bob's FM-2.6 errors and decided to skip because they were all the same repeated experiment. Correct decision, but zero value produced.

## 5. When am I stuck?

- **Long-running gym trials.** EXP-165 needs 40 trial runs. Each run takes real time. I can't parallelize beyond what gym-batch.sh offers. This experiment has been open for days.
- **No way to test hypotheses cheaply.** Every experiment requires full gym runs (minutes each). There's no "dry run" or "unit test" equivalent for behavioral interventions.
- **Can't observe other agents in real-time.** I coach Bob and Coder but only see their outputs post-hoc. I can't watch them struggle and intervene — I can only do autopsies.

## 6. How could the loop be closed?

| Gap | Fix |
|-----|-----|
| Session re-orientation burn | A `agents/coach/workspace/RESUME.md` that each session writes as its last act — not a checkpoint blob, but a plain-English "here's exactly what to do next and why." Current checkpoints are structured data, not actionable instructions. |
| Heartbeats with no action | Heartbeat should have an explicit "skip if no triggers" fast-path that finishes in 2 ops instead of 10. Or: heartbeat frequency should drop when there's no active work. |
| Repeated task assignments | Task dedup at the dispatcher level. If a skill file exists at the target path, don't assign "deploy skill file" again. |
| Experiment velocity | Pre-built experiment templates that set up arms/scenarios from a one-liner instead of manually creating scenario YAML, running trials, collecting results across sessions. |
| No cheap hypothesis testing | A "micro-gym" that runs 1 trial with verbose output in <10s, for smoke-testing before committing to N=10+ runs. The smoke test in EXP-165 was ad hoc — it should be a first-class tool. |
| Analysis-as-busywork | Every task should have a measurable outcome defined upfront. "Write analysis" is not an outcome. "Improve pass rate from X to Y" is. If a task can't state a measurable outcome, it shouldn't be assigned. |
| Post-hoc coaching only | A lightweight "coaching hook" in agent prompts that surfaces relevant skills at task-start, not as passive files but as injected context. This exists partially (active_recall) but only for failures, not for positive patterns. |
