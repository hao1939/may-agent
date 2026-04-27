# Skill: Task Compliance

**Trigger**: Any task with numbered steps, referenced files, or "create/follow template" instructions.

## Protocol

### Step 1: Resource Enumeration
Before doing ANY work, scan the task description and list every file, directory, or resource mentioned. Write the list explicitly.

### Step 2: Read All Referenced Resources
Read EVERY file and explore EVERY directory mentioned in the task. Do not skip any. If the task mentions a directory, `ls` it and read representative files. If it mentions a template, read the template fully before proceeding.

**Anti-pattern**: Reading only the first mentioned file and starting work immediately. You MUST read ALL referenced resources before producing output.

### Step 3: Create vs Modify Distinction
When the task says "create X following/using template Y":
- **DO**: Create a NEW file at path X, populated with content inspired by template Y
- **DON'T**: Edit or modify template Y directly

When the task says "modify X" or "update X":
- **DO**: Edit the existing file X

**Anti-pattern**: Treating "create following template" as "edit the template". Templates are read-only references.

### Step 4: Verify Completeness
Before finishing, re-read the task and check each numbered step or requirement. Confirm you completed ALL of them, not just the ones that seemed most important.

## Assertions
- [ ] Every referenced file/directory was read before producing output
- [ ] Template files were not modified (if task said "create following template")
- [ ] All numbered steps in the task were addressed
Create a new knowledge entry from experiment results.

You have experiment results in `data/experiment-results.md`. Create a knowledge entry following the project's format.

1. **Read** `data/experiment-results.md` to understand the finding
2. **Read** `knowledge/entries/KE-TEMPLATE.md` to understand the format
3. **Create** `knowledge/entries/KE-042.md` following the template structure, populated with the experiment findings
4. **Verify** the new file exists and contains all required sections

Required sections: Title, Summary, Evidence, Recommendation, Tags
