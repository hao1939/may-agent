<ai_context>
summary: "A pinned implementation review of codex-workspace-bootstrap shows that cross-agent instruction linting needs two distinct operations: resolve each instruction's effective scope, then validate its commands against the nearest repository evidence. Its conservative choice not to compare path-specific rules when full selector semantics are unavailable is a useful abstention pattern: an omitted warning is safer than a false global conflict, but the resulting report must not be mistaken for proof that all overlapping rules agree. A later Reddit product report adds a useful lifecycle split—read-only inventory, diagnosis, previewed repair, audit, and per-change rollback—while leaving semantic scope handling unverified."
triggers: ["agent instruction drift", "instruction preflight", "AGENTS.md scope", "path-specific agent rules", "repository evidence", "false-positive abstention", "codex-workspace-bootstrap", "Skill Index", "cross-agent skill copies", "configuration repair audit"]
last_updated: "2026-09-23"
source_basis: "GitHub repository kohli217/codex-workspace-bootstrap at pinned commit e674da6b42235bc94b46bee6634c904717d16d68; complete recursive tree, README, instruction-lint implementation, audit implementation, and instruction-integrity tests inspected. Local test execution was attempted, but pytest was unavailable in the environment. Reddit post t3_1wnqbwd was read in full through the public search Atom feed; its linked repository and product were not inspected."
</ai_context>

# Instruction preflight must separate effective scope from repository evidence

**Date:** 2026-09-22  
**Disposition:** New source-grounded finding  
**Coverage:** Complete repository tree and selected documentation, implementation, and tests at one pinned revision. The code was not executed successfully.

## Source

- **Repo:** https://github.com/kohli217/codex-workspace-bootstrap
- **Inspected revision:** [`e674da6b42235bc94b46bee6634c904717d16d68`](https://github.com/kohli217/codex-workspace-bootstrap/commit/e674da6b42235bc94b46bee6634c904717d16d68)
- **Primary implementation:** [`instructions.py`](https://github.com/kohli217/codex-workspace-bootstrap/blob/e674da6b42235bc94b46bee6634c904717d16d68/src/codex_workspace_bootstrap/instructions.py)
- **Tests inspected:** [`test_instruction_integrity.py`](https://github.com/kohli217/codex-workspace-bootstrap/blob/e674da6b42235bc94b46bee6634c904717d16d68/tests/test_instruction_integrity.py)
- **Additional implementation:** [`audit.py`](https://github.com/kohli217/codex-workspace-bootstrap/blob/e674da6b42235bc94b46bee6634c904717d16d68/src/codex_workspace_bootstrap/audit.py)
- **Discovery query:** https://api.github.com/search/repositories?q=%22AI+agent%22+evaluation+in%3Aname%2Cdescription%2Creadme+pushed%3A%3E%3D2026-09-20&sort=updated&order=desc&per_page=30 (`incomplete_results=false`)
- **Reddit source:** https://www.reddit.com/r/devtools/comments/1wnqbwd/skill_index_inspect_diverged_agent_setup_files/ (`t3_1wnqbwd`)
- **Repo named by the Reddit author (not inspected in this update):** https://github.com/arjitj2/skillindex

## Question

What does a current implementation reveal about checking multiple coding-agent instruction formats without flattening repository-local rules into one misleading global policy?

## Signal

`codex-workspace-bootstrap` is a repository preflight tool, not an agent. Its instruction-integrity implementation provides a concrete pattern for a problem that grows as repositories add `AGENTS.md`, `CLAUDE.md`, Copilot instructions, Cursor rules, Continue rules, and Gemini context files: **command agreement is meaningful only after both rule scope and repository evidence are resolved.**

This is stronger than comparing instruction text pairwise. Two files can legitimately prescribe different commands because they govern different subtrees, while two files that agree with each other can still both be wrong relative to the package manager or scripts actually present.

## What the pinned implementation does

### 1. It resolves an effective scope before comparing rules

The detector represents each instruction as a `(tool, path, scope, kind)` signal. It recognizes nested `AGENTS.md` files, gives a sibling `AGENTS.override.md` precedence within that directory, maps nested `CLAUDE.md` and Gemini context files to their directory scope, and derives static prefixes from path metadata such as Copilot `applyTo` and Continue/Cursor globs. The inspected tests cover override precedence, nested scopes, custom Gemini context filenames, and path-specific frontmatter.

The important boundary is explicit in `_same_scope_groups`: repository-wide and override files can be grouped for drift checks, but path-specific rules are excluded from cross-file comparison. The implementation explains why: reducing full glob selectors to one static prefix can make disjoint rules look like peers. It still validates each path-specific rule against repository evidence, but abstains from claiming that their commands conflict.

### 2. It checks instructions against the nearest repository evidence

For a resolved scope, package evidence is searched from that directory toward the repository root. The first level with evidence wins. `packageManager` declarations and lockfiles identify npm, pnpm, yarn, or bun; the nearest `package.json` supplies available script names. The linter then reports, separately:

- conflicting repository package-manager evidence;
- an instruction using a manager that disagrees with repository evidence;
- an explicitly invoked package script that does not exist; and
- same-scope instruction files with no shared command in a validation family.

This separation matters operationally. **Instruction-to-instruction agreement** and **instruction-to-repository validity** are different checks. A consensus of stale instructions is still stale, while a valid monorepo can contain different commands in different scopes.

### 3. It treats repository text as data, not executable authority

The linter extracts command-shaped text but does not execute it. Reads are size-bounded, instruction and package-evidence symlinks are ignored, and the fix path refuses to write through a symlink target. Conflicting instructions remain review findings rather than being automatically rewritten. These choices keep a preflight scanner from turning untrusted repository instructions into execution or mutation authority.

## Reusable design implications

An instruction preflight should expose at least three verdict layers:

1. **resolution:** which instruction files apply to the target path, including override precedence;
2. **validation:** whether their commands match nearby manifests, lockfiles, and declared scripts; and
3. **comparison:** whether rules that truly share a scope disagree.

The third layer should be allowed to abstain when selector overlap cannot be represented faithfully. That abstention must remain visible: “no drift finding” means only that the implemented comparison found none among comparable rules, not that every possible pair of instructions is compatible.

This complements the library's existing [agent-native repository preflight](../agent-security-governance.md#aug-2026-update--preflight-repo-audit-becomes-agent-native) coverage. Supply-chain admission asks whether repository artifacts are safe enough to enter the runtime; instruction-integrity preflight asks whether the policy text already inside that repository is applicable and executable in the intended scope. Neither replaces the other.

## Reddit update — configuration repair needs a staged lifecycle (2026-09-23)

A developer's Reddit post about **Skill Index** describes the operational problem
from the other end: a developer copies skills and configuration across several
coding-agent tools, later changes one copy, and can no longer tell which version
should be authoritative. The post says its local macOS app inventories existing
skill, MCP, and subagent files, distinguishes missing files, diverged copies, and
invalid definitions, and lets the user inspect versions before choosing a
repair. Proposed repairs identify the affected file and agent; completed changes
enter a local audit log and can be rolled back individually. Plugin-provided
capabilities remain read-only inventory.

The useful addition is a **lifecycle split**, not a validation claim:

1. inventory the artifacts and their origins without relocating them;
2. classify an observed difference before treating it as an error;
3. preview the exact target and agent before mutation;
4. record each applied repair separately; and
5. preserve a per-change rollback path.

This makes drift repair auditable, but it does not remove the scope problem above.
A byte difference can mean a stale copy, an intentional tool-specific adaptation,
or two rules that govern different paths. A repair system therefore needs both
artifact identity/version comparison and semantic scope resolution; otherwise a
polished sync action can erase a legitimate specialization. “Invalid” also needs
an exposed validator and evidence boundary rather than a universal badge.

The Reddit body was readable in the public Atom feed and is a first-party product
report. Scout did not inspect the linked repository, install the app, verify its
screenshots, or test its audit and rollback behavior. The signal supports the
staged repair interface and identifies an emerging maintenance pain point; it is
not evidence of reliability, adoption, or semantic drift detection.

## Limitations

- The repository was created the previous day and showed zero stars and forks at retrieval. This is implementation evidence, not adoption evidence.
- The tree response was complete (`truncated=false`, 103 entries), but only the linked documentation, implementation, and tests were read in depth.
- Local execution of `tests/test_instruction_integrity.py` was attempted after downloading the pinned tarball, but the environment lacked `pytest`; no test pass is claimed.
- The command parser intentionally recognizes a bounded set of validation-command shapes, with especially detailed repository-evidence checks for JavaScript package managers. Absence of a finding is not proof that arbitrary shell instructions are valid.
- Static-prefix scope extraction cannot preserve every selector's full semantics. The implementation avoids some false positives by not cross-comparing path-specific rules, which also leaves some real overlap conflicts undetected.
