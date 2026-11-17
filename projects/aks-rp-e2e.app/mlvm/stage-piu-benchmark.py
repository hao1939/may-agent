"""Prepare the finite PIU Task in a copy of the active operational definitions.

Usage: python3 stage-piu-benchmark.py BASE_RELEASE CANDIDATE
This does not activate definitions or admit work.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys

base, candidate = map(Path, sys.argv[1:])
assert base.resolve() != candidate.resolve() and not candidate.exists()
app = Path("projects/aks-rp-e2e.app")
source = (base / app / "app.ts").read_text()
assert "const aksKubernetesOnlyInputSchema" in source
assert "platformUpgradeBenchmarkAttachment" not in source
shutil.copytree(base, candidate, symlinks=True)

def replace_once(text, old, new):
    assert text.count(old) == 1, "Operational source changed; review integration"
    return text.replace(old, new)

imports = '''import {
  platformUpgradeBenchmarkAttachment,
  platformUpgradeBenchmarkFeedbackSchema,
  platformUpgradeBenchmarkInputSchema,
} from "./mlvm/piu-benchmark-task.js";
'''
source = imports + source
for anchor in [
    "export const aksInputSchema = Type.Union([",
    "const aksKubernetesOnlyInputSchema = Type.Union([",
]:
    source = replace_once(source, anchor, anchor + "\n  platformUpgradeBenchmarkInputSchema,\n  platformUpgradeBenchmarkFeedbackSchema,")
source = replace_once(
    source,
    "  const workstream = workstreamAttachment(admitted);\n  if (workstream) return workstream;",
    "  const workstream = workstreamAttachment(admitted);\n  if (workstream) return workstream;\n  const benchmark = platformUpgradeBenchmarkAttachment(admitted);\n  if (benchmark) return benchmark;",
)
source = replace_once(
    source,
    "This installation admits only explicit Kubernetes version support, workstreams, and feedback to their existing Tasks",
    "This installation admits only explicit Kubernetes version support, PIU benchmark, workstreams, and feedback to their existing Tasks",
)
(candidate / app / "app.ts").write_text(source)

routing_path = app / "domain-write-routing.ts"
routing = (base / routing_path).read_text()
routing = 'import { isPlatformUpgradeBenchmarkIntent } from "./mlvm/piu-benchmark-task.js";\n' + routing
routing = replace_once(
    routing,
    '  if ("kind" in action) return { reason: null };',
    '  if ("kind" in action) return { reason: null };\n  if (isPlatformUpgradeBenchmarkIntent(action)) return { reason: null };',
)
(candidate / routing_path).write_text(routing)

guidance_path = app / "agents/owner/AGENTS.md"
guidance = (base / guidance_path).read_text()
guidance += '''
## Explicit PIU benchmark assignment

The App-admitted `platform-initiated-upgrade-benchmark/v1` native execution
contract permits authoring and offline validation in its exact isolated spec
worktree, plus one benchmark PR. Follow its full assignment and handoff. RP/POC
and existing draft branches are read-only sources. This assignment permits no
cloud deployment/upgrades, shared/remote SQL or toggle/catalog mutation, peer
messages, subagents, accepted knowledge promotion, external review comments or
merge. Continue independent offline work while live prerequisites remain open.
'''
(candidate / guidance_path).write_text(guidance)

module_root = Path(__file__).parent
new = []
for name in ["piu-benchmark-task.ts", "piu-benchmark-task.test.ts", "piu-benchmark-assignment.json"]:
    target = app / "mlvm" / name
    assert not (base / target).exists()
    (candidate / target).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(module_root / name, candidate / target)
    new.append(target)
paths = [app / "app.ts", routing_path, guidance_path, *new]
manifest = {
    "baseRelease": base.name,
    "files": {str(path): hashlib.sha256((candidate / path).read_bytes()).hexdigest() for path in paths},
    "existingTaskRequirementsChanged": False,
    "schedulesChanged": False,
    "subscriptionsChanged": False,
    "newTaskId": "domain/platform-initiated-upgrade/verification-benchmark",
}
(candidate / "piu-benchmark-overlay.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"candidate": str(candidate), **manifest}, indent=2))
