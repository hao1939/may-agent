# Agent Read Patterns Analysis — 2026-05-01

**Source**: file_reads table (1,958 total reads, 10 agents)  
**Research item**: IT-77 (Hao directive: "what really read by agents in each turn?")

## Key Findings

### 1. Pathological Re-reads (Waste Signal)
| Agent | File | Reads | Issue |
|-------|------|-------|-------|
| optimizer | DELIVERABLES_CHECKLIST.md | 72x | Loop/checklist obsession |
| scout | INDEX.md (deep-dives) | 39x | Repeated index scanning |
| tech-lead | cron.ts | 29x | Infra file re-reads across sessions |
| qa | src/app/cron.ts | 25x | Same file, different path |
| coach | test/gym/gym-runner.ts | 25x | Experiment setup re-reads |
| amy | last-session.md | 16x | Session context re-loading |

**Implication**: Agents re-read the same files across sessions because they can't retain knowledge between sessions. This is the "context learning gap" Hao identified. The read-dedup guard prevents within-session loops but not cross-session repetition.

### 2. Cross-Agent Information Flow
| Reader → Producer | Reads | Pattern |
|-------------------|-------|---------|
| bob → shared | 329 | Knowledge base consumer (dominant) |
| tech-lead → may | 141 | Reading may's project/handler files |
| scout → shared | 90 | Knowledge base scanner |
| coach → shared | 56 | Knowledge/experiment files |
| coach → gym | 42 | Scenario files for experiments |
| tech-lead → optimizer | 33 | Workflow-first project |

**Insight**: Bob is the dominant knowledge consumer (329 reads of shared/). Tech-lead reads may's files heavily (141), suggesting may's project specs drive tech-lead work. Coach→gym flow confirms experiment-centric work pattern.

### 3. Agent Behavioral Signatures (from read patterns)
- **bob**: Research-focused — reads hypotheses, knowledge entries, experiment designs. H-166 (15x) and PRIORITY-TRACKER (12x) are constant references.
- **tech-lead**: Infrastructure-focused — reads cron.ts, agent-loader.ts, manager.ts, evaluator.ts repeatedly. Heavy may handler reads.
- **qa**: Review-focused — reads source files (manager.ts 19x, pipeline.js 12x) and test files. Also reads unreviewed-findings.md 14x.
- **optimizer**: Process-focused — DELIVERABLES_CHECKLIST.md 72x is a red flag for checklist-driven behavior displacing actual work.
- **scout**: Index-focused — reads INDEX.md 39x and INBOX.md 9x. Catalog maintenance pattern.
- **coach**: Experiment-focused — gym-runner.ts 25x, EXP-188 design 20x. But also convention-check.ts 14x (convention regression investigation).
- **may**: Meta-focused — reads file-read-tracker.ts 10x, metrics-snapshot.ts 9x, heartbeat-context.ts 7x. Self-monitoring pattern.

### 4. Unread Deliverables
No unread deliverables found in recent data — suggesting the file_deliverables table is under-populated rather than files going unread.

## Recommendations

1. **Optimizer's 72x DELIVERABLES_CHECKLIST.md** — investigate whether this is a process-obsession failure mode. May indicate the agent is checking off boxes rather than doing substantive work.
2. **Cross-session caching** — the most-read files (common-sense.md, PRIORITY-TRACKER, INDEX.md) could be pre-injected into context to reduce wasted reads.
3. **Bob's knowledge consumption is healthy** — 329 cross-reads of shared knowledge, 235 unique files. This is the desired behavior for the research agent.
4. **tech-lead's may-handler reads (141)** — high coupling between tech-lead and may's codebase. Expected given tech-lead maintains the infrastructure.

## Status
Research item IT-77 partially addressed. This is a snapshot analysis; a longitudinal study tracking read patterns over time would show trends.
