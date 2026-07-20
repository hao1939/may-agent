# Handler Boundary Audit

**Status:** Historical completed audit.
**Current authority:** [Handler authoring](../../2b-manual/handler-authoring.md)
and [System operations tracker](../../3-proposals/system-operations-model.md).

The Agent App migration established this rule:

> A handler is a small infrastructure adapter. It may translate, observe,
> persist, or dispatch bounded work. It does not own project strategy, learned
> process, task scheduling, or task state.

The migration removed global project, project-steward,
project-creative-audit, closed-loop-steward, eval-llm-scan, Markdown task
assignment/review, and app-root project workflow paths. Project-specific
schedules, event correlation, actions, watchers, and task reconciliation moved
to sibling Agent Apps.

The retained global handlers were metric alert routing, session recovery,
escalation delivery, metric snapshots, coaching signal consumption, and
feedback projection. The last two remain explicit convergence decisions in the
active system-operations tracker.

Stable authoring and review checks were merged into the handler-authoring
manual. This record remains only as migration evidence.
