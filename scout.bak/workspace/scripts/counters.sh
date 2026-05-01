#!/usr/bin/env bash
# Scout counter helper — reads/writes workspace/state.json atomically.
# Usage: counters.sh get <name> | bump <name> | set <name> <value> | show
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
F="$DIR/state.json"
TMP="$F.tmp.$$"
cmd="${1:-show}"
name="${2:-}"
val="${3:-}"

node_bin="node"
command -v "$node_bin" >/dev/null 2>&1 || node_bin="$(command -v bun) x node" || true

run_node() {
  node -e "$1" "$F" "$TMP" "$name" "${val:-}" "$cmd"
}

case "$cmd" in
  show)
    node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify(s.counters,null,2));console.log("last_updated:",s.last_updated)' "$F"
    ;;
  get)
    [ -n "$name" ] || { echo "usage: get <name>" >&2; exit 2; }
    node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=s.counters[process.argv[2]];if(v===undefined){console.error("unknown counter");process.exit(3)}console.log(v)' "$F" "$name"
    ;;
  bump|set)
    [ -n "$name" ] || { echo "usage: $cmd <name> [value]" >&2; exit 2; }
    node -e '
      const fs=require("fs");const [f,tmp,name,val,cmd]=process.argv.slice(1);
      const s=JSON.parse(fs.readFileSync(f,"utf8"));
      if(!(name in s.counters))s.counters[name]=0;
      if(cmd==="bump"){s.counters[name]=Number(s.counters[name])+1;}
      else{s.counters[name]=Number(val);if(!Number.isFinite(s.counters[name])){console.error("bad value");process.exit(3)}}
      s.last_updated=new Date().toISOString();
      fs.writeFileSync(tmp,JSON.stringify(s,null,2)+"\n");
      fs.renameSync(tmp,f);
      console.log(s.counters[name]);
    ' "$F" "$TMP" "$name" "$val" "$cmd"
    ;;
  *)
    echo "usage: counters.sh {get|bump|set|show} [name] [value]" >&2
    exit 2
    ;;
esac
