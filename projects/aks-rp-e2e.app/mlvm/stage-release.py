"""Stage an immutable definition overlay; never activate or mutate live state.

Usage: python3 stage-release.py BASE_RELEASE NEW_RELEASE
The exact base is intentional: a different operational App needs a fresh review.
"""
import hashlib
import json
import pathlib
import shutil
import sys

base, output = map(pathlib.Path, sys.argv[1:])
assert base.resolve() != output.resolve() and not output.exists()
app = pathlib.Path('projects/aks-rp-e2e.app/app.ts')
original = (base / app).read_bytes()
assert hashlib.sha256(original).hexdigest() == '888ef64e8725257729c582e1d215b79b332759b74c366213bc1830018e5f5a90', 'Operational App changed; review its integration first'
old = 'observers: kubernetesVersionSupportOnly ? [] : aksObservers,'
assert original.decode().count(old) == 1
assert not (base / app.parent / 'mlvm').exists()
profile_test = app.parent / 'kubernetes-version-support-task.test.ts'
test_source = (base / profile_test).read_bytes()
assert hashlib.sha256(test_source).hexdigest() == '4bcf15b3f138e0bf549bf5969e1f221c30ff2d21f2d0cb5646ca2b7f568097e6', 'Profile regression test changed; review first'
shutil.copytree(base, output, symlinks=True)
module = pathlib.Path(__file__).with_name('compiler-pull-request.ts')
destination = output / app.parent / 'mlvm'
destination.mkdir()
shutil.copy2(module, destination / module.name)
imports = '''import { compilerPullRequestObserver } from "./mlvm/compiler-pull-request.js";
import { adoReader } from "./watchers/ado-read.js";
const compilerPrObserver = compilerPullRequestObserver(path => adoReader()(path));
'''
(output / app).write_text(imports + original.decode().replace(
    old, 'observers: kubernetesVersionSupportOnly ? [compilerPrObserver] : aksObservers,'))
(output / profile_test).write_text(test_source.decode()
    .replace('observers:app.observers.length', 'observers:app.observers.map(observer=>observer.id)')
    .replace('observers: 0,', 'observers: ["compiler-pull-request"],'))
release = json.loads((output / 'release.json').read_text())
release['id'] = output.name
# This overlay is recorded by file hash, not the predecessor's whole-tree commit.
release.pop('sourceCommit', None)
(output / 'release.json').write_text(json.dumps(release, indent=2) + '\n')
manifest = {
    str(path.relative_to(output)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in [output / app, destination / module.name, output / profile_test]
}
(output / 'compiler-pr-wake-overlay.json').write_text(json.dumps({
    'baseRelease': base.name, 'files': manifest,
    'taskRequirementsChanged': False, 'subscriptionsChanged': False,
    'schedulesChanged': False, 'nativeConfigurationChanged': False,
}, indent=2) + '\n')
print(json.dumps({'staged': str(output), 'files': manifest}))
