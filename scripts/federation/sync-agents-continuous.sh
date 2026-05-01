#!/usr/bin/env bash
#
# sync-agents-continuous.sh — DEPRECATED
#
# Local and k3s instances are now independent. No bidirectional sync.
#
# Setup:
#   Bare repo: azureuser@74.176.66.242:/opt/may-agents.git
#   Local: pushes main → origin/local (git push)
#   K3s pod: pushes master → origin/k3s
#
# To manually deploy local changes to k3s:
#   ssh azureuser@74.176.66.242 "cd /var/lib/rancher/k3s/storage/pvc-7f333b88-f968-427a-80d4-7d4400062219_may-agent_data-may-agent-0/app/agents && git fetch origin && git reset --hard origin/local"
#
# To pull k3s changes locally:
#   cd agents && git fetch origin && git log origin/k3s --oneline -5

echo "This script is deprecated. Local and k3s agents repos are independent."
echo "See comments in this file for manual sync commands."
exit 0
