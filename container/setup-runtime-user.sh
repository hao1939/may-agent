#!/bin/bash
set -e

runtime_user="${MAY_RUNTIME_USER:-mayagent}"
project_root="${PROJECT_ROOT:-/app}"
agents_root="${AGENTS_ROOT:-${project_root}/agents}"
shared_root="${SHARED_ROOT:-${project_root}/shared}"
projects_root="${PROJECTS_ROOT:-${project_root}/projects}"
state_dir="${STATE_DIR:-${project_root}/.state}"
ownership_path="${MAY_RUNTIME_OWNERSHIP_PATH:-${projects_root}}"
[ -e "${ownership_path}" ] || ownership_path="${project_root}"

configured_uid="${MAY_RUNTIME_UID:-}"
configured_gid="${MAY_RUNTIME_GID:-}"
if [ -z "${configured_uid}" ] && [ -e "${ownership_path}" ]; then
  configured_uid="$(stat -c '%u' "${ownership_path}")"
fi
if [ -z "${configured_gid}" ] && [ -e "${ownership_path}" ]; then
  configured_gid="$(stat -c '%g' "${ownership_path}")"
fi
# Image-only runs have root-owned package files rather than an operator mount.
# Retain the image's unprivileged identity in that case.
[ -n "${configured_uid}" ] && [ "${configured_uid}" != "0" ] || configured_uid="$(id -u "${runtime_user}")"
[ -n "${configured_gid}" ] && [ "${configured_gid}" != "0" ] || configured_gid="$(id -g "${runtime_user}")"

case "${configured_uid}" in *[!0-9]*|'') echo "Invalid May runtime uid: ${configured_uid}" >&2; return 1 ;; esac
case "${configured_gid}" in *[!0-9]*|'') echo "Invalid May runtime gid: ${configured_gid}" >&2; return 1 ;; esac

if [ "$(id -u)" = "0" ]; then
  current_uid="$(id -u "${runtime_user}")"
  current_gid="$(id -g "${runtime_user}")"
  if [ "${current_gid}" != "${configured_gid}" ]; then
    groupmod --non-unique --gid "${configured_gid}" "${runtime_user}"
  fi
  if [ "${current_uid}" != "${configured_uid}" ] || [ "${current_gid}" != "${configured_gid}" ]; then
    usermod --non-unique --uid "${configured_uid}" --gid "${configured_gid}" "${runtime_user}"
  fi
fi

export MAY_RUNTIME_UID="${configured_uid}"
export MAY_RUNTIME_GID="${configured_gid}"

mkdir -p "${project_root}" "${state_dir}" "${agents_root}" "${projects_root}" "${shared_root}" "${state_dir}/runtime-logs"
if [ "$(id -u)" = "0" ]; then
  chown "${runtime_user}:${runtime_user}" \
    "${project_root}" "${state_dir}" "${agents_root}" "${projects_root}" "${shared_root}" "${state_dir}/runtime-logs" \
    2>/dev/null || true
  # This directory is image-owned and bounded. Persisted session trees are not
  # recursively walked during startup. Root-squashed mounts may reject chown;
  # the access check below remains authoritative.
  chown -R "${runtime_user}:${runtime_user}" "${state_dir}/runtime-logs" 2>/dev/null || true
fi

for path in "${project_root}" "${state_dir}" "${agents_root}" "${projects_root}" "${shared_root}"; do
  if ! runuser -u "${runtime_user}" -- test -r "${path}" -a -w "${path}" -a -x "${path}"; then
    echo "May runtime user ${runtime_user} (${configured_uid}:${configured_gid}) cannot use ${path}. Set MAY_RUNTIME_UID/MAY_RUNTIME_GID to the mounted installation owner." >&2
    return 1
  fi
done
