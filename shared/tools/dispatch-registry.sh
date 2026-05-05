#!/bin/bash
# Dispatch Registry — EXP-860 Layer 2 Implementation
# Tracks task dispatch history to prevent zombie re-dispatch loops.
#
# Usage:
#   source agents/shared/tools/dispatch-registry.sh
#   dispatch_check "bob" "Ship EXP-188 finish-guard"  → exits 0 (ok) or 1 (blocked)
#   dispatch_record "bob" "Ship EXP-188 finish-guard" "interrupted"
#   dispatch_status "bob"  → shows all tracked tasks

REGISTRY_DIR=".state/dispatch-registry"
MAX_ATTEMPTS=3
COOLDOWN_HOURS=6

dispatch_check() {
  local agent="$1"
  local task_key
  task_key=$(echo "$2" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-80)
  local registry_file="${REGISTRY_DIR}/${agent}.json"

  mkdir -p "$REGISTRY_DIR"

  if [ ! -f "$registry_file" ]; then
    echo '{}' > "$registry_file"
  fi

  local entry
  entry=$(jq -r --arg k "$task_key" '.[$k] // empty' "$registry_file" 2>/dev/null)

  if [ -z "$entry" ]; then
    echo "DISPATCH OK: First attempt for '$task_key'"
    return 0
  fi

  local attempts last_dispatch status
  attempts=$(echo "$entry" | jq -r '.attempts // 0')
  last_dispatch=$(echo "$entry" | jq -r '.last_dispatch // ""')
  status=$(echo "$entry" | jq -r '.last_status // "unknown"')

  # Check cooldown
  if [ -n "$last_dispatch" ]; then
    local now last_epoch cooldown_secs elapsed
    now=$(date +%s)
    last_epoch=$(date -d "$last_dispatch" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$last_dispatch" +%s 2>/dev/null || echo 0)
    cooldown_secs=$((COOLDOWN_HOURS * 3600))
    elapsed=$((now - last_epoch))

    if [ "$elapsed" -lt "$cooldown_secs" ] && [ "$status" = "interrupted" ] && [ "$attempts" -ge "$MAX_ATTEMPTS" ]; then
      echo "DISPATCH BLOCKED: '$task_key' has $attempts attempts (last: ${status}, ${elapsed}s ago). Cooldown: ${COOLDOWN_HOURS}h."
      echo "ACTION: Escalate or decompose this task instead of re-dispatching."
      return 1
    fi
  fi

  if [ "$attempts" -ge "$MAX_ATTEMPTS" ]; then
    echo "DISPATCH BLOCKED: '$task_key' has $attempts failed attempts. 3-strike rule applies."
    echo "ACTION: Write blocker report, escalate, or decompose."
    return 1
  fi

  echo "DISPATCH OK: '$task_key' attempt $((attempts + 1))/$MAX_ATTEMPTS (last: ${status})"
  return 0
}

dispatch_record() {
  local agent="$1"
  local task_key
  task_key=$(echo "$2" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-80)
  local status="$3"  # "success", "interrupted", "error"
  local registry_file="${REGISTRY_DIR}/${agent}.json"
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  mkdir -p "$REGISTRY_DIR"
  [ ! -f "$registry_file" ] && echo '{}' > "$registry_file"

  if [ "$status" = "success" ]; then
    # On success, reset the counter
    jq --arg k "$task_key" --arg t "$now" \
      '.[$k] = {"attempts": 0, "last_dispatch": $t, "last_status": "success", "completed": true}' \
      "$registry_file" > "${registry_file}.tmp" && mv "${registry_file}.tmp" "$registry_file"
  else
    # Increment attempts on failure/interruption
    jq --arg k "$task_key" --arg t "$now" --arg s "$status" \
      '.[$k].attempts = ((.[$k].attempts // 0) + 1) | .[$k].last_dispatch = $t | .[$k].last_status = $s' \
      "$registry_file" > "${registry_file}.tmp" && mv "${registry_file}.tmp" "$registry_file"
  fi

  echo "RECORDED: '$task_key' status=$status in $registry_file"
}

dispatch_status() {
  local agent="$1"
  local registry_file="${REGISTRY_DIR}/${agent}.json"

  if [ ! -f "$registry_file" ]; then
    echo "No dispatch history for $agent"
    return
  fi

  echo "=== Dispatch Registry: $agent ==="
  jq -r 'to_entries[] | "\(.key): attempts=\(.value.attempts) status=\(.value.last_status) last=\(.value.last_dispatch)"' "$registry_file"
}

dispatch_clear() {
  local agent="$1"
  local task_key
  task_key=$(echo "$2" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-80)
  local registry_file="${REGISTRY_DIR}/${agent}.json"

  [ ! -f "$registry_file" ] && return
  jq --arg k "$task_key" 'del(.[$k])' "$registry_file" > "${registry_file}.tmp" && mv "${registry_file}.tmp" "$registry_file"
  echo "CLEARED: '$task_key' from $agent registry"
}
