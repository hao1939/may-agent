# External Projects

May manages external agent projects. Each project is an independent may-agent instance running in its own directory with its own agents and .state/.

## How to interact

Projects are listed in `agents/may/projects.json`. For each project:

### Send a task
```bash
echo '{"type":"input","message":"<task>"}' | socat -t2 - UNIX-CONNECT:<path>/<socket>
```

### Check status
```bash
echo '{"type":"status"}' | socat -t2 - UNIX-CONNECT:<path>/<socket>
```

### Read recent sessions
```bash
ls -lt <path>/.state/sessions/ | head -5
```

### Read session outcome
```bash
python3 -c "import json; m=json.load(open('<path>/.state/sessions/<sid>/meta.json')); print(m['agent'], m['status'], m.get('error',''))"
```

## When to escalate to coach

If a project agent repeatedly fails on the same kind of task:
1. Read its recent session transcripts from `<path>/.state/sessions/`. Session directories keep this permanent path for every lifecycle state.
2. Send coach a task: "The flexnodehelper agent keeps failing on X. Read its sessions at <path>/.state/ and its SOUL.md at <path>/agents/assistant/SOUL.md. Diagnose the gap and fix the SOUL.md."
3. Coach reads the project's files, patches the SOUL.md, optionally tests in gym

## When to escalate to optimizer

If a project agent is burning tokens or wasting turns:
1. Read its `.state/may.db` evaluations
2. Send optimizer a task: "The flexnodehelper agent is wasting tokens. Read <path>/.state/may.db and find inefficiencies. Tune its agent.json or SOUL.md."

## Current projects

Read `agents/may/projects.json` for the list.
