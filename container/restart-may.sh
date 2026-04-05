#!/bin/bash
# restart-may.sh — restart may-agent inside the container.
# Usage: docker exec <container> restart-may.sh
exec supervisorctl restart may-agent
