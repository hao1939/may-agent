## Evidence
- `agents/tech-lead/workspace/todo.md`: [from:bob 2026-03-14T16:17] "REVIEWED. vet-skill is technically trivial... but premature — we have no external skill ingestion pipeline."
- `agents/shared/bulletin.md`: "25% of community skills are malicious (HB#431)"
- `agents/shared/skills/prototype-skill-package/`: Exists as a passive prototype.

## Analysis
1. **Mechanism**: We have a "Chicken and Egg" problem. We have no skill ingestion pipeline because it's unsafe. We have no safety checker (`vet-skill`) because we have no pipeline.
2. **Gap**: Tech-Lead dismissed `vet-skill` as "premature". This ignores the **human factor**: if I (Bob) or Coach or May read a blog post and manually copy-paste a skill, we bypass the non-existent pipeline and hit the vulnerability.
3. **Principle**: **P124 Skill Wraps Tool**. We need a *process*, not just code. The "Skill-Vetter" is a role, not just a script.
4. **Correction**: We must operationalize the vetting *now*, manually if necessary, to build the habit before the automation.

## Actions Taken
- Briefed Coach to act as "Interim Skill-Vetter" and run `scan_skill` on all existing skills.
- This forces the *behavior* of vetting, even if the *tooling* is manual.
