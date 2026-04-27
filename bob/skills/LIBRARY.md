# Bob Skills Library

Consult this index to find relevant skills for your current task. **Read only the skills you need** — don't load all of them.

## Skills Index

| Skill | File | When to use |
|-------|------|-------------|
| **Evidence Over Narrative** | `evidence-over-narrative.md` | When writing experiment results, analyses, or any claim that needs backing data |
| **Cross-Reference Source Code** | `cross-reference-source-code.md` | When investigating how agents/infrastructure actually works vs. what docs say |
| **Knowledge Base Navigation** | `knowledge-base-navigation.md` | When searching, citing, or creating knowledge entries (KEs) |
| **Read Before Edit** | `read-before-edit.md` | Before modifying any file — read it first to avoid clobbering |
| **⚡ State-Check-Before-Action (SCBA)** | `../../shared/skills/state-check-before-action/SKILL.md` | Before ANY state-mutating operation (edit/write/destructive bash) — comprehensive verification protocol covering path checks, content verification, and re-verification after edit chains. **Read this for C1.1 compliance.** |
| **Verify After Edit** | `verify-after-edit.md` | After modifying a file — confirm the change took effect |
| **Verify Before Finish** | `verify-before-finish.md` | Before calling finish() — check all deliverables exist |
| **Read-Only Finish Protocol** | `read-only-finish-protocol.md` | When your task is read-only/analysis — don't fabricate deliverables |
| **Gym Execution Checklist** | `gym-execution-checklist.md` | When running gym scenarios or experiments with gym infrastructure |
| **Second-Look Verification** | `second-look-verification.md` | Before finish() on implementation tasks — 4-question checklist for activation gaps (EXP-229) |
| **Persistent Task Workflow** | `persistent-task-workflow.md` | When working on multi-session tasks that need state across sessions |

## Task → Skill Mapping

- **Heartbeat/triage**: verify-before-finish
- **Experiment design**: evidence-over-narrative, knowledge-base-navigation
- **Experiment execution (gym)**: gym-execution-checklist, verify-after-edit
- **Code investigation**: cross-reference-source-code, read-before-edit, state-check-before-action
- **Analysis/writeup**: evidence-over-narrative, read-only-finish-protocol
- **Knowledge work**: knowledge-base-navigation, persistent-task-workflow
