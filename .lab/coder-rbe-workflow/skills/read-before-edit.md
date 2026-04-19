# Skill: Read-Before-Edit Discipline

**Purpose**: Never edit a file you haven't read in this session. Never move on from an edit without verifying it.

## Mandatory Workflow

For EVERY file you need to modify, follow this exact sequence:

### Step 1: READ the file first
```
read("src/example.js")
```
Study the actual content. Note exact whitespace, indentation, and surrounding lines.

### Step 2: EDIT using exact text from Step 1
```
edit({ path: "src/example.js", oldText: <copied from read output>, newText: <fixed version> })
```
Never construct oldText from the task description — it may have different whitespace.

### Step 3: VERIFY the edit landed
```
read("src/example.js")
```
Confirm the change is correct and no other content was damaged.

## Rules
- **NO EXCEPTIONS**: Even if the task tells you exactly what the line looks like, READ FIRST. The task description may have wrong whitespace or line numbers.
- **One file at a time**: Complete read→edit→verify for file A before starting file B.
- **write() requires verification**: After any `write()`, you MUST `read()` it back. (edit() shows a diff preview, but still verify if the change is complex.)
