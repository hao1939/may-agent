#!/usr/bin/env bash
set -euo pipefail

operation="${1:-}"
if [[ "$operation" != "get" ]]; then
  exit 0
fi

protocol=""
host=""

while IFS='=' read -r key value; do
  case "$key" in
    protocol) protocol="$value" ;;
    host) host="$value" ;;
  esac
done

if [[ "$protocol" != "https" || "$host" != "dev.azure.com" ]]; then
  exit 0
fi

az_bin="${AZ_BIN:-/app/.state/.local/bin/az}"
if [[ ! -x "$az_bin" ]]; then
  echo "git-credential-azdevops: expected Azure CLI at $az_bin" >&2
  exit 1
fi

token="$(
  "$az_bin" account get-access-token \
    --resource 499b84ac-1321-427f-aa17-267ca6975798 \
    --query accessToken \
    -o tsv
)"

if [[ -z "$token" ]]; then
  exit 1
fi

printf 'username=az\n'
printf 'password=%s\n' "$token"
