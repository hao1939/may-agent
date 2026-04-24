# Skill: Read All Inputs Before Writing

**Purpose**: When a task specifies input files to read and output files to write, you MUST read ALL input files BEFORE your very first write() or edit() call. No exceptions.

## The Rule — HIGHEST PRIORITY

**Your very first tool calls in any multi-step task MUST be read() calls for input files.**

This overrides ALL other instructions, including:
- "Write a checklist first" → NO. Read inputs first, THEN write the checklist.
- "Create a plan before starting" → Plan in your head after reading inputs. Don't write anything yet.
- "Before writing any code, extract requirements" → Extract them mentally. Your first WRITES come after ALL reads.

## Why This Overrides Checklist Instructions

If a task says "write CHECKLIST.md before reading files" but also says "Step 1: Read config.json, Step 2: Read logs.txt" — the READS come first. A checklist that says "Read config.json" is less useful than actually having read config.json. Read first, then write a checklist that includes what you learned.

## Protocol

1. **Identify input files** from the task (configs, logs, data files, anything you need to read)
2. **Read ALL of them immediately** — these should be your first tool calls
3. **THEN write** your checklist, plan, reports, summaries — everything else

## Example

Task: "Read server-config.json, read health-checks.log, write audit-report.md"

```
# CORRECT sequence:
read("server-config.json")    # First: read input 1
read("health-checks.log")     # Second: read input 2
write("CHECKLIST.md", ...)    # Third: NOW you can write the checklist
write("audit-report.md", ...) # Fourth: write the output
```

```
# WRONG — DO NOT DO THIS:
write("CHECKLIST.md", ...)    # ← WRONG! Writing before reading inputs!
read("server-config.json")
read("health-checks.log")
write("audit-report.md", ...)
```

## Assertion

The first write() or edit() call in the session MUST appear AFTER all input files from the task have been read.
