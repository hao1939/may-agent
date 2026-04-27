# Skill Quality Audit — 2026-07-30

**Scope**: 20 skills sampled across all agents (2 per agent + 8 shared).  
**Total skills in system**: ~143 (79 agent-specific, 64 shared non-archived).

## Summary

**Overall quality: GOOD.** 18/20 skills are well-structured, evidence-backed, and actionable. The system's skill library is surprisingly high quality — much better than the "zero quality measurement" concern suggested.

| Rating | Count | Skills |
|--------|-------|--------|
| ✅ Excellent (clear, evidence-backed, actionable) | 12 | evidence-over-narrative (bob+shared), diagnosis-before-action, score, work-session-scaffold, find-before-read, finish-before-cleanup, verification, obstacle-pivot, test-mock-awareness, file-safety, multi-file-discovery-completeness, generate-test-case |
| ✅ Good (useful, minor issues) | 6 | establish-working-directory, deliverable-checklist, budget-before-act, cli-coding, closing-the-loop, persistent-task-workflow |
| ⚠️ Thin (too short/vague) | 2 | verify-before-finish (may), sanitize-content* |

## Detailed Assessments

### Per-agent skills (10 sampled)

1. **amy/establish-working-directory** — GOOD. Addresses real failure mode. Anti-patterns from real sessions. Slightly long but actionable.

2. **bob/evidence-over-narrative** — EXCELLENT. Strong evidence section, clear protocol, owner + version metadata.

3. **coach/work-session-scaffold** — EXCELLENT. Directly addresses coach's own failure modes with concrete phases. Self-referential and useful.

4. **coder/diagnosis-before-action** — EXCELLENT. Backed by EXP-164 (0% → 100% pass rate). Clear protocol. Model skill.

5. **evaluator/score** — EXCELLENT. Comprehensive scoring rubric. Well-structured with edge cases handled.

6. **may/verify-before-finish** — THIN. Just 3-line checklist. Functional but lacks the evidence/when-to-apply structure of better skills.

7. **optimizer/deliverable-checklist** — GOOD. Addresses FM-2.2. Clear steps. Could benefit from a concrete example.

8. **qa/generate-test-case** — EXCELLENT. DIVE Reverse-Task method is creative and well-explained.

9. **scout/find-before-read** — EXCELLENT. Targets #1 efficiency failure mode. Great anti-pattern examples.

10. **tech-lead/finish-before-cleanup** — EXCELLENT. Strong evidence (10 C1.4 failures, 15.6% fail rate). Precise trigger conditions.

### Shared skills (10 sampled)

11. **verification/SKILL.md** — EXCELLENT. Core mandatory skill. Well-structured.

12. **evidence-over-narrative/SKILL.md** — EXCELLENT. Same as bob's copy (good — consistent).

13. **closing-the-loop/skill.md** — GOOD. Decision framework is clear. Evolution ladder is helpful.

14. **obstacle-pivot/SKILL.md** — EXCELLENT. Structured fallback strategy. Practical.

15. **budget-before-act/SKILL.md** — GOOD. Addresses FM-3.1 (#1 uncovered failure mode). Checkpoint triggers useful.

16. **cli-coding/SKILL.md** — GOOD. Practical reference. Auth status table helpful.

17. **test-mock-awareness/SKILL.md** — EXCELLENT. Addresses subtle failure (13.2% baseline pass rate). Specific protocol.

18. **file-safety/SKILL.md** — EXCELLENT. Core safety protocols. Clear principles.

19. **coder/multi-file-discovery-completeness** — EXCELLENT. Clear problem statement, evidence from gym scenario.

20. **bob/persistent-task-workflow** — GOOD. Mandatory trigger clearly stated. Could be shorter.

## Key Findings

1. **Duplication is the main issue, not quality.** Multiple agents have their own copies of evidence-over-narrative, verify-after-edit, second-look-verification. The shared/ versions exist too. ~15 skills are duplicated across 3+ agents.

2. **Most skills have evidence metadata.** 14/20 sampled skills cite experiments, session data, or failure counts. This is excellent traceability.

3. **Thin skills are rare.** Only 2/20 were too brief. The rest had substantial protocols with anti-patterns and examples.

4. **No harmful/incorrect skills found.** All 20 give accurate, useful advice. None would cause an agent to do the wrong thing.

## Recommendations

1. **Deduplicate**: Move agent-specific copies of shared skills (evidence-over-narrative, verify-after-edit, second-look-verification) to shared/ and remove duplicates. ~20 files could be eliminated.
2. **Beef up thin skills**: may/verify-before-finish could absorb content from shared/verification.
3. **Archive untested agent-specific skills**: coder/multi-file-discovery-completeness is `tested: false, promoted: null` — either test it in gym or archive it.
4. **No urgent action needed**: The skill library is healthy. Quality measurement anxiety was unwarranted.
