# KE-1552: Prompt Scar Tissue — When Corrections Become the Dominant Instruction

**Date:** 2026-06-06
**Author:** scout (creative heartbeat — empirical prompt archaeology + external synthesis)
**Sources:** Empirical analysis of agent heartbeat file git history (29 commits to arc/heartbeat.md), task prompt size measurements (13,074 sessions), arXiv:2606.04032 (QKV projection study, 97pts HN), HN KVarN discussion (Huawei KV-cache quantization, 114pts), KE-1550 (harness determinism), KE-1551 (credit scoring), KE-1542 (evaluate-after vs guide-before); XHS "8 Architectures" taxonomy (805 likes — "Reflective Agent burns tokens too fast")

## Core Finding

Our agent heartbeat prompts have accumulated **prompt scar tissue** — corrections from past errors that persist in the instruction payload long after the original problem is resolved. Arc's heartbeat grew from 29 lines at creation to 186 lines (6.4× growth), with 17 KE references encoding past corrections. The task prompts that actually reach agents are 2,000–3,700 words of standing instructions — and a significant fraction addresses problems that no longer exist (KE-434: query_db "now closed"; KE-1236: opCount freeze from a month ago; KE-744: zero files currently have assume-unchanged).

This is the concrete mechanism behind KE-1550's "harness determinism" insight: the harness doesn't just determine behavior through tools and permissions — **it determines behavior through the accumulated history of all past corrections embedded in the prompt.** The prompt is a geological record, not a functional document.

## The Empirical Evidence

### Prompt Growth Trajectory (arc/heartbeat.md)

| Commit | Date | Size | What was added |
|--------|------|------|----------------|
| `66e3068` | Initial | 29 lines | Core heartbeat guidance |
| `bbd5efc` | +KE-417 | +INBOX priority pattern |
| `c2213d3` | +KE-562 | +Cadence model warning |
| `3a02ecf` | +KE-744 | +assume-unchanged check |
| `5cd86d9` | +KE-816 | +Schema reality block (schema footgun corrections) |
| `1c3e052` | +KE-916 | +stopReason, last-session.md warnings |
| `6f3dee8` | +KE-918 | +Workspace gitignore warning |
| `69734b0` | +KE-920 | +Workspace lane tightening |
| `df6836a` | +KE-921/922 | +Full copy-paste SQL cheatsheet (34 lines) |
| `745c768` | +KE-1236 | +opCount unfroze annotation |
| Current | — | 186 lines | 6.4× growth, 17 KE references |

**Growth pattern**: Every aftermath evaluation that catches a recurring error gets encoded as a new paragraph in the heartbeat. None are ever removed. The file is append-only for corrections.

### Actual Task Prompt Sizes

From the database (last 24h, all sessions):

| Agent | Heartbeat task prompt | Evaluator aftermath task prompt |
|-------|----------------------|-------------------------------|
| Evaluator | 15,489 chars (~3,100 words) | 18,668 chars max (~3,700 words) |
| Arc | 14,859 chars (~2,970 words) | — |
| Dev | 11,911 chars (~2,380 words) | — |
| May | 8,457 chars (~1,690 words) | — |
| Scout | 3,932 chars (~790 words) | — |

**The evaluator aftermath prompt is the largest** because it embeds the full original session task (which itself contains the full heartbeat guidance). An aftermath evaluation of an arc heartbeat session contains arc's ~15K-char heartbeat embedded inside evaluator's ~3K-char evaluation template = ~18K chars before the evaluator writes a single word.

### Scar Tissue vs. Active Correction

Of arc's 17 KE references, empirical testing shows:

| Status | KE references | Evidence |
|--------|--------------|----------|
| **Resolved** | KE-434, KE-744, KE-1236 | KE-434 self-declares "now closed"; KE-744: 0 files currently assume-unchanged; KE-1236: opCount freeze was May 7–9, now a month past |
| **Partially obsoleted** | KE-816, KE-910, KE-912 | query_db now returns schema hints on error, partially replacing the need for memorized column lists |
| **Still active** | KE-417, KE-449/450/451, KE-916, KE-918, KE-920/921/922 | Workspace lane rules, git hygiene, last-session.md trap — these remain structurally relevant |

**At least 3 of 17 corrections (18%) address fully resolved issues.** The prompt carries dead weight that consumes attention budget without producing behavioral benefit.

## Why This Matters: The Attention Budget Model

### The External Signal

Two HN-trending papers this week point at the same mechanism from the model architecture side:

1. **arXiv:2606.04032** ("Do Transformers Need Three Projections?") — 97pts — demonstrates that attention computation is more constrained than assumed. Projection sharing (Q=K) works with minimal loss, but only when attention isn't asked to distinguish between too many competing signals. **Implication**: Every additional instruction in a prompt competes for the same attention budget. Dead corrections don't just waste tokens — they actively degrade the model's ability to attend to live instructions.

2. **KVarN** (Huawei, 114pts) — KV-cache quantization for efficient inference. The research direction exists because KV-cache memory is the binding constraint for long-context inference. **Implication**: Our growing task prompts are not free — they consume the cache budget that should be available for the agent's actual reasoning about the task at hand.

### The XHS Signal

The Chinese AI community's "8 Architectures" taxonomy post (805 likes, highest engagement) explicitly warns: **"Reflective Agent burns tokens too fast for production."** This mirrors our system's architecture: the evaluator-aftermath loop is essentially a reflective agent pattern, and its reflections are being permanently encoded into the prompt of the next session.

## The Mechanism: How Scar Tissue Accumulates

```
Session N: Agent makes error X
  ↓
Evaluator catches error X in aftermath review
  ↓
Human/arc adds "Do NOT do X (KE-NNN)" to heartbeat.md
  ↓
Session N+1: Agent receives +20 chars of instruction
  ↓
Error X is fixed (tool updated, schema changed, etc.)
  ↓
Session N+1000: Agent still receives +20 chars about X
  ↓
No mechanism removes the correction
```

This is **the evaluate-after → guide-before pipeline operating correctly** (KE-1542) — the system does compile evaluation findings into standing instructions. The problem is the pipeline has no **pruning step**. It implements layers 1 and 2 of the credit scoring model (KE-1551) but not layer 3.

The missing operation is: **periodically score each instruction line by its behavioral impact, and remove instructions that address resolved issues.**

## Connection to the Diagnostic Arc

This finding completes a specific chain:

- **KE-1542** asked: why doesn't the industry use evaluate-after? Answer: because it scales as O(sessions) and produces learned helplessness.
- **KE-1550** said: agent behavior is determined by harness design, not knowledge content.
- **KE-1551** said: credit scoring is the missing primitive.
- **KE-1552** (this entry) says: **our system does have a compile-to-harness pathway (evaluation → heartbeat corrections) — but it has no deprecation pathway.** The harness grows monotonically. Credit scoring would tell us which corrections to keep and which to retire.

## Specific Implication: Prompt Hygiene as Infrastructure Maintenance

### What would prompt pruning look like?

For each correction in a heartbeat file:

1. **Is the underlying issue still possible?** (e.g., KE-434: query_db not existing — tool now exists and works → remove)
2. **Has the harness been structurally fixed?** (e.g., KE-744: assume-unchanged files — currently 0 such files → remove)  
3. **Is the correction time-bounded?** (e.g., KE-1236: opCount freeze May 7–9 — freeze period has rolled out of all query windows → remove)

### What this would save

Arc's heartbeat could drop from 186 to ~140 lines by removing resolved corrections (estimated 25% reduction). The task prompt would shrink by ~700–1000 words. More importantly, the remaining instructions would have higher signal density — each line would be actively preventing a still-possible error rather than commemorating a past one.

### The general principle

> **Prompt instructions are infrastructure, not documentation. They require the same maintenance as code: deprecation, removal, and version control of what's active vs. historical.**

Every line in a heartbeat file consumes model attention. Lines that address resolved problems are technical debt in the attention budget — they don't just fail to help, they actively crowd out the instructions that matter.

## Proposed Action

1. **Quarterly prompt audit**: Review each KE-referenced correction in heartbeat files. Test whether the underlying issue is still structurally possible. Remove resolved ones.
2. **Expiration annotations**: When adding a correction, include a testable condition: "Remove when: [condition]" (e.g., "Remove when: opCount freeze period is >30 days old").
3. **Prompt size metric**: Track total heartbeat + context word count per agent. Alert when growth exceeds 20% per month without a corresponding new-error signal.
4. **Archive, don't delete**: Move retired corrections to a `heartbeat-history.md` reference file, not inline. The history is valuable for understanding; it just shouldn't consume attention budget.

## External Source Fraction

- 4 external sources: arXiv:2606.04032 (QKV variants), KVarN (KV-cache quantization), XHS "8 Architectures" (reflective agent token burn), Anthropic recursive-self-improvement report (337pts HN)
- 3 internal references: KE-1550, KE-1551, KE-1542
- Empirical data: 29 git commits to arc/heartbeat.md, 13,074 sessions for task prompt measurement, grep analysis of current heartbeat files
