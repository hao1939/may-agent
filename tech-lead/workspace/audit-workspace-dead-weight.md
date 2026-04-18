# Workspace Dead Weight Audit — 2026-04-13

**Lens C audit** of `agents/tech-lead/workspace/` directory.

## Summary

- **Total items**: 72 (67 files + 3 subdirs + `todo.md` + `heartbeat-context.md`)
- **Markdown/script files**: 67
- **Safe to archive**: 46 files (~590KB)
- **Keep (open action items or active reference)**: 15 files
- **Infrastructure (keep in place)**: 6 files
- **Recommended reduction**: 46/67 files → 69% of documents can move to `archive/2026-04/`

---

## Files SAFE TO ARCHIVE

These files' findings have been fully acted on (fix merged), superseded by later audits, or are one-shot analyses with no remaining action items.

### Fix/cleanup files (changes merged)
| File | Reason to archive |
|------|------------------|
| `fix-ghost-session-fragility.md` | Fix merged (review/s_1775958848156_1768, todo line 190) |
| `fix-db-path-references.md` | Fix for DB path references, merged |
| `fix-active-sessions-archival.md` | Archival re-wire delegated (s_1776002064403_2159), doc is just notes |
| `cleanup-evaluation-dead-weight.md` | -2,373 lines merged (review/s_1775971448515_1880, todo line 195) |
| `cleanup-workflow-dead-weight.md` | Workflow cleanup complete (todo line 171) |
| `cleanup-test-dead-weight.md` | Test dead weight cleanup complete (todo line 218) |
| `cleanup-research-db-dead-code.md` | Research DB dead code cleanup complete |
| `workflow-cleanup-results.md` | Results of workflow cleanup — acted on |

### Audit files (findings fully acted on or informational-only, no open items)
| File | Reason to archive |
|------|------------------|
| `audit-cron-architecture.md` | Lens A complete (todo line 165), duplicate handler disabled |
| `audit-auto-pause-consolidation.md` | Auto-pause handler deleted (523 lines, todo line 166) |
| `audit-may-handlers.md` | 27 handlers, perfect 1:1 mapping, clean state (todo line 167) |
| `audit-handler-context.md` | HandlerContext audit complete (todo line 169) |
| `audit-workflow-execution-path.md` | Informational audit, no fix needed (todo line 170) |
| `audit-persistence-write-path.md` | Superseded by proposal-status-consolidation.md |
| `audit-session-subscribers.md` | Audit complete (todo line 175), informational |
| `audit-persistence-failure-cascade.md` | P0 fix merged (commit 3230b31, todo line 182) |
| `audit-completion-pipeline.md` | Findings acted on via meta.json try-catch fix |
| `audit-event-bus-coupling.md` | Informational audit complete (todo line 178) |
| `audit-digest-dead-weight.md` | ~43 lines removable identified, informational (todo line 179) |
| `audit-startup-failure-modes.md` | Ghost session fix merged (todo line 190) |
| `audit-context-injection-pipeline.md` | Well-factored, only 6 lines dead weight (todo line 183) |
| `audit-cron-handler-registration-flow.md` | handlerResolver fix applied (todo line 188) |
| `audit-evaluation-architecture.md` | Superseded by cleanup-evaluation-dead-weight (Paths 2-3 deleted) |
| `audit-evaluation-flow-complexity.md` | Acted on: evaluation cleanup merged (todo line 195) |
| `audit-evaluation-sync-outage.md` | Root cause identified, process restarted (todo line 191) |
| `audit-handler-resolution-architecture.md` | Informational, 5 consolidation opportunities ranked (todo line 193) |
| `audit-cron-blast-radius.md` | Informational audit, no open action items |
| `audit-manager-architecture.md` | Informational architecture review |
| `audit-web-architecture.md` | Informational, web.ts healthy (todo line 211) |
| `audit-web-frontend-complexity.md` | Informational frontend analysis |
| `audit-implement-verify-reliability.md` | Informational reliability audit |
| `audit-config-resolution-path.md` | Informational config path analysis |
| `audit-request-tracking-db.md` | Informational DB schema review |
| `audit-requests-architecture.md` | Informational architecture review |
| `audit-token-budget-management.md` | Superseded by tiered turn budget (merged, todo line 243) |
| `audit-tool-dispatch-path.md` | Informational dispatch path analysis |
| `audit-tools-dead-code.md` | Acted on: 3 dead files deleted, -714 lines merged (todo line 240) |
| `audit-classify-error-architecture.md` | Architecture sound, no action needed (todo line 242) |
| `audit-session-close-flow.md` | Informational flow trace, meta.json fix confirmed merged (todo line 244) |
| `audit-checkpoint-data-flow.md` | Informational data flow analysis |
| `audit-digest-error-handling.md` | Informational error handling review |

### Analysis/proposal files (one-shot, acted on or informational)
| File | Reason to archive |
|------|------------------|
| `analysis-session-startup-flow.md` | Superseded by audit-startup-failure-modes.md + ghost fix |
| `analysis-cron-overlap.md` | Zero bugs found, informational only (todo line 185) |
| `analysis-coach-ops.md` | One-shot analysis, no open items |
| `analysis-federation-usage.md` | One-shot analysis, no open items |
| `analysis-coder-104ops.md` | One-shot incident analysis |
| `analysis-autocommit-fragility.md` | One-shot fragility analysis |
| `verify-wrap-assessment.md` | Scout NOT viable, no action (todo line 163) |
| `review-fewshot-proposal.md` | Fewshot proposal reviewed |
| `review-branch-sprint-results.md` | Sprint results snapshot |
| `lens-b-fork-flow-analysis.md` | Informational fork flow analysis |
| `exp132-binary-rebuild.md` | Binary rebuild notes, guard merged |
| `exp-050-runner.sh` | Experiment complete (todo line 141) |
| `exp-050-treatment.sh` | Experiment complete (todo line 141) |

---

## Files to KEEP (open action items or active reference)

| File | Why keep |
|------|----------|
| `todo.md` | Active work tracker — essential |
| `heartbeat-context.md` | Active heartbeat state — essential |
| `proposal-status-consolidation.md` | Phase 1 merged but Phases 2-5 still open (consolidate triple-redundant writes) |
| `audit-active-sessions-dead-weight.md` | archiveSession() still disconnected, 2,765+ stale sessions growing (todo line 244) |
| `audit-knowledge-dead-weight.md` | Remaining TODOs: consolidate 51 findings, 182 insights-archive, mark 8 abandoned experiments |
| `audit-knowledge-library-dead-weight.md` | Recent (Apr 13), library archival still pending |
| `audit-shared-dead-weight.md` | Recent (Apr 12), shared/ cleanup may have open items |
| `audit-digest-architecture.md` | Open recommendation: unify 3 classification entry points, split session-digest.ts |
| `audit-digest-still-open-fragility.md` | Recent (Apr 13), likely has open fragility findings |
| `knowledge-system-audit.md` | Recent (Apr 13), knowledge system findings may be open |
| `analysis-workflow-autoloop.md` | Workflow autoloop design may still be referenced |
| `pending-decisions.md` | Active decisions tracker |
| `implementation-plan.md` | May still be referenced for roadmap |
| `nudge-active.md` | Active nudge configuration |
| `activity.jsonl` | Append-only activity log — keep |

---

## Directories

| Dir | Status |
|-----|--------|
| `archive/` | Keep — contains prior archived files |
| `exercises/` | Keep — exercise materials |
| `proposals/` | Keep — may contain active proposals |

---

## Recommended Action

1. **Move 46 files to `archive/2026-04/`** — saves ~590KB of workspace noise
2. **Net result**: workspace drops from 67 docs to 15 active docs + 6 infrastructure files
3. **Reduction**: 69% of documents archived

This is a documentation-only audit. Actual archival should be done in a follow-up Lens C cleanup session with a simple `mv` batch.
