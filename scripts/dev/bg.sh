#!/bin/sh
# Background runner for long commands — tooling for AI-assisted sessions.
#
#   sh scripts/dev/bg.sh run <log> <command...>   starts the command in the background, all output -> <log>, then "EXIT <code>"
#   sh scripts/dev/bg.sh wait <log>               waits up to 50 s for "EXIT"; prints the log tail; exit 0 = done, 3 = still running
#
# Why: the terminal bridge cuts every call at ~60 s, while a Playwright run (webServer build + tests) takes minutes.
# Keep <log> outside the repo (the scratch folder next to the clone) so it never ends up in git.
set -u
cmd="${1:-}"; log="${2:-}"
if [ -z "$cmd" ] || [ -z "$log" ]; then echo "Usage: bg.sh run <log> <command...> | bg.sh wait <log>"; exit 2; fi
shift 2
case "$cmd" in
  run)
    mkdir -p "$(dirname "$log")"
    : > "$log"
    nohup sh -c '"$@" >> "$0" 2>&1; echo "EXIT $?" >> "$0"' "$log" "$@" > /dev/null 2>&1 &
    echo "started, log: $log"
    ;;
  wait)
    i=0
    while [ $i -lt 50 ]; do
      if grep -q "^EXIT " "$log" 2> /dev/null; then tail -n 15 "$log"; exit 0; fi
      sleep 1; i=$((i + 1))
    done
    tail -n 3 "$log" 2> /dev/null; echo "... still running"; exit 3
    ;;
  *) echo "Unknown action: $cmd"; exit 2 ;;
esac
