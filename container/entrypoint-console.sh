#!/bin/bash
set -e

# Console entrypoint — same services as entrypoint.sh.
# Only difference: INSTANCE defaults to "console".

export INSTANCE="${INSTANCE:-console}"

# Delegate to the main entrypoint (all logic is shared)
exec /usr/local/bin/entrypoint.sh
