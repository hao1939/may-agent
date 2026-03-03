# Agent Team

Concrete details about who's on the team, what they have, and how the automation works.

## Feature Team

| Agent | Model | Tools | Turn Limit | Notes |
|-------|-------|-------|------------|-------|
| **May** | opus | exec (read-only), subagents, workflow | — | Persistent session. No read/write tools — forces delegation for all code changes. Can read files and run shell commands for verification (cat, grep, tsc, tests, git) but cannot write files via exec. |
| **Coder** | opus | read, write, exec | 50 | Full project access. Implements code changes. Does not commit — May handles git add/commit after QA review. |
| **QA** | gpt-5.2 | read, write, exec | 30 | Different model from coder for perspective diversity. Can fix issues directly. Uses PASS/FAIL/CONDITIONAL verdicts. |

## Meta Team

| Agent | Model | Tools | Turn Limit | Notes |
|-------|-------|-------|------------|-------|
| **Evaluator** | gpt-5.2 | read, write, exec | 20 | Scores each agent in a task tree by responsibility. Transcripts are provided in the prompt, so tools aren't needed for evaluation. Also used for maintenance tasks (lessons pruning) which do need tools. memoryLimit=5 (vs default 20). |
| **Optimizer** | opus | read, write, exec, subagents, workflow | 40 | Can delegate to coder and QA via subagents tool and workflows. Implements one fix per run. Has access to evaluation data and session transcripts. |

## Model Assignment

Implementation agents (May, coder, optimizer) use opus. Review agents (QA, evaluator)
use gpt-5.2. Both are proxy-aliased labels routed through a local proxy — check
`run/may.ts` for the actual model configuration. Different model families provide
genuine perspective diversity — a reviewer using the same model as the implementer
tends to agree with the implementation's reasoning rather than challenging it.

## Workflows

**implement-and-review** — Both May and optimizer have this workflow. Sequence:
coder implements → QA reviews → if FAIL/CONDITIONAL, one retry → if still failing,
escalates back to the caller. Critical rejections (wrong task, policy violation)
escalate immediately without retry. QA verdicts drive the retry logic mechanically.

**design-review** — Optimizer only. Reviews shared knowledge docs against reality.
Evaluator and optimizer independently review, then cross-respond to each other's
findings. Returns structured findings for the optimizer to act on.

## Automation

- **Post-task evaluation**: When May goes idle after completing a task, unevaluated
  child sessions are automatically sent to the evaluator for scoring.
- **Idle optimizer trigger**: After 5 minutes of idle time (with 30-minute cooldown),
  the optimizer is triggered via May to analyze recent evaluations and implement
  improvements.
- **Knowledge hot-reload**: All agent knowledge (domain.md, lessons.md) is read fresh
  at session start. Optimizer changes take effect on the next agent session.
- **Context compaction**: When May's persistent session grows beyond 70% of context
  capacity, older messages are summarized to free space.
- **Turn budget warnings**: Agents receive a warning when they reach 80% of their
  turn limit, giving them a chance to wrap up.

## Constraints

- **May cannot write files** — enforced structurally via read-only exec (sed -i, cat >,
  heredocs, tee all blocked). May can read file contents via shell commands (cat, grep,
  git diff, rg) but cannot modify them. This forces delegation for all code changes.
- **Coder never commits** — May handles git add/commit after QA review. This ensures
  May can verify changes before they're committed.
- **QA is advisory in the slow path** — May decides whether to act on feedback.
  In workflows, QA verdicts drive retries mechanically.
- **Evaluator has tools for maintenance** — During evaluation, transcripts are
  provided in the prompt, so tools are unnecessary. Tools exist for maintenance
  tasks (lessons pruning) where file I/O is needed.
- **One fix per optimizer run** — Isolates changes so evaluation can measure
  which fix helped or hurt.
