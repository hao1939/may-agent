#!/bin/bash
# Usage: resume-project.sh <project-rel-path>
# Example: resume-project.sh agents/bob/workspace/projects/context-learning
set -e
PROJECT="${1:?Usage: resume-project.sh <project-rel-path>}"
OWNER=$(grep '^\*\*Owner' "$(dirname $0)/../$PROJECT/project.md" 2>/dev/null | sed 's/\*\*Owner\*\*: //' || basename $(echo $PROJECT | cut -d/ -f2))

echo "Triggering persistent-task for $PROJECT (owner: $OWNER)..."
podman exec may-agent sh -c "
export PATH=\".state/.bun/bin:\$PATH\"
may-agent --task 'workflow.run(\"persistent-task\", \"project: $PROJECT\nagent: $OWNER\ngoal: see project file\")' --agent $OWNER
" &
echo "Launched. PID: $!"
