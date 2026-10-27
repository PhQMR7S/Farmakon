#!/usr/bin/env bash
set -euo pipefail
umask 077
test "${GITHUB_ACTIONS:-}" = true
test "${GITHUB_REPOSITORY:-}" = PhQMR7S/Farmakon
project="f0010-${GITHUB_RUN_ID}-${F0010_ROUND:-cleanup}"
state="$RUNNER_TEMP/f0010-state"
cli=(npx --yes supabase@2.81.3)
# Official Supabase mirror used by the pinned CLI's own CI. No registry login.
export SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io
cleanup() {
  if test -f "$state/project"; then
    project=$(cat "$state/project")
    [[ "$project" =~ ^f0010-[0-9]+-[12]$ ]]
    "${cli[@]}" stop --project-id "$project" --no-backup >"$state/stop.log" 2>&1 || return 1
    test -z "$(docker ps -aq --filter "label=com.supabase.cli.project=$project")"
    test -z "$(docker volume ls -q --filter "label=com.supabase.cli.project=$project")"
    docker network rm "$project-net" >/dev/null 2>&1 || true
    if docker network inspect "$project-net" >/dev/null 2>&1; then
      echo 'F0010_NETWORK_CLEANUP_FAILED'
      return 1
    fi
    rm -rf "$state"
    echo '{"phase":"cleanup","containers":0,"volumes":0,"privateFilesRemoved":true}'
  fi
}
if test "${1:-}" = cleanup; then cleanup; exit; fi
[[ "$project" =~ ^f0010-[0-9]+-[12]$ ]]
test ! -e "$state"
mkdir -m 700 "$state" "$state/work" "$state/work/supabase"
printf '%s' "$project" >"$state/project"
trap cleanup EXIT
cp tests/local-supabase/config.toml "$state/work/supabase/config.toml"
sed -i "s/project_id = \"f0010-ci\"/project_id = \"$project\"/" "$state/work/supabase/config.toml"
# Separate loopback-bound network: no publicly published dev ports.
docker network create -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$project-net" >/dev/null
"${cli[@]}" --version
"${cli[@]}" start --help >"$state/start-help.txt" 2>&1
node tests/local-supabase/prefetch.mjs
timeout 480s "${cli[@]}" --workdir "$state/work" --network-id "$project-net" start -x realtime,imgproxy,studio,postgres-meta,edge-runtime,logflare,vector,supavisor >"$state/start.log" 2>&1 || { node tests/local-supabase/diagnose.mjs "$state/start.log" "$project"; exit 1; }
"${cli[@]}" --workdir "$state/work" status -o json >"$state/status.json" 2>"$state/status.log"
node tests/local-supabase/verify.mjs "$state/status.json" "$project"
