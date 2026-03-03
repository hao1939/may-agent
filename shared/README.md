# Shared Knowledge

Common knowledge files loaded into agents that need system-level context (May, evaluator, optimizer).

## Documents

- **system-design.md** — Conceptual architecture: what agents are, how they collaborate, design principles (no silent failures, run first then design, role-based evaluation), the optimization loop, fix hierarchy, session lifecycle.

- **team.md** — Concrete team roster: which agents exist, their models/tools/turn limits, model assignment strategy, available workflows, automation (post-task eval, idle optimizer, hot-reload, compaction, turn warnings), structural constraints.

## Who Gets These

| Agent | system-design.md | team.md |
|-------|:-:|:-:|
| May | ✓ | ✓ |
| Evaluator | ✓ | ✓ |
| Optimizer | ✓ | ✓ |
| Coder | — | — |
| QA | — | — |

Coder and QA don't need system-level context — they receive specific tasks and work independently.
