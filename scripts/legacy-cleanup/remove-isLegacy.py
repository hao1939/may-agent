#!/usr/bin/env python3
"""
One-shot transformer to remove the `isLegacy` (single-file project format) dead
branch from per-project iteration workflows. See proposal:
projects/platform/proposals/2026-05-20-legacy-cleanup-resume-path.md (L1).

All 14 *-iteration.ts files share the same isLegacy code shape (verified via
SHA grouping with the workflow-name token stripped). Platform has additional
divergence (setStatusFooter helper) that is orthogonal to isLegacy, so it's
handled by the same transformer safely.

Run from repo root: `python3 scripts/legacy-cleanup/remove-isLegacy.py`
"""

import sys
from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[2]
FILES = sorted(REPO.glob("projects/*/workflows/*-iteration.ts"))

# ── Targeted replacements ───────────────────────────────────────────────
# Each entry: (description, old_substring, new_substring). All must be exact
# matches; if any miss we abort to avoid drift across copies.

REPLACEMENTS = [
    # 1. Drop the interface field.
    (
        "interface field",
        "  reviewEvery: number;\n  isLegacy: boolean;        // true if single-file format\n}",
        "  reviewEvery: number;\n}",
    ),
    # 2. Collapse the parseInput legacy/new branch.
    (
        "parseInput dual-format block",
        "  let projectPath: string;\n"
        "  let journalPath: string;\n"
        "  let isLegacy = false;\n"
        "\n"
        "  if (projectInput.endsWith(\".md\")) {\n"
        "    // Legacy: single file\n"
        "    isLegacy = true;\n"
        "    projectDir = dirname(projectInput);\n"
        "    projectPath = projectInput;\n"
        "    journalPath = projectInput; // journal goes in same file for legacy\n"
        "  } else {\n"
        "    // New: directory format\n"
        "    projectDir = projectInput;\n"
        "    projectPath = join(projectInput, \"project.md\");\n"
        "    journalPath = join(projectInput, \"journal.md\");\n"
        "  }",
        "  // Project directory format: <projectDir>/project.md + <projectDir>/journal.md\n"
        "  // (Single-file `.md` format dropped; see\n"
        "  // projects/platform/proposals/2026-05-20-legacy-cleanup-resume-path.md L1.)\n"
        "  const projectPath: string = join(projectInput, \"project.md\");\n"
        "  const journalPath: string = join(projectInput, \"journal.md\");\n"
        "  projectDir = projectInput;",
    ),
    # 3. Goal fallback comment is now misleading.
    (
        "goal fallback comment",
        "    // For legacy projects, use the project name as fallback\n"
        "    goal = projectInput.replace(/\\.md$/, \"\").split(\"/\").pop() ?? \"unknown project\";",
        "    // Use the project directory name as fallback.\n"
        "    goal = projectInput.split(\"/\").pop() ?? \"unknown project\";",
    ),
    # 4. Return statement: drop isLegacy.
    (
        "return statement",
        "  return { projectDir, projectPath, journalPath, owner, worker, goal, maxIterations, reviewEvery, isLegacy };",
        "  return { projectDir, projectPath, journalPath, owner, worker, goal, maxIterations, reviewEvery };",
    ),
    # 5. emitProjectEvent: name derivation.
    (
        "emitProjectEvent name",
        "  const name = config.isLegacy\n"
        "    ? config.projectPath.split(\"/\").pop()?.replace(/\\.md$/, \"\") ?? \"unknown\"\n"
        "    : config.projectDir.split(\"/\").pop() ?? \"unknown\";",
        "  const name = config.projectDir.split(\"/\").pop() ?? \"unknown\";",
    ),
    # 6. appendJournalEntry — both branches collapse.
    (
        "appendJournalEntry body",
        "/**\n"
        " * Append an entry to the journal, handling legacy vs directory format.\n"
        " */\n"
        "function appendJournalEntry(\n"
        "  config: PersistentTaskConfig,\n"
        "  projectContent: string,\n"
        "  entry: string,\n"
        "  isCommentIteration: boolean,\n"
        "): string {\n"
        "  if (isCommentIteration) {\n"
        "    if (!config.isLegacy) cachedAppend(config.journalPath, entry);\n"
        "  } else {\n"
        "    if (config.isLegacy) {\n"
        "      projectContent += entry;\n"
        "      cachedWrite(config.projectPath, projectContent);\n"
        "    } else {\n"
        "      cachedAppend(config.journalPath, entry);\n"
        "    }\n"
        "  }\n"
        "  return projectContent;\n"
        "}",
        "/**\n"
        " * Append an entry to the journal (directory-format projects).\n"
        " */\n"
        "function appendJournalEntry(\n"
        "  config: PersistentTaskConfig,\n"
        "  projectContent: string,\n"
        "  entry: string,\n"
        "  _isCommentIteration: boolean,\n"
        "): string {\n"
        "  cachedAppend(config.journalPath, entry);\n"
        "  return projectContent;\n"
        "}",
    ),
    # 7. Comment iteration journal write — drop isLegacy branch (decision applied).
    #     Two indentation variants: 2-space (JS fast-path) and 6-space (LLM-decision).
    (
        "comment-iteration journal write (2-space indent)",
        "  if (config.isLegacy) {\n"
        "    projectContent += commentEntry;\n"
        "  } else {\n"
        "    cachedAppend(config.journalPath, commentEntry);\n"
        "  }",
        "  cachedAppend(config.journalPath, commentEntry);",
    ),
    (
        "comment-iteration journal write (6-space indent)",
        "      if (config.isLegacy) {\n"
        "        projectContent += commentEntry;\n"
        "      } else {\n"
        "        cachedAppend(config.journalPath, commentEntry);\n"
        "      }",
        "      cachedAppend(config.journalPath, commentEntry);",
    ),
    # 8. ensure-journal-exists guard.
    (
        "ensure journal exists",
        "  if (!existsSync(config.journalPath) && !config.isLegacy) {\n"
        "    ensureDir(dirname(config.journalPath));\n"
        "    cachedWrite(config.journalPath, `# Journal\\n\\n`);\n"
        "  }",
        "  if (!existsSync(config.journalPath)) {\n"
        "    ensureDir(dirname(config.journalPath));\n"
        "    cachedWrite(config.journalPath, `# Journal\\n\\n`);\n"
        "  }",
    ),
    # 9. journalContentAtStart ternary.
    (
        "journalContentAtStart",
        "  const journalContentAtStart = config.isLegacy ? projectContent : (readFile(config.journalPath) ?? \"\");",
        "  const journalContentAtStart = readFile(config.journalPath) ?? \"\";",
    ),
    # 10. journalContent ternary inside loop.
    (
        "journalContent in loop",
        "    const journalContent = config.isLegacy ? projectContent : (readFile(config.journalPath) ?? \"\");",
        "    const journalContent = readFile(config.journalPath) ?? \"\";",
    ),
    # 11. Worker journal entry write — second branch.
    (
        "worker-iteration journal write",
        "    if (config.isLegacy) {\n"
        "      // Legacy: append to the single file\n"
        "      projectContent = appendToSection(projectContent, \"Progress Log\",\n"
        "        `\\n### Iteration ${iteration} \u2014 ${now}\\n**Worker**: ${workerSummary}\\n`);\n"
        "      cachedWrite(config.projectPath, projectContent);\n"
        "    } else {\n"
        "      cachedAppend(config.journalPath, journalEntry);\n"
        "    }",
        "    cachedAppend(config.journalPath, journalEntry);",
    ),
    # 12. Auto-catalog outputs guard.
    (
        "catalogOutputs guard",
        "    if (!config.isLegacy) {\n"
        "      projectContent = catalogOutputs(config.projectDir, projectContent);\n"
        "    }",
        "    projectContent = catalogOutputs(config.projectDir, projectContent);",
    ),
    # 13. Reviewer error-fallback journal write.
    (
        "reviewer error fallback journal write",
        "        if (config.isLegacy) {\n"
        "          projectContent += reviewEntry;\n"
        "          cachedWrite(config.projectPath, projectContent);\n"
        "        } else {\n"
        "          cachedAppend(config.journalPath, reviewEntry);\n"
        "        }",
        "        cachedAppend(config.journalPath, reviewEntry);",
    ),
    # 14. Reviewer journal write.
    (
        "reviewer journal write",
        "      if (config.isLegacy) {\n"
        "        projectContent += reviewEntry;\n"
        "        cachedWrite(config.projectPath, projectContent);\n"
        "      } else {\n"
        "        cachedAppend(config.journalPath, reviewEntry);\n"
        "      }",
        "      cachedAppend(config.journalPath, reviewEntry);",
    ),
]


def transform(text: str, path: Path) -> tuple[str, list[str]]:
    """Apply all replacements; return new text + list of misses."""
    misses = []
    for desc, old, new in REPLACEMENTS:
        if old not in text:
            misses.append(desc)
            continue
        # Replace ALL occurrences. Each REPLACEMENT entry is shape-identical
        # legacy→new transformation; if a block appears multiple times (e.g.
        # the commentEntry write in JS fast-path AND in LLM-decision flow),
        # we want them all collapsed.
        text = text.replace(old, new)
    # Final guard — no lingering isLegacy or projectInput.endsWith refs.
    leftover = []
    for m in re.finditer(r"isLegacy|projectInput\.endsWith", text):
        line_start = text.rfind("\n", 0, m.start()) + 1
        line_end = text.find("\n", m.end())
        leftover.append(text[line_start:line_end].strip())
    if leftover:
        misses.append("leftover isLegacy refs:\n  " + "\n  ".join(leftover))
    return text, misses


def main() -> int:
    if not FILES:
        print("no iteration files found", file=sys.stderr)
        return 1
    print(f"Found {len(FILES)} iteration workflow file(s)")
    all_misses: dict[str, list[str]] = {}
    transformed: dict[Path, str] = {}
    for f in FILES:
        src = f.read_text()
        new, misses = transform(src, f)
        if misses:
            all_misses[str(f.relative_to(REPO))] = misses
            continue
        transformed[f] = new
    if all_misses:
        print("\n❌ MISSES — aborting without writing:", file=sys.stderr)
        for path, ms in all_misses.items():
            print(f"  {path}:", file=sys.stderr)
            for m in ms:
                print(f"    - {m}", file=sys.stderr)
        return 2
    for f, new in transformed.items():
        f.write_text(new)
        print(f"  wrote {f.relative_to(REPO)}")
    print(f"\n✅ Transformed {len(transformed)} file(s) cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
