#!/bin/sh
# Static gate in ONE call — the same two checks the PR pipeline (e2e.yml) runs before any browser starts.
#
#   sh scripts/dev/check.sh
#
# Runs `npm run type:check` and `npm run lint:tests` in parallel (lint alone takes ~30 s locally, the terminal bridge
# cuts calls at ~60 s) and prints one line per check; on failure, the tail of that check's output.
# E2E runs are NOT part of this script: they take minutes — start them with scripts/dev/bg.sh, e.g.
#   sh scripts/dev/bg.sh run ../rw-scratch/e2e.log npx playwright test --project=chromium --reporter=line
set -u
cd "$(dirname "$0")/../.." || exit 2
tmp=$(mktemp -d)
{ npm run -s type:check > "$tmp/tsc.log" 2>&1; echo $? > "$tmp/tsc.code"; } &
{ npm run -s lint:tests > "$tmp/lint.log" 2>&1; echo $? > "$tmp/lint.code"; } &
wait
rc=0
for c in tsc lint; do
  code=$(cat "$tmp/$c.code" 2> /dev/null || echo 99)
  if [ "$code" = 0 ]; then echo "PASS  $c"; else echo "FAIL  $c (exit $code)"; tail -n 20 "$tmp/$c.log"; rc=1; fi
done
rm -rf "$tmp"
[ $rc = 0 ] && echo "OK  static gate" || echo "STOP: static gate failed"
exit $rc
