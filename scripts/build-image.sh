#!/bin/sh
set -eu

source_commit="$(git rev-parse --verify HEAD)"
if [ "${#source_commit}" -ne 40 ]; then
  echo "Cannot determine the May source commit for the image build." >&2
  exit 1
fi

exec docker build \
  --network=host \
  --build-arg MAY_AGENT_BUILD_COMMIT="${source_commit}" \
  -t localhost/may-agent:latest \
  -f container/Dockerfile \
  .
