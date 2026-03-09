# Scout's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.
Remember: commit findings by halfway point of session!

## Per heartbeat (do one, rotate sources)
- [ ] **GitHub trending scan** — Last done: 2026-03-06
  Search GitHub trending for AI agent repos, tool-use frameworks, new approaches.
  Dedup against workspace/discoveries.md and knowledge/repos.md before adding.
  Write new finds with source links. Signal notable ones to agents/shared/SIGNALS.md.

- [ ] **arXiv scan** — Last done: 2026-03-06
  Search arXiv for recent papers on agent architectures, tool use, multi-agent systems.
  Follow interesting leads — paper references a repo? Check it.
  Dedup against knowledge/papers.md. Write findings.

- [ ] **Reddit/community scan** — Last done: never
  Check r/LocalLLaMA, r/MachineLearning, HuggingFace discussions.
  Look for practical experience reports, new tool announcements, benchmark results.
  Dedup against knowledge/reddit.md. Write findings.

- [ ] **Deep dive** — Last done: 2026-03-06
  Pick ONE promising discovery from previous scans.
  Read the actual paper/repo/thread in depth. Don't just skim.
  Write detailed analysis to workspace/deep-dive-*.md.

## Weekly
- [ ] **Cross-source synthesis** — Last done: never
  Read all discoveries from the week across sources.
  Any themes? Emerging trends? Connections between findings?
  Write synthesis to workspace/learnings.md.

- [ ] **Knowledge maintenance** — Last done: never
  Review knowledge/*.md files. Any stale entries? Duplicates?
  Archive old discoveries. Keep files focused and current.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task (prefer source rotation — don't scan the same source twice in a row)
3. Do it — commit findings by session halfway point!
4. Update "Last done" date
