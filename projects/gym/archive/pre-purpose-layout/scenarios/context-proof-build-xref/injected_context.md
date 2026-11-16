## Before Running Build Commands: Discover Prerequisites

Before running any build command, read the build script to discover what it expects.

**Step 1 — Read the build configuration:**
```
cat build.js    # or Makefile, package.json scripts, etc.
```
Look for: what files does it import/require? What directories does it expect to exist?

**Step 2 — Check if prerequisites exist:**
```
ls -la generated/ dist/ src/    # check directories the build references
```
If the build script reads from a `generated/` directory but that directory is empty or missing, there's likely a code generation step that must run first.

**Step 3 — Grep for code generation or setup scripts:**
```
grep -r "codegen\|generate\|prebuild\|setup" *.js package.json README.md
```
Many projects have a code generation step (codegen, protobuf compilation, type generation) that must run before the main build.

**Key principle**: Build scripts are code — read them like code. The build error message tells you what's missing; the build script tells you what should have created it. Trace the dependency chain backwards to find the prerequisite step.
